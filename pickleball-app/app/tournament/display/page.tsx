'use client';

import React, { useState, useEffect } from 'react';
import { Player, Match, Round } from '@/app/lib/definitions';
import { getTournamentState } from '@/app/lib/actions';
import { firePodiumConfetti } from '@/app/ui/confetti';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { DuprTournamentState, getDuprFinalLeaderboard, getDuprStandings } from '@/app/lib/tournament_mode/duprTournament';
import { formatDuprPhaseLabel } from '@/app/lib/game_modes/dupr/view';
import { formatRallyRoundLabel } from '@/app/lib/game_modes/rally/view';
import {
  calculateLeaderboard,
  generateRoundPairings,
  hasPlayedTogetherInHistory,
  reconcileCourtOrder,
} from '@/app/lib/tournament-engine';


export default function Tournament() {
  const [isHydrated, setIsHydrated] = useState(false);
      const [setupComplete, setSetupComplete] = useState(false);
      const [tournamentFinished, setTournamentFinished] = useState(false);
      const [mode, setMode] = useState<gameMode>(gameMode.RALLYTOTHETOP);
      const [duprState, setDuprState] = useState<DuprTournamentState | null>(null);
      const [isEditMode, setIsEditMode] = useState(false);
      const [showHistoryModal, setShowHistoryModal] = useState(false);
      const [swapSelection, setSwapSelection] = useState<{courtId?: string, team?: 'A'|'B', index?: number, isWaitlist?: boolean, pId?: string} | null>(null);
      
      const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
      const [selectedCourts, setSelectedCourts] = useState<string[]>(['1', '2', '3']);
      const [courtOrder, setCourtOrder] = useState<string[]>(['1', '2', '3']);
    
      const [players, setPlayers] = useState<Player[]>([]);
      const [waitingPlayers, setWaitingPlayers] = useState<string[]>([]);
      const [currentMatches, setCurrentMatches] = useState<Record<string, Match>>({});
      const [history, setHistory] = useState<Round[]>([]);
      const [bulkInput, setBulkInput] = useState('');
  
    // 1. Create a reusable load function
  const loadData = async () => {
    const data = await getTournamentState();
    if (data) {
      setSetupComplete(data.setupComplete ?? false);
      setTournamentFinished(data.tournamentFinished ?? false);
      setMode((data.mode ?? data.tournamentType ?? gameMode.RALLYTOTHETOP) as gameMode);
      setSelectedCourts(data.selectedCourts ?? []);
      setCourtOrder(data.courtOrder ?? data.selectedCourts ?? []);
      setPlayers(data.players ?? []);
      setWaitingPlayers(data.waitingPlayers ?? []);
      setCurrentMatches(data.currentMatches ?? {});
      setHistory(data.history ?? []);
      setDuprState((data.duprState as DuprTournamentState) ?? null);
    }
    setIsHydrated(true);
  };

  // 2. Initial Load
  useEffect(() => {
    loadData();
  }, []);

  // 3. AUTO-REFRESH LOGIC (Polls every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Checking for updates...");
      loadData();
    }, 1000); // Adjust to 2000 for faster or 5000 for slower updates

    return () => clearInterval(interval);
  }, []);
  
  
  useEffect(() => {
    setCourtOrder((prev) => reconcileCourtOrder(prev, selectedCourts));
  }, [selectedCourts]);

  const kingCourt = courtOrder[0];
  const bottomCourt = courtOrder[courtOrder.length - 1];
  const isDuprMode = mode === gameMode.DUPR;
  const activeCourts = isDuprMode ? selectedCourts : courtOrder;

  const duprRoundLabel = formatDuprPhaseLabel(duprState);

  const moveCourt = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...courtOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setCourtOrder(newOrder);
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  const isRoundOne = history.length === 0;

  const hasPlayedTogetherRecently = (p1: string, p2: string) =>
    hasPlayedTogetherInHistory(history, p1, p2);

  const generatePairings = (isFirst: boolean, roster: Player[], courts: string[]) => {
    const result = generateRoundPairings({
      isFirst,
      roster,
      courts,
      currentMatches,
      waitingPlayers,
      courtOrder,
      history,
    });

    setCurrentMatches(result.matches);
    setWaitingPlayers(result.waitingIds);
  };

  const handleSwap = (target: {courtId?: string, team?: 'A'|'B', index?: number, isWaitlist?: boolean, pId?: string}) => {
    if (!isEditMode || !swapSelection) return;
    if (!isRoundOne && (swapSelection.courtId !== target.courtId || swapSelection.isWaitlist || target.isWaitlist)) {
      alert("From Round 2, players can only be swapped within the same court.");
      setSwapSelection(null);
      return;
    }
    const newMatches = JSON.parse(JSON.stringify(currentMatches));
    const newWaiting = [...waitingPlayers];
    const p1 = swapSelection.isWaitlist ? swapSelection.pId! : newMatches[swapSelection.courtId!][swapSelection.team === 'A' ? 'teamA' : 'teamB'][swapSelection.index!];
    const p2 = target.isWaitlist ? target.pId! : newMatches[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!];
    if (swapSelection.isWaitlist) newWaiting[newWaiting.indexOf(p1)] = p2;
    else newMatches[swapSelection.courtId!][swapSelection.team === 'A' ? 'teamA' : 'teamB'][swapSelection.index!] = p2;
    if (target.isWaitlist) newWaiting[newWaiting.indexOf(p2)] = p1;
    else newMatches[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!] = p1;
    setCurrentMatches(newMatches);
    setWaitingPlayers(newWaiting);
    setSwapSelection(null);
  };

  // --- UPDATED LEADERBOARD LOGIC ---
  const getLeaderboard = () => calculateLeaderboard({ players, history, kingCourt });
  const duprStandings = duprState ? getDuprStandings(duprState) : [];
  const duprFinalLeaderboard = duprState ? getDuprFinalLeaderboard(duprState) : [];

  useEffect(() => {
  if (tournamentFinished) {
    // Fire once immediately
    firePodiumConfetti();
    
    // Optional: Fire a second "burst" 2 seconds later for extra hype
    const timer = setTimeout(() => {
      firePodiumConfetti();
    }, 2000);

    return () => clearTimeout(timer);
  }
}, [tournamentFinished]);

  if (tournamentFinished) {
    const stats = isDuprMode
      ? duprFinalLeaderboard.map((entry) => ({ name: entry.teamName, winCount: entry.wins }))
      : getLeaderboard();
    const grouped = stats.reduce((acc, curr) => {
      if (!acc[curr.winCount]) acc[curr.winCount] = [];
      acc[curr.winCount].push(curr.name);
      return acc;
    }, {} as Record<number, string[]>);
    const sortedScores = Object.keys(grouped).map(Number).sort((a, b) => b - a);
    const podium = [
      { names: grouped[sortedScores[0]] || [], score: sortedScores[0] || 0 },
      { names: grouped[sortedScores[1]] || [], score: sortedScores[1] || 0 },
      { names: grouped[sortedScores[2]] || [], score: sortedScores[2] || 0 },
    ];

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start text-white p-2 pt-10 font-sans overflow-y-auto">
        <h1 className="text-[70px] font-black italic text-amber-400 uppercase tracking-tighter text-center">Winner</h1>
        <div className="text-[100px]">🏆</div>
        <div className="flex flex-col md:flex-row mb-40 items-end justify-center gap-6 w-full max-w-5xl pb-10">
          {podium[0].names.length > 0 && (
            <div className="flex flex-col items-center w-full md:w-1/3 order-1 md:order-2">
              <div className="text-center mb-10 min-h-[100px] flex flex-col justify-end">
                {podium[0].names.map(n => 
                <div key={n} 
                className="kahoot-wiggle font-black text-[100px] uppercase text-amber-400 leading-tight" 
                style={{ 
                    animationDelay: `${0}s` 
                  }}
                > {capitalize(n)}</div>)}
                <div className="text-[30px] font-black text-amber-600 mt-4">
                  {isDuprMode ? 'KNOCKOUT CHAMPION' : `${podium[0].score} WINS`}
                </div>
              </div>
              <div className="bg-amber-600 w-full max-w-[180px] h-64 rounded-t-3xl border-t-8 border-amber-300 shadow-[0_0_60px_rgba(245,158,11,0.4)] flex items-center justify-center text-[200px] font-black text-amber-200">1</div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto p-2 lg:p-5">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-2">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            {isDuprMode ? duprRoundLabel : formatRallyRoundLabel(history.length + 1)}
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {isDuprMode ? `Mode: ${mode}` : `King: Court ${kingCourt} • Bottom: Court ${bottomCourt}`}
          </p>
        </div>
        
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-10">
        <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          {activeCourts.map((cId) => {
            const m = currentMatches[cId];
            if (!m) {
              return (
                <div key={cId} className="h-fit rounded-[32px] border-2 border-dashed border-slate-300 overflow-hidden bg-white">
                  <div className="px-4 text-[40px] text-center font-black uppercase tracking-widest bg-slate-200 text-slate-700">
                    Court {cId}
                  </div>
                  <div className="p-12 text-center">
                    <p className="text-[24px] font-black uppercase tracking-widest text-slate-400">Waiting For Next Match</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={cId} className={`h-fit rounded-[32px] border-2 transition overflow-hidden shadow-sm ${cId === kingCourt ? 'border-slate-100' : 'border-slate-100'}`} style={{ backgroundColor: '#e5f5e0' }}>
                {/* Court Header */}
                <div className={`px-4 text-[40px] text-center font-black uppercase tracking-widest ${cId === kingCourt ? 'bg-amber-400 text-white' : 'bg-slate-800 text-white'}`} style={{ backgroundColor: cId === kingCourt ? '#9a9ff7' : '#006d2c', color: cId === kingCourt ? '#ffffff' : '#ffffff' }}>
                  Court {cId} {cId === kingCourt ? '- King Court' : cId === bottomCourt ? '⬇️' : ''}
                </div>

                {/* Match Grid Area */}
                <div className="p-3 relative">
                  {/* The Central "VS" Badge */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="bg-white px-3 py-1 rounded-full border-2 border-slate-100 text-[15px] font-black text-slate-400 italic shadow-sm">
                      VS
                    </div>
                  </div>

                  {/* The 2x2 Layout */}
                  <div className="grid grid-cols-2 gap-10">
                    {['A', 'B'].map((teamKey) => {
                      const team = teamKey === 'A' ? m.teamA : m.teamB;
                      return (
                        <div 
                          key={teamKey} 
                          className={`flex flex-col gap-0 rounded-2xl border-2 border-slate-100 transition cursor-pointer ${
                            m.winner === teamKey ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-transparent hover:border-slate-200'
                          }`}
                        >
                          {team.map((pId, idx) => {
                            const active = swapSelection?.courtId === cId && swapSelection.team === teamKey && swapSelection.index === idx;
                            const disabled = !isRoundOne && swapSelection && swapSelection.courtId !== cId;
                            
                            return (
                              <span 
                                key={idx} 
                                onClick={(e) => {
                                  if(isEditMode && !disabled){ 
                                    e.stopPropagation(); 
                                    if(!swapSelection) setSwapSelection({courtId: cId, team: teamKey as 'A'|'B', index: idx}); 
                                    else handleSwap({courtId: cId, team: teamKey as 'A'|'B', index: idx}); 
                                  }
                                }}
                                className={`w-full text-center text-[40px] py-4 rounded-xl font-bold break-words overflow-wrap-anywhere whitespace-normal transition-all ${
                                  isEditMode ? 'bg-orange-100 text-orange-800' : 'text-slate-800'
                                } ${active ? 'bg-orange-600 text-white shadow-md' : ''} ${
                                  disabled ? 'opacity-20 grayscale' : ''
                                }`}
                              >
                                {capitalize(pId)}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="space-y-6 w-full">

          <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-[30px] text-amber-300 font-black italic mb-2 tracking-tighter text-center" >Leaderboard</h2>
            <div className="space-y-4">
              {isDuprMode
                ? duprFinalLeaderboard.slice(0, 5).map((entry, i) => (
                    <div key={entry.teamId} className="flex text-[25px] justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white">{i + 1}. {entry.teamName}</span>
                      <span className="font-bold text-white">{entry.wins}-{entry.losses}</span>
                    </div>
                  ))
                : getLeaderboard().slice(0, 5).map((e, i) => (
                    <div key={e.name} className="flex text-[25px] justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white">{i + 1}. {capitalize(e.name)}</span>
                      <span className="font-bold text-white">{e.winCount}</span>
                    </div>
                  ))}
            </div>
          </div>
          
        </aside>
      </div>

      {/* --- HISTORY LOG MODAL --- */}

    </div>
  );
}
