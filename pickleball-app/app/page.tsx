'use client';

import React, { useState, useMemo, useEffect } from 'react';

// --- TYPES ---
export interface Player {
  id: string;
  name: string;
  rating: number;
}

export interface Match {
  teamA: string[];
  teamB: string[];
  winner: 'A' | 'B' | null;
}

export interface Round {
  id: number;
  matches: Record<string, Match>;
  waiting: string[];
}

export default function KotcApp() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [tournamentFinished, setTournamentFinished] = useState(false);
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

  useEffect(() => {
    const saved = localStorage.getItem('kotc_session');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setSetupComplete(data.setupComplete);
        setTournamentFinished(data.tournamentFinished);
        setSelectedCourts(data.selectedCourts);
        setCourtOrder(data.courtOrder || data.selectedCourts);
        setPlayers(data.players);
        setWaitingPlayers(data.waitingPlayers);
        setCurrentMatches(data.currentMatches);
        setHistory(data.history);
        setBulkInput(data.bulkInput);
      } catch (e) { console.error(e); }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      const state = { setupComplete, tournamentFinished, selectedCourts, courtOrder, players, waitingPlayers, currentMatches, history, bulkInput };
      localStorage.setItem('kotc_session', JSON.stringify(state));
    }
  }, [setupComplete, tournamentFinished, selectedCourts, courtOrder, players, waitingPlayers, currentMatches, history, bulkInput, isHydrated]);

  useEffect(() => {
    setCourtOrder(prev => {
      const newBase = selectedCourts.filter(c => prev.includes(c));
      const added = selectedCourts.filter(c => !prev.includes(c));
      return [...newBase, ...added];
    });
  }, [selectedCourts]);

  const kingCourt = courtOrder[0];
  const bottomCourt = courtOrder[courtOrder.length - 1];

  const moveCourt = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...courtOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setCourtOrder(newOrder);
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  const isRoundOne = history.length === 0;

  const getPartnershipCount = (p1: string, p2: string) => {
    let count = 0;
    history.forEach(round => {
      Object.values(round.matches).forEach(m => {
        if ((m.teamA.includes(p1) && m.teamA.includes(p2)) || (m.teamB.includes(p1) && m.teamB.includes(p2))) count++;
      });
    });
    return count;
  };

  const hasPlayedTogetherRecently = (p1: string, p2: string) => {
    if (history.length === 0) return false;
    const lastRound = history[history.length - 1];
    return Object.values(lastRound.matches).some(m => (m.teamA.includes(p1) && m.teamA.includes(p2)) || (m.teamB.includes(p1) && m.teamB.includes(p2)));
  };

  const generatePairings = (isFirst: boolean, roster: Player[], courts: string[]) => {
    const needed = courts.length * 4;
    let playingIds: string[] = [];
    let waitingIds: string[] = [];

    if (isFirst) {
      const sortedIds = [...roster].sort((a, b) => a.rating - b.rating).map(p => p.id);
      playingIds = sortedIds.slice(0, needed);
      waitingIds = sortedIds.slice(needed);
    } else {
      const lastRound = currentMatches;
      const lastWaiting = [...waitingPlayers];
      const rankedPool: string[][] = [];
      courtOrder.forEach((cId) => {
        const m = lastRound[cId];
        rankedPool.push(m.winner === 'A' ? m.teamA : m.teamB);
        rankedPool.push(m.winner === 'A' ? m.teamB : m.teamA);
      });
      const newOrder: string[][] = [rankedPool[0]];
      for (let i = 1; i < courtOrder.length; i++) {
        newOrder.push(rankedPool[i * 2], rankedPool[(i - 1) * 2 + 1]);
      }
      const totalPool = [...newOrder.flat(), ...lastWaiting, ...rankedPool[rankedPool.length - 1]];
      playingIds = totalPool.slice(0, needed);
      waitingIds = totalPool.slice(needed);
    }

    const newMatches: Record<string, Match> = {};
    courtOrder.forEach((cId, i) => {
      const p = playingIds.slice(i * 4, (i + 1) * 4);
      const combos = [
        { teamA: [p[0], p[3]], teamB: [p[1], p[2]] },
        { teamA: [p[0], p[2]], teamB: [p[1], p[3]] },
        { teamA: [p[0], p[1]], teamB: [p[2], p[3]] }
      ];
      const scored = combos.map(c => ({
        ...c,
        score: (hasPlayedTogetherRecently(c.teamA[0], c.teamA[1]) ? 100 : 0) + (hasPlayedTogetherRecently(c.teamB[0], c.teamB[1]) ? 100 : 0) + getPartnershipCount(c.teamA[0], c.teamA[1]) + getPartnershipCount(c.teamB[0], c.teamB[1])
      })).sort((a, b) => a.score - b.score);
      newMatches[cId] = { ...scored[0], winner: null };
    });
    setCurrentMatches(newMatches);
    setWaitingPlayers(waitingIds);
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
  const getLeaderboard = () => {
    const wins: Record<string, number> = {};
    players.forEach(p => wins[p.id] = 0);
    
    history.forEach((round, index) => {
      // index 0 = Round 1 (Ignore)
      // index 1 = Round 2, index 2 = Round 3, etc.
      if (index >= 1) { 
        const km = round.matches[kingCourt];
        if (km?.winner) {
          const winners = km.winner === 'A' ? km.teamA : km.teamB;
          winners.forEach(wId => {
            wins[wId] = (wins[wId] || 0) + 1;
          });
        }
      }
    });
    return Object.entries(wins).map(([id, winCount]) => ({ 
      name: players.find(p => p.id === id)?.name || id, 
      winCount 
    })).sort((a, b) => b.winCount - a.winCount);
  };

  if (tournamentFinished) {
    const stats = getLeaderboard();
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start text-white p-6 pt-20 font-sans overflow-y-auto">
        <h1 className="text-5xl font-black italic mb-20 text-amber-400 uppercase tracking-tighter text-center">Final Standings</h1>
        <div className="flex flex-col md:flex-row items-end justify-center gap-6 w-full max-w-5xl pb-10">
          {podium[1].names.length > 0 && (
            <div className="flex flex-col items-center w-full md:w-1/3 order-2 md:order-1">
              <div className="text-center mb-4 min-h-[60px] flex flex-col justify-end">
                {podium[1].names.map(n => <div key={n} className="font-bold uppercase text-slate-300 text-sm">{capitalize(n)}</div>)}
                <div className="text-xs font-black text-slate-500 mt-1">{podium[1].score} WINS</div>
              </div>
              <div className="bg-slate-700 w-full max-w-[150px] h-40 rounded-t-3xl border-t-8 border-slate-400 flex items-center justify-center text-4xl font-black text-slate-400">2</div>
            </div>
          )}
          {podium[0].names.length > 0 && (
            <div className="flex flex-col items-center w-full md:w-1/3 order-1 md:order-2">
              <div className="text-center mb-4 min-h-[100px] flex flex-col justify-end">
                {podium[0].names.map(n => <div key={n} className="font-black uppercase text-amber-400 text-xl leading-tight">👑 {capitalize(n)}</div>)}
                <div className="text-sm font-black text-amber-600 mt-2">{podium[0].score} WINS</div>
              </div>
              <div className="bg-amber-600 w-full max-w-[180px] h-64 rounded-t-3xl border-t-8 border-amber-300 shadow-[0_0_60px_rgba(245,158,11,0.4)] flex items-center justify-center text-7xl font-black text-amber-200">1</div>
            </div>
          )}
          {podium[2].names.length > 0 && (
            <div className="flex flex-col items-center w-full md:w-1/3 order-3">
              <div className="text-center mb-4 min-h-[60px] flex flex-col justify-end">
                {podium[2].names.map(n => <div key={n} className="font-bold uppercase text-orange-400 text-sm">{capitalize(n)}</div>)}
                <div className="text-xs font-black text-orange-600 mt-1">{podium[2].score} WINS</div>
              </div>
              <div className="bg-orange-900 w-full max-w-[150px] h-24 rounded-t-3xl border-t-8 border-orange-600 flex items-center justify-center text-3xl font-black text-orange-700">3</div>
            </div>
          )}
        </div>
          <div className="flex flex-col sm:flex-row gap-4 my-12">
          <button 
            onClick={() => setTournamentFinished(false)} 
            className="px-10 py-5 border-2 border-white/20 text-white font-black rounded-full hover:bg-white/10 transition-all uppercase tracking-widest text-lg"
          >
            Back to Tournament
          </button>
          
          <button 
            onClick={() => {if(confirm("Start a brand new session? This clears all data.")){localStorage.removeItem('kotc_session'); location.reload();}}} 
            className="px-12 py-5 bg-white text-black font-black rounded-full shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest text-lg"
          >
            New Session
          </button>
        </div>
      </div>
      
    );
  }

  if (!setupComplete) {
    return (
      <div className="max-w-4xl mx-auto p-6 py-12 space-y-12 bg-white">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 uppercase">Tournament Setup</h1>
          <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.3em]">Configure your session</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Court Config */}
          <div className="space-y-8">
            <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">1. Active Courts</h3>
              <div className="grid grid-cols-4 gap-2">
                {availableCourts.map(c => (
                  <button key={c} onClick={() => setSelectedCourts(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
                    className={`py-3 rounded-xl font-black transition ${selectedCourts.includes(c) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">2. Hierarchy</h3>
              <div className="space-y-2">
                {courtOrder.map((c, i) => (
                  <div key={c} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-black text-sm uppercase">Court {c} {i === 0 ? '👑' : ''}</span>
                    <div className="flex gap-1">
                      <button onClick={() => moveCourt(i, 'up')} disabled={i === 0} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg disabled:opacity-0 text-xs">↑</button>
                      <button onClick={() => moveCourt(i, 'down')} disabled={i === courtOrder.length - 1} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg disabled:opacity-0 text-xs">↓</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Advanced Player Input */}
<div className="space-y-6">
  <section className="bg-white p-6 rounded-[32px] border-2 border-slate-900 shadow-[8px_8px_0px_rgba(15,23,42,1)]">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">3. Roster</h3>
      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${players.length >= selectedCourts.length * 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {players.length} / {selectedCourts.length * 4} PLAYERS
      </span>
    </div>

    {/* Quick Add / Bulk Paste */}
    <div className="space-y-2 mb-6">
      <textarea 
        rows={3} 
        value={bulkInput} 
        placeholder="Paste names (e.g. Mike, Sarah, John)"
        onChange={e => {
          setBulkInput(e.target.value);
          const lines = e.target.value.split(/[\n," "]+/).filter(s => s.trim());
          const newPlayers = lines.map(line => {
            const parts = line.split(':'); // Support "Name:Rating"
            const name = parts[0].trim();
            const rating = parseFloat(parts[1]) || 3.5;
            return { id: name, name, rating };
          });
          setPlayers(newPlayers);
        }}
        className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600" 
      />
      <p className="text-[9px] text-slate-400 font-bold px-2 uppercase tracking-tight">Pro tip: Use "Name : Rating" to paste with levels</p>
    </div>

    {/* Visual Player List with Manual Rating Input */}
<div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
  {players.map((p, idx) => (
    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors">
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-black text-slate-700 truncate text-sm uppercase leading-tight">{p.name}</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Player {idx + 1}</span>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Manual Rating Input Box */}
        <div className="flex flex-col items-end">
          <label className="text-[8px] font-black text-slate-400 uppercase mb-1 mr-1">Rating</label>
          <input 
            type="number" 
            step="0.01"
            value={p.rating}
            onChange={(e) => {
              const newVal = parseFloat(e.target.value);
              const next = [...players];
              // Update only if it's a valid number, otherwise keep as is for typing
              next[idx].rating = isNaN(newVal) ? 0 : newVal;
              setPlayers(next);
            }}
            className="w-20 px-2 py-1.5 bg-white border-2 border-slate-200 rounded-lg text-xs font-black text-indigo-600 outline-none focus:border-indigo-600 text-center shadow-sm"
          />
        </div>

        {/* Remove Player Button */}
        <button 
          onClick={() => {
            const next = players.filter((_, i) => i !== idx);
            setPlayers(next);
            setBulkInput(next.map(pl => `${pl.name}:${pl.rating}`).join('\n'));
          }}
          className="w-9 h-9 mt-4 flex items-center justify-center bg-white text-red-500 rounded-lg border border-slate-200 hover:bg-red-500 hover:text-white transition-all shadow-sm"
          title="Remove Player"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  ))}
  
  {players.length === 0 && (
    <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
      <p className="text-xs font-black text-slate-300 uppercase italic">Waiting for player data...</p>
    </div>
  )}
</div>
      

  </section>

  <button 
    disabled={players.length < selectedCourts.length * 4}
    onClick={() => { generatePairings(true, players, selectedCourts); setSetupComplete(true); }}
    className="w-full py-6 bg-indigo-600 text-white font-black text-xl rounded-2xl shadow-xl transition-all hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 uppercase tracking-widest"
  >
    Start Tournament
  </button>
</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-10">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Round {history.length + 1}</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">King: Court {kingCourt} • Bottom: Court {bottomCourt}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistoryModal(true)} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">LOG</button>
          <button onClick={() => { setIsEditMode(!isEditMode); setSwapSelection(null); }}
            className={`px-6 py-2 rounded-xl font-bold transition ${isEditMode ? 'bg-orange-400 hover:bg-orange-500 text-white shadow-lg transition' : 'hover:bg-slate-200 bg-slate-100 text-slate-600 transition'}`}>{isEditMode ? 'FINISH SWAP' : 'SWAP'}</button>
          <button onClick={() => setTournamentFinished(true)} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-emerald-500 hover:text-white transition ">FINISH</button>
          <button onClick={() => {if(confirm("R U Sure, Reset?")) {localStorage.removeItem('kotc_session'); location.reload();}}} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition rounded-xl font-black text-xs border border-red-100">RESET</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {courtOrder.map((cId) => {
            const m = currentMatches[cId];
            if (!m) return null;
            return (
              <div key={cId} className={`bg-white rounded-[32px] border-2 transition overflow-hidden ${cId === kingCourt ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-100'}`}>
                <div className={`py-2 px-4 text-[15px] text-center font-black uppercase tracking-widest ${cId === kingCourt ? 'bg-amber-400' : cId === bottomCourt ? 'bg-slate-200' : 'bg-slate-800 text-white'}`}>
                  Court {cId} {cId === kingCourt ? '👑' : cId === bottomCourt ? '⬇️' : ''}
                </div>
                <div className="p-6 space-y-4">
                  {['A', 'B'].map((teamKey) => {
                    const team = teamKey === 'A' ? m.teamA : m.teamB;
                    const isRepeat = hasPlayedTogetherRecently(team[0], team[1]);
                    return (
                      <div key={teamKey} className="relative">
                        <div onClick={() => !isEditMode && setCurrentMatches({...currentMatches, [cId]: {...m, winner: teamKey as 'A'|'B'}})}
                          className={`flex gap-2 p-4 rounded-2xl border-2 transition cursor-pointer ${m.winner === teamKey ? 'bg-indigo-50 border-indigo-500 shadow-inner' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                          {team.map((pId, idx) => {
                            const active = swapSelection?.courtId === cId && swapSelection.team === teamKey && swapSelection.index === idx;
                            const disabled = !isRoundOne && swapSelection && swapSelection.courtId !== cId;
                            return (
                              <span key={idx} onClick={(e) => {if(isEditMode && !disabled){ e.stopPropagation(); if(!swapSelection) setSwapSelection({courtId: cId, team: teamKey as 'A'|'B', index: idx}); else handleSwap({courtId: cId, team: teamKey as 'A'|'B', index: idx}); }}}
                                className={`flex-1 text-center text-[25px] py-2 rounded-lg font-bold truncate transition-all ${isEditMode ? 'bg-orange-100 text-orange-800' : ''} ${active ? 'bg-orange-600 text-white shadow-md' : ''} ${disabled ? 'opacity-20 grayscale' : ''}`}>
                                {capitalize(pId)}
                              </span>
                            );
                          })}
                        </div>
                        {isRepeat && <div className="absolute -top-2 -right-1 bg-red-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm z-10 uppercase">Repeat Partner</div>}
                        {teamKey === 'A' && <div className="text-center text-[10px] font-black text-slate-300 py-1 italic">VS</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <aside className="space-y-6">
          <div className="md:col-span-2 flex gap-4 mt-6">
            <button disabled={!Object.values(currentMatches).every(m => m.winner) || isEditMode}
              onClick={() => { setHistory([...history, { id: history.length, matches: {...currentMatches}, waiting: [...waitingPlayers] }]); generatePairings(false, players, selectedCourts); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex-[2] py-6 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-xl disabled:bg-slate-200 uppercase transition">Next Round →</button>
          </div>
          <div className="md:col-span-2 flex gap-4 mt-6">
            <button onClick={() => {if(history.length > 0){ const ph = [...history]; const last = ph.pop(); if(last){ setCurrentMatches(last.matches); setWaitingPlayers(last.waiting); setHistory(ph); }}}} disabled={history.length === 0} className="flex-1 py-6 bg-slate-400 text-white font-black text-xl rounded-3xl disabled:opacity-10 transition duration-300 opacity-50 hover:opacity-100">UNDO</button>
            </div>
          <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-2xl font-black italic mb-2 tracking-tighter uppercase text-center">King Wins</h2>
            <div className="space-y-4">
              {getLeaderboard().slice(0, 5).map((e, i) => (
                <div key={e.name} className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-400">{i+1}. {capitalize(e.name)}</span>
                  <span className="text-amber-400 font-bold">{e.winCount}</span>
                </div>
              ))}
            </div>
          </div>
          
        </aside>
      </div>

      {/* --- HISTORY LOG MODAL --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 lg:p-10" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Match Log</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{history.length} Rounds Completed</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition active:scale-95 font-bold text-xl border border-slate-200">×</button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <div className="text-6xl mb-4">📓</div>
                  <p className="font-black uppercase tracking-widest">No rounds recorded yet</p>
                </div>
              ) : (
                [...history].reverse().map((round, rIdx) => {
                  const currentRoundNum = history.length - rIdx;
                  return (
                    <div key={rIdx} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <div className="flex flex-col items-center">
                          <h3 className="font-black text-indigo-600 uppercase tracking-tighter text-xl italic">Round {currentRoundNum}</h3>
                          {currentRoundNum === 1 && <span className="text-[10px] font-black text-red-400 uppercase">Seeding Only</span>}
                        </div>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {courtOrder.map(cId => {
                          const m = round.matches[cId];
                          if (!m) return null;
                          const isKing = cId === kingCourt;
                          const countsForPoints = isKing && currentRoundNum > 1;
                          return (
                            <div key={cId} className={`rounded-3xl p-5 border ${countsForPoints ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="text-[10px] font-black uppercase mb-3 flex justify-between">
                                <span className="text-slate-400">Court {cId}</span>
                                {isKing && <span className={countsForPoints ? "text-amber-600" : "text-slate-400"}>King Court</span>}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className={`flex-1 text-center p-2 rounded-xl border ${m.winner === 'A' ? (countsForPoints ? 'bg-amber-500 text-white border-transparent shadow-md' : 'bg-indigo-600 text-white border-transparent') : 'bg-white text-slate-400 border-slate-100'} font-bold`}>
                                  {m.teamA.map(capitalize).join(' & ')}
                                </div>
                                <div className="text-[10px] font-black text-slate-300">VS</div>
                                <div className={`flex-1 text-center p-2 rounded-xl border ${m.winner === 'B' ? (countsForPoints ? 'bg-amber-500 text-white border-transparent shadow-md' : 'bg-indigo-600 text-white border-transparent') : 'bg-white text-slate-400 border-slate-100'} font-bold`}>
                                  {m.teamB.map(capitalize).join(' & ')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <footer className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <button onClick={() => setShowHistoryModal(false)} className="px-10 py-3 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest text-sm">Close Log</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}