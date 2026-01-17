'use client';

import React, { useState, useMemo, useEffect } from 'react';

// --- TYPES ---
export interface Player {
  id: string;
  name: string;
  rating: number;
}

export interface Match {
  teamA: string[]; // Player IDs
  teamB: string[]; // Player IDs
  winner: 'A' | 'B' | null;
}

export interface Round {
  id: number;
  matches: Record<string, Match>;
  waiting: string[];
}

export default function KotcApp() {
  // --- PERSISTENCE STATE ---
  const [isHydrated, setIsHydrated] = useState(false);

  // --- UI STATE ---
  const [setupComplete, setSetupComplete] = useState(false);
  const [tournamentFinished, setTournamentFinished] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [swapSelection, setSwapSelection] = useState<{
    courtId?: string, 
    team?: 'A'|'B', 
    index?: number, 
    isWaitlist?: boolean, 
    pId?: string
  } | null>(null);
  
  // --- CONFIG STATE ---
  const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
  const [selectedCourts, setSelectedCourts] = useState<string[]>(['1', '2', '3']);
  const [kingCourt, setKingCourt] = useState<string>('1');
  const [bottomCourt, setBottomCourt] = useState<string>('3');

  // --- DATA STATE ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<string[]>([]);
  const [currentMatches, setCurrentMatches] = useState<Record<string, Match>>({});
  const [history, setHistory] = useState<Round[]>([]);
  const [bulkInput, setBulkInput] = useState('');

  // --- LOCAL STORAGE: LOAD ---
  useEffect(() => {
    const saved = localStorage.getItem('kotc_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSetupComplete(data.setupComplete);
        setTournamentFinished(data.tournamentFinished);
        setSelectedCourts(data.selectedCourts);
        setKingCourt(data.kingCourt);
        setBottomCourt(data.bottomCourt);
        setPlayers(data.players);
        setWaitingPlayers(data.waitingPlayers);
        setCurrentMatches(data.currentMatches);
        setHistory(data.history);
        setBulkInput(data.bulkInput);
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
    setIsHydrated(true);
  }, []);

  // --- LOCAL STORAGE: SAVE ---
  useEffect(() => {
    if (isHydrated) {
      const stateToSave = {
        setupComplete,
        tournamentFinished,
        selectedCourts,
        kingCourt,
        bottomCourt,
        players,
        waitingPlayers,
        currentMatches,
        history,
        bulkInput
      };
      localStorage.setItem('kotc_session', JSON.stringify(stateToSave));
    }
  }, [setupComplete, tournamentFinished, selectedCourts, kingCourt, bottomCourt, players, waitingPlayers, currentMatches, history, bulkInput, isHydrated]);

  // --- DERIVED LOGIC & HELPERS ---
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  
  const isRoundOne = history.length === 0;

  const sortedSelectedCourts = useMemo(() => {
    return [...selectedCourts].sort((a, b) => parseInt(a) - parseInt(b));
  }, [selectedCourts]);

  const orderedCourts = useMemo(() => {
    const others = selectedCourts.filter(c => c !== kingCourt && c !== bottomCourt)
                                 .sort((a, b) => parseInt(a) - parseInt(b));
    return [kingCourt, ...others, bottomCourt];
  }, [selectedCourts, kingCourt, bottomCourt]);

  const hasPlayedTogether = (p1: string, p2: string) => {
    return history.some(round => {
      return Object.values(round.matches).some(m => {
        return (m.teamA.includes(p1) && m.teamA.includes(p2)) || 
               (m.teamB.includes(p1) && m.teamB.includes(p2));
      });
    });
  };

  // --- CORE ENGINE: ROTATION ---
  const generatePairings = (isFirst: boolean, roster: Player[], courts: string[]) => {
    const needed = courts.length * 4;
    let playingIds: string[] = [];
    let waitingIds: string[] = [];

    if (isFirst) {
      const sortedByRating = [...roster].sort((a, b) => a.rating - b.rating);
      const sortedIds = sortedByRating.map(p => p.id);
      playingIds = sortedIds.slice(0, needed);
      waitingIds = sortedIds.slice(needed);
    } else {
      const lastRound = currentMatches;
      const lastWaiting = [...waitingPlayers];
      const rankedPool: string[][] = [];

      orderedCourts.forEach((cId) => {
        const m = lastRound[cId];
        const winT = m.winner === 'A' ? m.teamA : m.teamB;
        const loseT = m.winner === 'A' ? m.teamB : m.teamA;
        rankedPool.push(winT, loseT);
      });

      const newOrder: string[][] = [rankedPool[0]];
      for (let i = 1; i < orderedCourts.length; i++) {
        newOrder.push(rankedPool[i * 2]);
        newOrder.push(rankedPool[(i - 1) * 2 + 1]);
      }
      const bottomLosers = rankedPool[rankedPool.length - 1];
      const totalPool = [...newOrder.flat(), ...lastWaiting, ...bottomLosers];
      playingIds = totalPool.slice(0, needed);
      waitingIds = totalPool.slice(needed);
    }

    const newMatches: Record<string, Match> = {};
    orderedCourts.forEach((cId, i) => {
      const slice = playingIds.slice(i * 4, (i + 1) * 4);
      newMatches[cId] = { teamA: [slice[0], slice[3]], teamB: [slice[1], slice[2]], winner: null };
    });
    setCurrentMatches(newMatches);
    setWaitingPlayers(waitingIds);
  };

  const handleSwap = (target: {courtId?: string, team?: 'A'|'B', index?: number, isWaitlist?: boolean, pId?: string}) => {
    if (!isEditMode || !swapSelection) return;

    // Logic: Round 1 allows free movement. Round 2+ restricts to same-court swaps only.
    const isSameCourt = swapSelection.courtId === target.courtId;
    const involvesWaitlist = swapSelection.isWaitlist || target.isWaitlist;

    if (!isRoundOne && (!isSameCourt || involvesWaitlist)) {
      alert("From Round 2 onwards, players can only be swapped within the same court.");
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

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousHistory = [...history];
    const lastCompletedRound = previousHistory.pop();
    if (lastCompletedRound) {
      setCurrentMatches(lastCompletedRound.matches);
      setWaitingPlayers(lastCompletedRound.waiting);
      setHistory(previousHistory);
    }
  };

  const getLeaderboard = () => {
    const wins: Record<string, number> = {};
    players.forEach(p => wins[p.id] = 0);
    history.forEach((round, index) => {
      if (index >= 1) { 
        const kingMatch = round.matches[kingCourt];
        if (kingMatch?.winner) {
          const winners = kingMatch.winner === 'A' ? kingMatch.teamA : kingMatch.teamB;
          winners.forEach(wId => wins[wId] = (wins[wId] || 0) + 1);
        }
      }
    });
    return Object.entries(wins).map(([id, winCount]) => ({ 
      name: players.find(p => p.id === id)?.name || id, winCount 
    })).sort((a, b) => b.winCount - a.winCount);
  };

  const handleReset = () => {
    if (confirm("Reset everything? All current progress and history will be lost.")) {
      localStorage.removeItem('kotc_session');
      location.reload();
    }
  };

  if (!isHydrated) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black italic text-slate-300 tracking-widest">LOADING...</div>;

  // --- VIEW: PODIUM ---
  if (tournamentFinished) {
    const stats = getLeaderboard();
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 font-sans">
        <h1 className="text-5xl font-black italic mb-12 text-amber-400 uppercase tracking-tighter text-center">Final Standings</h1>
        <div className="flex items-end gap-3 h-80">
          {stats[1] && <div className="flex flex-col items-center"><span className="font-bold mb-2 uppercase">{capitalize(stats[1].name)}</span><div className="bg-slate-700 w-32 h-48 rounded-t-3xl border-t-8 border-slate-400"></div></div>}
          {stats[0] && <div className="flex flex-col items-center scale-110"><span className="font-black text-xl mb-2 text-amber-400 uppercase">👑 {capitalize(stats[0].name)}</span><div className="bg-amber-600 w-40 h-72 rounded-t-3xl border-t-8 border-amber-300"></div></div>}
          {stats[2] && <div className="flex flex-col items-center"><span className="font-bold mb-2 uppercase">{capitalize(stats[2].name)}</span><div className="bg-orange-900 w-32 h-32 rounded-t-3xl border-t-8 border-orange-600"></div></div>}
        </div>
        <button onClick={handleReset} className="mt-12 px-10 py-4 bg-white text-black font-black rounded-full shadow-lg transition-transform hover:scale-105">New Session</button>
      </div>
    );
  }

  // --- VIEW: SETUP ---
  if (!setupComplete) {
    return (
      <div className="max-w-2xl mx-auto p-6 py-20 space-y-8">
        <h1 className="text-5xl font-black text-center italic tracking-tighter text-slate-900 uppercase">Setup</h1>
        <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 space-y-6">
          <div className="grid grid-cols-4 gap-2">
            {availableCourts.map(c => (
              <button key={c} onClick={() => setSelectedCourts(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
                className={`py-4 rounded-2xl font-black transition ${selectedCourts.includes(c) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>C{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select value={kingCourt} onChange={e => setKingCourt(e.target.value)} className="p-4 bg-slate-50 rounded-2xl font-bold ring-2 ring-amber-400 outline-none">
              {sortedSelectedCourts.map(c => <option key={c} value={c}>King: Court {c}</option>)}
            </select>
            <select value={bottomCourt} onChange={e => setBottomCourt(e.target.value)} className="p-4 bg-slate-50 rounded-2xl font-bold ring-2 ring-slate-100 outline-none">
              {sortedSelectedCourts.map(c => <option key={c} value={c}>Bottom: Court {c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 ml-4">PLAYER LIST (NAME, RATING)</label>
            <textarea rows={6} value={bulkInput} placeholder="Ex: Roger, 5.0&#10;John, 3.5"
                onChange={e => {
                  setBulkInput(e.target.value);
                  const lines = e.target.value.split('\n').filter(s => s.trim());
                  setPlayers(lines.map(line => {
                    const [name, rating] = line.split(',');
                    return { id: name.trim(), name: name.trim(), rating: parseFloat(rating) || 3.5 };
                  }));
                }}
                className="w-full p-6 bg-slate-50 rounded-[30px] border-none font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600" 
            />
          </div>
          <button disabled={players.length < selectedCourts.length * 4}
            onClick={() => { generatePairings(true, players, selectedCourts); setSetupComplete(true); }}
            className="w-full py-6 bg-indigo-600 text-white font-black text-xl rounded-full shadow-xl transition-all hover:bg-indigo-700 disabled:bg-slate-200">START</button>
        </div>
      </div>
    );
  }

  // --- VIEW: MAIN TRACKER ---
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-10">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Round {history.length + 1}</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">King: C{kingCourt} • Bottom: C{bottomCourt}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistoryModal(true)} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200">LOG</button>
          <button onClick={() => { setIsEditMode(!isEditMode); setSwapSelection(null); }}
            className={`px-6 py-2 rounded-xl font-bold transition ${isEditMode ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>{isEditMode ? 'FINISH SWAP' : 'SWAP'}</button>
          <button onClick={() => setTournamentFinished(true)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700">FINISH</button>
          <button onClick={handleReset} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-xs border border-red-100">RESET</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedCourts.map((cId) => {
            const m = currentMatches[cId];
            const isK = cId === kingCourt;
            const isB = cId === bottomCourt;

            return (
              <div key={cId} className={`bg-white rounded-[32px] border-2 transition overflow-hidden ${isK ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-100'}`}>
                <div className={`py-2 px-4 text-xs font-black uppercase tracking-widest ${isK ? 'bg-amber-400' : isB ? 'bg-slate-200' : 'bg-slate-800 text-white'}`}>
                  Court {cId} {isK ? '👑' : isB ? '⬇️' : ''}
                </div>
                <div className="p-6 space-y-4">
                  {['A', 'B'].map((teamKey) => {
                    const team = teamKey === 'A' ? m.teamA : m.teamB;
                    const alert = hasPlayedTogether(team[0], team[1]);
                    return (
                      <div key={teamKey} className="relative">
                        <div onClick={() => !isEditMode && setCurrentMatches({...currentMatches, [cId]: {...m, winner: teamKey as 'A'|'B'}})}
                          className={`flex gap-2 p-4 rounded-2xl border-2 transition cursor-pointer ${m.winner === teamKey ? 'bg-indigo-50 border-indigo-500 shadow-inner' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                          {team.map((pId, idx) => {
                            const active = swapSelection?.courtId === cId && swapSelection.team === teamKey && swapSelection.index === idx;
                            const isDisabledInEdit = !isRoundOne && swapSelection && swapSelection.courtId !== cId;
                            
                            return (
                              <span key={idx} 
                                onClick={(e) => { 
                                  if(isEditMode && !isDisabledInEdit){ 
                                    e.stopPropagation(); 
                                    if(!swapSelection) setSwapSelection({courtId: cId, team: teamKey as 'A'|'B', index: idx}); 
                                    else handleSwap({courtId: cId, team: teamKey as 'A'|'B', index: idx}); 
                                  }
                                }}
                                className={`flex-1 text-center py-2 rounded-lg font-bold truncate uppercase transition-all
                                  ${isEditMode ? 'bg-orange-100 text-orange-800 cursor-pointer hover:bg-orange-200' : ''} 
                                  ${active ? 'bg-orange-600 text-white shadow-md scale-105' : ''}
                                  ${isDisabledInEdit ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}>
                                {capitalize(pId)}
                              </span>
                            );
                          })}
                        </div>
                        {alert && (
                          <div className="absolute -top-2 -right-1 bg-red-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm z-10">RE-PARTNERED</div>
                        )}
                        {teamKey === 'A' && <div className="text-center text-[10px] font-black text-slate-300 py-1 italic">VS</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          <div className="md:col-span-2 flex gap-4 mt-6">
            <button onClick={handleUndo} disabled={history.length === 0}
              className="flex-1 py-6 bg-slate-100 text-slate-400 font-black text-xl rounded-3xl disabled:opacity-30">UNDO</button>
            <button disabled={!Object.values(currentMatches).every(m => m.winner) || isEditMode}
              onClick={() => { 
                setHistory([...history, { id: history.length, matches: {...currentMatches}, waiting: [...waitingPlayers] }]); 
                generatePairings(false, players, selectedCourts); 
                window.scrollTo({ top: 0, behavior: 'smooth' }); 
              }}
              className="flex-[2] py-6 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-xl transition-transform active:scale-95 disabled:bg-slate-200">NEXT ROUND →</button>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-2xl font-black italic mb-6 tracking-tighter uppercase text-center">Leaderboard</h2>
            <div className="space-y-4">
              {getLeaderboard().slice(0, 8).map((e, i) => (
                <div key={e.name} className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-400 uppercase">{i+1}. {capitalize(e.name)}</span>
                  <span className="text-amber-400 font-bold">{e.winCount}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-500 font-black mt-4 text-center uppercase tracking-widest italic opacity-60">Wins counted from Round 2</p>
          </div>
          
          <div className={`bg-slate-50 p-8 rounded-[40px] border-2 border-slate-100 transition-opacity ${!isRoundOne && isEditMode ? 'opacity-40' : ''}`}>
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Waitlist</h3>
             <div className="flex flex-col gap-2">
                {waitingPlayers.map((p, i) => (
                  <button key={p} 
                    disabled={!isRoundOne && isEditMode}
                    onClick={() => { 
                      if(isEditMode) { 
                        if(!swapSelection) setSwapSelection({isWaitlist: true, pId: p}); 
                        else handleSwap({isWaitlist: true, pId: p}); 
                      }
                    }}
                    className={`p-4 rounded-2xl font-bold text-left bg-white shadow-sm border border-slate-100 uppercase transition-all 
                      ${swapSelection?.pId === p ? 'bg-orange-600 text-white' : 'text-slate-700'}
                      ${!isRoundOne && isEditMode ? 'cursor-not-allowed' : 'hover:border-indigo-200'}`}>
                    {i+1}. {capitalize(p)}
                  </button>
                ))}
             </div>
          </div>
        </aside>
      </div>

      {/* MODAL: MATCH LOG */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-10 shadow-2xl">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black italic uppercase">Match Log</h2>
              <button onClick={() => setShowHistoryModal(false)} className="bg-slate-100 px-6 py-2 rounded-full font-bold hover:bg-slate-200">CLOSE</button>
            </div>
            {history.length === 0 ? (
              <p className="text-center font-bold text-slate-300 py-20 uppercase tracking-widest">No rounds completed yet</p>
            ) : (
              history.map((round, idx) => (
                <div key={idx} className="mb-10 border-b border-slate-100 pb-6 last:border-0">
                  <h3 className="font-black text-indigo-600 text-lg mb-4 uppercase">Round {idx + 1} {idx === 0 && <span className="text-slate-300 text-xs ml-2 normal-case">(Seeding)</span>}</h3>
                  {Object.entries(round.matches).map(([cId, m]) => (
                    <div key={cId} className="flex flex-wrap justify-between items-center text-sm py-2">
                      <span className="font-black text-slate-400 w-20 uppercase">Court {cId}</span>
                      <span className={`flex-1 text-right pr-4 uppercase ${m.winner === 'A' ? 'font-black text-indigo-600' : 'text-slate-400'}`}>{m.teamA.map(capitalize).join(' & ')}</span>
                      <span className="text-[10px] font-black text-slate-200 mx-2">VS</span>
                      <span className={`flex-1 text-left pl-4 uppercase ${m.winner === 'B' ? 'font-black text-indigo-600' : 'text-slate-400'}`}>{m.teamB.map(capitalize).join(' & ')}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}