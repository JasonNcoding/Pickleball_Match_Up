'use client';


import { useRouter } from 'next/navigation';
import React, { useState, useMemo, useEffect } from 'react';
import { Player,Match, Round } from '@/app/lib/definitions';
import { saveTournamentState,getTournamentState } from '@/app/lib/actions';


export default function TournamentSetup(){ 
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [tournamentFinished, setTournamentFinished] = useState(false);

  const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
  const [selectedCourts, setSelectedCourts] = useState<string[]>(['1', '2', '3']);
  const [courtOrder, setCourtOrder] = useState<string[]>(['1', '2', '3']);

  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<string[]>([]);
  const [currentMatches, setCurrentMatches] = useState<Record<string, Match>>({});
  const [history, setHistory] = useState<Round[]>([]);
  const [bulkInput, setBulkInput] = useState('');

  const syncData = React.useCallback(async (overrideState?: any) => {
  const stateToSave = overrideState || {
    setupComplete,
    tournamentFinished,
    selectedCourts,
    courtOrder,
    players,
    waitingPlayers,
    currentMatches,
    history,
    bulkInput
  };

  // Only save if we are hydrated and (setup is complete OR we are forcing a save via override)
  if (isHydrated && (stateToSave.setupComplete || overrideState)) {
    console.log("Syncing to cloud...");
    const result = await saveTournamentState(stateToSave);
    if (!result.success) console.error("Cloud sync failed");
    return result;
  }
}, [isHydrated, setupComplete, tournamentFinished, selectedCourts, courtOrder, players, waitingPlayers, currentMatches, history, bulkInput]);
  

    useEffect(() => {
  const loadInitialData = async () => {
    // 1. Try to get data from Postgres
    const data = await getTournamentState();
    
    if (data) {
      try {
        setSetupComplete(data.setupComplete);
        setTournamentFinished(data.tournamentFinished);
        setSelectedCourts(data.selectedCourts);
        setCourtOrder(data.courtOrder || data.selectedCourts);
        setPlayers(data.players);
        setWaitingPlayers(data.waitingPlayers);
        setCurrentMatches(data.currentMatches);
        setHistory(data.history);
        setBulkInput(data.bulkInput);
      } catch (e) {
        console.error("Error parsing database state:", e);
      }
    } else {
      // 2. Optional: Fallback to localStorage if the DB is empty (for migration)
      const saved = localStorage.getItem('kotc_session');
      if (saved) {
        const localData = JSON.parse(saved);
        // ... set states from localData if you want to migrate existing data
      }
    }

    setIsHydrated(true);
  };

  loadInitialData();
}, []);
  
    useEffect(() => {
  const timeoutId = setTimeout(() => {
    syncData();
  }, 500); // 0.5s debounce to avoid hitting DB on every single keystroke
  
  return () => clearTimeout(timeoutId);
}, [syncData]); // Only re-runs if the memoized syncData function changes

    useEffect(() => {
      setCourtOrder(prev => {
        const newBase = selectedCourts.filter(c => prev.includes(c));
        const added = selectedCourts.filter(c => !prev.includes(c));
        return [...newBase, ...added];
      });
    }, [selectedCourts]);
  
    const moveCourt = (index: number, direction: 'up' | 'down') => {
      const newOrder = [...courtOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setCourtOrder(newOrder);
    };

  
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
      // const lastRound = history[history.length - 1];
      // return Object.values(lastRound.matches).some(m => (m.teamA.includes(p1) && m.teamA.includes(p2)) || (m.teamB.includes(p1) && m.teamB.includes(p2)));
      return history.some(round => 
      Object.values(round.matches).some(m => 
        (m.teamA.includes(p1) && m.teamA.includes(p2)) || 
        (m.teamB.includes(p1) && m.teamB.includes(p2))
      )
    );
    
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


    return (
      <div className="max-w-4xl mx-auto p-6 py-12 space-y-12 bg-white">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 uppercase">Tournament Setup</h1>
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
  <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">3. Roster</h3>
      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${players.length >= selectedCourts.length * 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {players.length} / {selectedCourts.length * 4} PLAYERS
      </span>
    </div>

    {/* Quick Add / Bulk Paste */}
    <div className="space-y-2 mb-6 ">
      <textarea 
        rows={3} 
        value={bulkInput} 
        placeholder="Paste names (e.g. Mike, Sarah, John)"
        onChange={e => {
          setBulkInput(e.target.value);
          const lines = e.target.value.split(/[\n]+/).filter(s => s.trim());
          const newPlayers = lines.map(line => {
            const parts = line.split(':'); // Support "Name:Rating"
            const name = parts[0].trim();
            const rating = parseFloat(parts[1]) || 3.5;
            return { id: name, name, rating };
          });
          setPlayers(newPlayers);
        }}
        className="w-full p-4 bg-white border-slate-200 rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600" 
      />
      <p className="text-[9px] text-slate-400 font-bold px-2 uppercase tracking-tight">Pro tip: Use "Name : Rating" to paste with levels</p>
    </div>

    {/* Visual Player List with Manual Rating Input */}
<div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 scrollbar-hide">
  {players.map((p, idx) => (
    <div key={idx} className="flex items-center justify-between p-3 bg-white border-slate-200 rounded-xl group hover:bg-slate-100 transition-colors">
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
    onClick={async () => { 
    // 1. Calculate the new pairings
    generatePairings(true, players, selectedCourts); 
    
    // 2. We define the "Next State" immediately so we don't wait for React's async update
    const nextState = { 
      setupComplete: true, 
      tournamentFinished: false, 
      selectedCourts, 
      courtOrder, 
      players, 
      waitingPlayers, 
      currentMatches, // Note: see 'Caution' below
      history, 
      bulkInput 
    };

    // 3. Trigger the unified sync
    await syncData(nextState);
    
    setSetupComplete(true);
    router.push('/tournament/admin/dashboard'); 
  }}
  className="w-full py-6 bg-indigo-600 text-white font-black text-xl rounded-2xl shadow-xl transition-all hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 uppercase tracking-widest"
  >
    Start Tournament
  </button>
</div>
        </div>
      </div>
    );
}   