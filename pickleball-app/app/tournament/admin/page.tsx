'use client';

import React, { useState, useRef } from 'react';
import type { Player, Match } from '@/app/lib/definitions';
import { useTournament } from '@/app/lib/store/tournament-store';
import { firePodiumConfetti } from '@/app/ui/confetti';
import { BracketView } from '@/app/ui/bracket';

export default function Tournament() {
  const t = useTournament();

  // local setup-screen state
  const [editingNameIdx, setEditingNameIdx] = useState<number | null>(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [addPlayerName, setAddPlayerName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  function commitNameEdit(idx: number) {
    const trimmed = editingNameVal.trim();
    if (trimmed) {
      const next = [...t.players];
      next[idx] = { ...next[idx], id: trimmed, name: trimmed };
      t.setPlayers(next);
      t.setBulkInput(next.map(pl => `${pl.name}:${pl.rating}`).join('\n'));
    }
    setEditingNameIdx(null);
  }

  function adjustRating(idx: number, delta: number) {
    const next = [...t.players];
    const newRating = Math.round((next[idx].rating + delta) * 10) / 10;
    next[idx] = { ...next[idx], rating: Math.min(6.0, Math.max(2.0, newRating)) };
    t.setPlayers(next);
    t.setBulkInput(next.map(pl => `${pl.name}:${pl.rating}`).join('\n'));
  }

  function addPlayer() {
    const name = addPlayerName.trim();
    if (!name) return;
    const next = [...t.players, { id: name, name, rating: 3.5, benchCount: 0, lastBenchedRound: null }];
    t.setPlayers(next);
    t.setBulkInput(next.map(pl => `${pl.name}:${pl.rating}`).join('\n'));
    setAddPlayerName('');
    addInputRef.current?.focus();
  }

  // Handles score input for async RR / KO score mode. Updates currentMatches and auto-detects winner.
  function handleScoreInput(courtId: string, team: 'A' | 'B', rawValue: string) {
    const score = rawValue === '' ? undefined : Math.max(0, parseInt(rawValue) || 0);
    const m = t.currentMatches[courtId];
    if (!m) return;
    const updated: Match = {
      ...m,
      scoreA: team === 'A' ? score : m.scoreA,
      scoreB: team === 'B' ? score : m.scoreB,
    };
    if (updated.scoreA !== undefined && updated.scoreB !== undefined) {
      if (updated.scoreA > updated.scoreB) updated.winner = 'A';
      else if (updated.scoreB > updated.scoreA) updated.winner = 'B';
      else updated.winner = null;
    }
    t.setCurrentMatches({ ...t.currentMatches, [courtId]: updated });
  }

  // ── Finished Screen ─────────────────────────────────────────────────────────

  if (t.tournamentFinished) {
    const isKnockout = t.modeConfig.mode === 'knockout';
    const isSwissKoFinished = t.modeConfig.mode === 'swiss-ko' && t.swissKoPhase === 'knockout';

    if ((isKnockout || isSwissKoFinished) && t.champions.length > 0) {
      const koBoard = t.getKOLeaderboard();
      const eliminated = koBoard.filter(e => e.eliminated);
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start text-white p-6 pt-20 font-sans overflow-y-auto">
          <h1 className="text-5xl font-black italic mb-12 text-amber-400 uppercase tracking-tighter text-center">
            Champions!
          </h1>
          <div className="flex flex-col items-center mb-16">
            <div className="text-[100px] mb-4">👑</div>
            <div className="flex gap-4 flex-wrap justify-center">
              {t.champions.map(p => (
                <div
                  key={p.id}
                  className="kahoot-wiggle font-black text-[80px] uppercase text-amber-400 leading-tight text-center"
                >
                  {t.capitalize(p.name)}
                </div>
              ))}
            </div>
            <p className="text-amber-600 font-black text-2xl mt-4 uppercase tracking-widest">
              Knockout Champions
            </p>
          </div>

          {/* Knockout final standings */}
          {eliminated.length > 0 && (
            <div className="w-full max-w-sm mb-10 bg-slate-900 rounded-[32px] p-6">
              <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Eliminated</h3>
              <div className="space-y-2">
                {eliminated.map(e => (
                  <div key={e.id} className="flex justify-between text-sm">
                    <span className="text-slate-400 line-through">{t.capitalize(e.teamLabel)}</span>
                    <span className="text-slate-500">{e.wins}W</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => t.setTournamentFinished(false)}
              className="px-10 py-5 border-2 border-white/20 text-white font-black rounded-full hover:bg-white/10 transition-all uppercase tracking-widest text-lg"
            >
              Back
            </button>
            <button
              onClick={t.resetTournament}
              className="px-12 py-5 bg-white text-black font-black rounded-full shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest text-lg"
            >
              New Session
            </button>
          </div>
        </div>
      );
    }

    const stats = t.getLeaderboard();
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
        <h1 className="text-5xl font-black italic mb-20 text-amber-400 uppercase tracking-tighter text-center">
          Final Standings
        </h1>
        <div className="flex flex-col md:flex-row mb-4 items-end justify-center gap-6 w-full max-w-5xl pb-10">
          {podium[0].names.length > 0 && (
            <div className="flex flex-col items-center w-full md:w-1/3 order-1 md:order-2">
              <div className="text-center mb-1 min-h-[100px] flex flex-col justify-end">
                {podium[0].names.map(n =>
                  <div key={n}
                    className="kahoot-wiggle font-black text-[100px] uppercase text-amber-400 leading-tight"
                    style={{ animationDelay: '2s' }}
                  >{t.capitalize(n)}</div>
                )}
                <div className="text-[30px] font-black text-amber-600 mt-4">{podium[0].score} WINS</div>
              </div>
              <div className="bg-amber-600 w-full max-w-[180px] h-50 rounded-t-3xl border-t-8 border-amber-300 shadow-[0_0_60px_rgba(245,158,11,0.4)] flex items-center justify-center text-[100px] font-black text-amber-200">
                1
              </div>
            </div>
          )}
        </div>

        {/* Full leaderboard */}
        <div className="w-full max-w-md mb-10 bg-slate-900 rounded-[32px] p-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Full Standings</h3>
          <div className="space-y-2">
            {stats.map((e, i) => (
              <div key={e.id} className="flex justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300">{i + 1}. {t.capitalize(e.name)}</span>
                <span className="text-amber-400 font-bold">{e.winCount}W</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => t.setTournamentFinished(false)}
            className="px-10 py-5 border-2 border-white/20 text-white font-black rounded-full hover:bg-white/10 transition-all uppercase tracking-widest text-lg"
          >
            Back to Tournament
          </button>
          <button
            onClick={t.resetTournament}
            className="px-12 py-5 bg-white text-black font-black rounded-full shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest text-lg"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  // ── Setup Screen ────────────────────────────────────────────────────────────

  if (!t.setupComplete) {
    const isRoundRobin = t.modeConfig.mode === 'round-robin';
    const isKnockout = t.modeConfig.mode === 'knockout';
    const isSwiss = t.modeConfig.mode === 'swiss';
    const isSwissKo = t.modeConfig.mode === 'swiss-ko';
    const teamSize = t.modeConfig.teamSize ?? 2;
    const ppc = teamSize * 2;
    const minPlayers = t.selectedCourts.length * ppc;

    function isPowerOf2(n: number) { return n > 0 && (n & (n - 1)) === 0; }
    function isValidKnockoutCount(playerCount: number, courtCount: number): boolean {
      if (playerCount % ppc !== 0) return false;
      const teams = playerCount / ppc;
      return isPowerOf2(teams) && teams <= courtCount;
    }
    function knockoutHint(): string {
      const maxTeams = t.selectedCourts.length;
      const validSizes: number[] = [];
      for (let t2 = 1; t2 <= maxTeams; t2 = t2 * 2) validSizes.push(t2 * ppc);
      return `Need ${validSizes.join(', ')} players for a clean bracket (currently ${t.players.length})`;
    }

    const canStart = isKnockout
      ? isValidKnockoutCount(t.players.length, t.selectedCourts.length)
      : t.players.length >= minPlayers && (!(isSwiss || isSwissKo) || t.players.length >= 2);

    function handleSetupSlotClick(target: import('@/app/lib/store/tournament-store').SwapSelection) {
      const sel = t.setupSwapSelection;
      if (!sel) {
        t.setSetupSwapSelection(target);
        return;
      }
      const same =
        sel.courtId === target.courtId &&
        sel.team === target.team &&
        sel.index === target.index &&
        sel.isWaitlist === target.isWaitlist &&
        sel.pId === target.pId;
      if (same) { t.setSetupSwapSelection(null); return; }
      t.handleSetupSwap(target);
    }

    return (
      <div className="max-w-[1400px] mx-auto p-6 py-10 space-y-8 bg-white">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 uppercase">
            Tournament Setup
          </h1>
        </header>

        {/* Mode Selector */}
        <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
            0. Game Mode
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
            {([
              { key: 'rally', label: 'Rally to the Top', desc: 'King of Court' },
              { key: 'round-robin', label: 'Round Robin', desc: 'Everyone plays' },
              { key: 'knockout', label: 'Knockout', desc: 'Elimination bracket' },
              { key: 'swiss', label: 'Swiss', desc: 'Standings-based rounds' },
              { key: 'swiss-ko', label: 'Swiss → KO', desc: 'Swiss then Elimination' },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => t.setModeConfig({
                  ...t.modeConfig,
                  mode: key,
                  ...(key === 'round-robin' ? { legs: t.modeConfig.legs ?? 1 } : {}),
                  ...(key === 'swiss' ? { swissRounds: t.modeConfig.swissRounds ?? 4 } : {}),
                  ...(key === 'swiss-ko' ? {
                    swissRounds: t.modeConfig.swissRounds ?? 4,
                    swissKoAdvancing: t.modeConfig.swissKoAdvancing ?? 4,
                  } : {}),
                })}
                className={`py-4 px-3 rounded-2xl border-2 font-black transition text-left
                  ${t.modeConfig.mode === key
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
              >
                <div className="text-sm uppercase">{label}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${t.modeConfig.mode === key ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {desc}
                </div>
              </button>
            ))}
          </div>

          {/* Singles / Doubles */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team format</span>
            {([
              { size: 1 as const, label: '1v1 · Singles' },
              { size: 2 as const, label: '2v2 · Doubles' },
            ]).map(({ size, label }) => (
              <button
                key={size}
                onClick={() => t.setModeConfig({ ...t.modeConfig, teamSize: size })}
                className={`px-4 py-2 rounded-xl border-2 font-black text-[11px] transition uppercase tracking-wide
                  ${teamSize === size
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Result recording (RR + KO + Swiss + Swiss-KO) */}
          {(isRoundRobin || isKnockout || isSwiss || isSwissKo) && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Result recording</span>
              {([
                { key: 'win-loss' as const, label: 'Win / Loss' },
                { key: 'score' as const, label: 'Record Score' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => t.setModeConfig({ ...t.modeConfig, recordMode: key })}
                  className={`px-4 py-2 rounded-xl border-2 font-black text-[11px] transition uppercase tracking-wide
                    ${(t.modeConfig.recordMode ?? 'win-loss') === key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Swiss: Rounds config */}
          {isSwiss && (
            <div className="mt-4 flex items-center gap-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Rounds
              </label>
              <input
                type="number"
                min={1}
                value={t.modeConfig.swissRounds ?? 4}
                onChange={e => t.setModeConfig({ ...t.modeConfig, swissRounds: Math.max(1, parseInt(e.target.value) || 4) })}
                className="w-24 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-indigo-600 outline-none focus:border-indigo-600 text-center"
              />
              <span className="text-[10px] text-slate-400 font-bold">total rounds</span>
            </div>
          )}

          {/* Swiss-KO: Swiss rounds + advancing teams config */}
          {isSwissKo && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Swiss rounds
              </label>
              <input
                type="number"
                min={1}
                value={t.modeConfig.swissRounds ?? 4}
                onChange={e => t.setModeConfig({ ...t.modeConfig, swissRounds: Math.max(1, parseInt(e.target.value) || 4) })}
                className="w-20 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-indigo-600 outline-none focus:border-indigo-600 text-center"
              />
              <span className="text-slate-200 font-bold">|</span>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Advance to KO
              </label>
              <input
                type="number"
                min={2}
                value={t.modeConfig.swissKoAdvancing ?? 4}
                onChange={e => {
                  const v = Math.max(2, parseInt(e.target.value) || 4);
                  t.setModeConfig({ ...t.modeConfig, swissKoAdvancing: v });
                }}
                className="w-20 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-indigo-600 outline-none focus:border-indigo-600 text-center"
              />
              <span className="text-[10px] text-slate-400 font-bold">teams (power of 2)</span>
            </div>
          )}

          {/* RR: Legs + max matches config */}
          {isRoundRobin && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Legs
              </label>
              <input
                type="number"
                min={1}
                value={t.modeConfig.legs ?? 1}
                onChange={e => t.setModeConfig({ ...t.modeConfig, legs: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-24 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-indigo-600 outline-none focus:border-indigo-600 text-center"
              />
              <span className="text-[10px] text-slate-400 font-bold">times each pair meets</span>
              <span className="text-slate-200 font-bold">|</span>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Max matches / team
              </label>
              <input
                type="number"
                min={1}
                value={t.modeConfig.maxMatchesPerTeam ?? ''}
                placeholder="No limit"
                onChange={e => {
                  const v = parseInt(e.target.value);
                  t.setModeConfig({ ...t.modeConfig, maxMatchesPerTeam: v > 0 ? v : undefined });
                }}
                className="w-24 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-indigo-600 outline-none focus:border-indigo-600 text-center placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          )}
        </section>

        {/* 3-column layout */}
        <div className="flex flex-wrap gap-6 items-start">

          {/* ── Left: Courts + Hierarchy ── */}
          <div className="w-56 shrink-0 space-y-6">
            <section className="bg-slate-50 p-5 rounded-[32px] border border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                1. Active Courts
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {t.availableCourts.map(c => (
                  <button
                    key={c}
                    onClick={() => t.setSelectedCourts(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
                    className={`py-3 rounded-xl font-black transition ${t.selectedCourts.includes(c) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>

            {t.modeConfig.mode === 'rally' && (
              <section className="bg-slate-50 p-5 rounded-[32px] border border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                  2. Hierarchy
                </h3>
                <div className="space-y-2">
                  {t.courtOrder.map((c, i) => (
                    <div key={c} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                      <span className="font-black text-sm uppercase">
                        Court {c} {i === 0 ? '👑' : ''}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => t.moveCourt(i, 'up')} disabled={i === 0} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg disabled:opacity-0 text-xs">↑</button>
                        <button onClick={() => t.moveCourt(i, 'down')} disabled={i === t.courtOrder.length - 1} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg disabled:opacity-0 text-xs">↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Center: Team Assignment Grid ── */}
          <div className="flex-1 min-w-[300px] space-y-4">
            <section className="bg-slate-50 p-5 rounded-[32px] border border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {t.modeConfig.mode === 'rally' ? '3' : '2'}. Team Assignment
                </h3>
                {t.preAssignment && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={t.autoFill}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-black rounded-xl hover:bg-indigo-700 transition uppercase tracking-wide"
                    >
                      Balance by Rating
                    </button>
                    <button
                      onClick={t.shuffleTeams}
                      className="px-3 py-1.5 bg-white border-2 border-slate-200 text-slate-700 text-[11px] font-black rounded-xl hover:border-indigo-400 transition uppercase tracking-wide"
                    >
                      Randomise Teams
                    </button>
                    <button
                      onClick={t.shufflePlayers}
                      className="px-3 py-1.5 bg-white border-2 border-slate-200 text-slate-700 text-[11px] font-black rounded-xl hover:border-indigo-400 transition uppercase tracking-wide"
                    >
                      Randomise Players
                    </button>
                    <button
                      onClick={t.toggleRatingOrder}
                      className="px-3 py-1.5 bg-white border-2 border-slate-200 text-slate-600 text-[11px] font-black rounded-xl hover:border-indigo-400 transition uppercase tracking-wide"
                      title={t.ratingOrder === 'highToTop' ? 'Highest rated on top courts' : 'Lowest rated on top courts'}
                    >
                      {t.ratingOrder === 'highToTop' ? '↑ Rating → Top' : '↓ Rating → Top'}
                    </button>
                  </div>
                )}
              </div>

              {t.preAssignment ? (
                <>
                  <div className={`grid gap-3 ${t.selectedCourts.length >= 6 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {t.selectedCourts.map(cId => {
                      const m = t.preAssignment!.courts[cId];
                      if (!m) return null;
                      const isKing = t.modeConfig.mode === 'rally' && cId === t.courtOrder[0];
                      return (
                        <div key={cId} className={`bg-white rounded-2xl border-2 overflow-hidden ${isKing ? 'border-amber-400 ring-2 ring-amber-50' : 'border-slate-100'}`}>
                          <div className={`py-1.5 px-3 text-[11px] text-center font-black uppercase tracking-widest ${isKing ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-white'}`}>
                            Court {cId}{isKing ? ' 👑' : ''}
                          </div>
                          <div className="p-2 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                              <div className="bg-white px-2 py-0.5 rounded-full border border-slate-100 text-[9px] font-black text-slate-400 italic shadow-sm">VS</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {(['A', 'B'] as const).map(teamKey => {
                                const team = teamKey === 'A' ? m.teamA : m.teamB;
                                const anySelected = team.some((_, pi) =>
                                  t.setupSwapSelection?.courtId === cId &&
                                  t.setupSwapSelection.team === teamKey &&
                                  t.setupSwapSelection.index === pi,
                                );
                                return (
                                  <div
                                    key={teamKey}
                                    className={`flex flex-col gap-1 p-1.5 rounded-xl border-2 transition-colors
                                      ${anySelected ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}
                                  >
                                    {team.map((pId, playerIdx) => {
                                      const isSelected =
                                        t.setupSwapSelection?.courtId === cId &&
                                        t.setupSwapSelection.team === teamKey &&
                                        t.setupSwapSelection.index === playerIdx;
                                      return (
                                        <button
                                          key={playerIdx}
                                          onClick={() => handleSetupSlotClick({ courtId: cId, team: teamKey, index: playerIdx })}
                                          className={`w-full text-center text-sm py-2 rounded-lg font-bold truncate transition-all
                                            ${isSelected
                                              ? 'bg-orange-500 text-white shadow-md'
                                              : t.setupSwapSelection
                                                ? 'bg-white text-orange-700 hover:bg-orange-100'
                                                : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                                            }`}
                                        >
                                          {t.capitalize(pId)}
                                        </button>
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

                  {t.preAssignment.bench.length > 0 && (
                    <div className="mt-3 p-3 bg-white rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Bench ({t.preAssignment.bench.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {t.preAssignment.bench.map((pId, idx) => {
                          const isSelected = t.setupSwapSelection?.isWaitlist && t.setupSwapSelection.pId === pId;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSetupSlotClick({ isWaitlist: true, pId })}
                              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition
                                ${isSelected
                                  ? 'bg-orange-500 text-white shadow-md'
                                  : t.setupSwapSelection
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                                    : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                            >
                              {t.capitalize(pId)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {t.setupSwapSelection && (
                    <p className="mt-2 text-center text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">
                      Tap another slot to swap · tap same slot to cancel
                    </p>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-slate-300 font-black uppercase text-sm">
                    {isKnockout
                      ? knockoutHint()
                      : `Add ${minPlayers} players to preview team assignment`}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ── Right: Roster ── */}
          <div className="w-72 shrink-0 space-y-6">
            <section className="bg-slate-50 p-5 rounded-[32px] border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  {t.modeConfig.mode === 'rally' ? '4' : '3'}. Roster
                </h3>
                <span className={`text-[10px] font-black px-2 py-1 rounded-md ${canStart ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {t.players.length}{!isKnockout ? ` / ${minPlayers}` : ''}
                </span>
              </div>

              <div className="space-y-1 mb-4">
                <textarea
                  rows={2}
                  value={t.bulkInput}
                  placeholder="Alice, Bob, Carol  or  Alice:3.5"
                  onChange={e => {
                    t.setBulkInput(e.target.value);
                    const items = e.target.value.split(/[,\n]+/).filter(s => s.trim());
                    const newPlayers = items.map(item => {
                      const parts = item.split(':');
                      const name = parts[0].trim();
                      const rating = parseFloat(parts[1]) || 3.5;
                      return { id: name, name, rating, benchCount: 0, lastBenchedRound: null } as Player;
                    });
                    t.setPlayers(newPlayers);
                  }}
                  className="w-full p-3 bg-white rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600 resize-none"
                />
                <p className="text-[9px] text-slate-400 font-bold px-1 uppercase tracking-tight">
                  Comma or line-separated · name:rating to set level
                </p>
              </div>

              <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                {t.players.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <span className="text-[9px] font-bold text-slate-300 w-5 shrink-0 text-right">{idx + 1}</span>
                    {editingNameIdx === idx ? (
                      <input
                        autoFocus
                        value={editingNameVal}
                        onChange={e => setEditingNameVal(e.target.value)}
                        onBlur={() => commitNameEdit(idx)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitNameEdit(idx);
                          if (e.key === 'Escape') setEditingNameIdx(null);
                        }}
                        className="flex-1 min-w-0 font-black text-sm text-slate-800 uppercase outline-none border-b-2 border-indigo-500 bg-transparent"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingNameIdx(idx); setEditingNameVal(p.name); }}
                        className="flex-1 min-w-0 text-left font-black text-sm text-slate-700 uppercase truncate hover:text-indigo-600 transition-colors"
                        title="Click to edit name"
                      >
                        {p.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => adjustRating(idx, -0.5)} disabled={p.rating <= 2.0} className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30 text-xs font-black transition">−</button>
                      <span className="w-8 text-center text-xs font-black text-indigo-600">{p.rating.toFixed(1)}</span>
                      <button onClick={() => adjustRating(idx, 0.5)} disabled={p.rating >= 6.0} className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30 text-xs font-black transition">+</button>
                    </div>
                    <button
                      onClick={() => {
                        const next = t.players.filter((_, i) => i !== idx);
                        t.setPlayers(next);
                        t.setBulkInput(next.map(pl => `${pl.name}:${pl.rating}`).join('\n'));
                      }}
                      className="w-6 h-6 shrink-0 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <input
                    ref={addInputRef}
                    value={addPlayerName}
                    onChange={e => setAddPlayerName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPlayer(); }}
                    placeholder="Add player..."
                    className="flex-1 min-w-0 bg-transparent font-bold text-sm text-slate-700 outline-none placeholder:text-slate-300"
                  />
                  <button
                    onClick={addPlayer}
                    disabled={!addPlayerName.trim()}
                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg disabled:opacity-30 transition hover:bg-indigo-700"
                  >
                    + Add
                  </button>
                </div>

                {t.players.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-xs font-black text-slate-300 uppercase italic">Paste names above or add one at a time</p>
                  </div>
                )}
              </div>
            </section>

            {isKnockout && !canStart && t.players.length > 0 && (
              <p className="text-[10px] font-bold text-amber-600 text-center px-2">
                {knockoutHint()}
              </p>
            )}
            <button
              disabled={!canStart}
              onClick={t.startTournament}
              className="w-full py-6 bg-indigo-600 text-white font-black text-xl rounded-2xl shadow-xl transition-all hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 uppercase tracking-widest"
            >
              Start Tournament
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Active Tournament ───────────────────────────────────────────────────────

  const isKnockout = t.modeConfig.mode === 'knockout';
  const isRoundRobin = t.modeConfig.mode === 'round-robin';
  const isSwiss = t.modeConfig.mode === 'swiss';
  const isSwissKo = t.modeConfig.mode === 'swiss-ko';
  const isSwissKoSwissPhase = isSwissKo && t.swissKoPhase === 'swiss';
  const isSwissKoKoPhase = isSwissKo && t.swissKoPhase === 'knockout';
  const recordMode = t.modeConfig.recordMode ?? 'win-loss';

  // RR/Swiss/Swiss-KO(Swiss) use selectedCourts; KO and Swiss-KO(KO) use activeCourts; Rally uses courtOrder.
  const displayCourts = (isKnockout || isSwissKoKoPhase) && t.activeCourts.length > 0
    ? t.activeCourts
    : (isRoundRobin || isSwiss || isSwissKoSwissPhase)
      ? t.selectedCourts
      : t.courtOrder;

  // Swiss / Swiss-KO(Swiss): "Next Round" button enabled when all active courts have a result.
  const swissAllResultsIn = (isSwiss || isSwissKoSwissPhase) && t.selectedCourts.every(c => {
    const m = t.currentMatches[c];
    return !m || m.teamA.length === 0 || m.winner !== null;
  });

  const roundLabel = () => {
    if (isRoundRobin) {
      const total = t.totalScheduledMatches;
      const done = t.completedMatchCount;
      return total > 0 ? `${done} / ${total} Matches` : 'Round Robin';
    }
    if (isSwiss) {
      const total = t.modeConfig.swissRounds ?? 4;
      return `Swiss · Round ${t.swissCurrentRound + 1} / ${total}`;
    }
    if (isSwissKo) {
      if (isSwissKoSwissPhase) {
        const total = t.modeConfig.swissRounds ?? 4;
        return `Swiss → KO · Swiss Round ${t.swissCurrentRound + 1} / ${total}`;
      }
      const teamCount = t.activeCourts.length * 2;
      if (teamCount <= 2) return 'Swiss → KO · Final';
      if (teamCount === 4) return 'Swiss → KO · Semifinals';
      if (teamCount === 8) return 'Swiss → KO · Quarterfinals';
      return `Swiss → KO · Round of ${teamCount}`;
    }
    if (isKnockout) {
      const teamCount = t.activeCourts.length * 2;
      if (teamCount <= 2) return 'Final';
      if (teamCount === 4) return 'Semifinals';
      if (teamCount === 8) return 'Quarterfinals';
      return `Round of ${teamCount}`;
    }
    return `Round ${t.history.length + 1}`;
  };

  // allResultsIn gates the Next Round button (Rally + KO + Swiss-KO KO phase only).
  const allResultsIn = !isRoundRobin && !isSwiss && !isSwissKoSwissPhase && Object.values(t.currentMatches)
    .filter((_, i) => displayCourts[i] !== undefined)
    .every(m => m.winner);

  const nextRoundDisabled = !allResultsIn || t.isEditMode;

  // Live teams (currently playing, no winner yet) — for queue conflict display.
  const liveTeamIds = new Set<string>();
  Object.values(t.currentMatches).forEach(m => {
    if (m.teamA.length === 0 || m.winner !== null) return;
    m.teamA.forEach(id => liveTeamIds.add(id));
    m.teamB.forEach(id => liveTeamIds.add(id));
  });

  return (
    <div className="mx-auto p-4 lg:p-10">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">{roundLabel()}</h1>
          {t.modeConfig.mode === 'rally' && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              King: Court {t.kingCourt} • Bottom: Court {t.bottomCourt}
            </p>
          )}
          {isRoundRobin && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Round Robin • {t.modeConfig.legs ?? 1} leg{(t.modeConfig.legs ?? 1) > 1 ? 's' : ''}
              {recordMode === 'score' && ' • Score mode'}
            </p>
          )}
          {isSwiss && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Swiss System • {t.modeConfig.swissRounds ?? 4} rounds
              {recordMode === 'score' && ' • Score mode'}
            </p>
          )}
          {isSwissKo && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {isSwissKoSwissPhase
                ? `Swiss Phase • ${t.modeConfig.swissRounds ?? 4} rounds • Top ${t.modeConfig.swissKoAdvancing ?? 4} advance`
                : `Knockout Phase • ${t.modeConfig.swissKoAdvancing ?? 4} teams`}
              {recordMode === 'score' && ' • Score mode'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => t.setShowHistoryModal(true)} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">LOG</button>
          {/* SWAP only for Rally (not RR async, not KO) */}
          {t.modeConfig.mode === 'rally' && (
            <button
              onClick={() => { t.setIsEditMode(!t.isEditMode); t.setSwapSelection(null); }}
              className={`px-6 py-2 rounded-xl font-bold transition ${t.isEditMode ? 'bg-orange-400 hover:bg-orange-500 text-white shadow-lg' : 'hover:bg-slate-200 bg-slate-100 text-slate-600'}`}
            >
              {t.isEditMode ? 'FINISH SWAP' : 'SWAP'}
            </button>
          )}
          {/* Swiss-KO KO phase: court swap button */}
          {isSwissKoKoPhase && !t.tournamentFinished && (
            <button
              onClick={() => t.selectKoCourtForSwap(t.koCourtSwapSelection ?? '')}
              className={`px-5 py-2 rounded-xl font-black text-sm uppercase transition
                ${t.koCourtSwapSelection
                  ? 'bg-orange-400 text-white hover:bg-orange-500 shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {t.koCourtSwapSelection ? 'Cancel Swap' : 'Swap Courts'}
            </button>
          )}
          {/* Swiss / Swiss-KO(Swiss): Next Round button */}
          {(isSwiss || isSwissKoSwissPhase) && !t.tournamentFinished && (
            <button
              onClick={t.nextSwissRound}
              disabled={!swissAllResultsIn}
              className={`px-6 py-2 rounded-xl font-black text-sm uppercase transition
                ${swissAllResultsIn
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
            >
              {t.swissCurrentRound + 1 >= (t.modeConfig.swissRounds ?? 4)
                ? (isSwissKo ? 'Start Knockout →' : 'Finish Swiss')
                : 'Next Round →'}
            </button>
          )}
          <button onClick={t.finishTournament} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-emerald-500 hover:text-white transition">FINISH</button>
          <button onClick={() => { if (confirm('R U Sure, Reset?')) t.resetTournament(); }} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition rounded-xl font-black text-xs border border-red-100">RESET</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Courts */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayCourts.map((cId) => {
            const m = t.currentMatches[cId];
            if (!m) return null;
            const isKing = cId === t.kingCourt && t.modeConfig.mode === 'rally';
            const isBottom = cId === t.bottomCourt && t.modeConfig.mode === 'rally';
            const isIdle = (isRoundRobin || isSwiss || isSwissKoSwissPhase) && m.teamA.length === 0;
            const isSwapSelected = isSwissKoKoPhase && t.koCourtSwapSelection === cId;
            const isSwapTarget = isSwissKoKoPhase && t.koCourtSwapSelection !== null && t.koCourtSwapSelection !== cId && m.winner === null;

            return (
              <div key={cId} className={`bg-white h-fit rounded-[32px] border-2 transition overflow-hidden
                ${isSwapSelected ? 'border-orange-400 ring-4 ring-orange-50' : isKing ? 'border-amber-400 ring-4 ring-amber-50' : isIdle ? 'border-slate-100 opacity-60' : isSwapTarget ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-slate-100'}`}
              >
                <div
                  onClick={() => isSwissKoKoPhase && m.winner === null && !isIdle ? t.selectKoCourtForSwap(cId) : undefined}
                  className={`py-2 px-4 text-[15px] text-center font-black uppercase tracking-widest
                    ${isSwapSelected ? 'bg-orange-400 text-white' : isKing ? 'bg-amber-400' : isBottom ? 'bg-slate-200' : 'bg-slate-800 text-white'}
                    ${isSwissKoKoPhase && m.winner === null && !isIdle ? 'cursor-pointer select-none' : ''}`}
                >
                  Court {cId}
                  {isKing ? ' 👑' : isBottom ? ' ⬇️' : ''}
                  {(isKnockout || isSwissKoKoPhase) ? ' ⚔️' : ''}
                  {isSwapSelected ? ' ←' : isSwapTarget ? ' ↔' : ''}
                </div>

                {isIdle ? (
                  /* Idle court — all queue matches for this court are done or waiting */
                  <div className="p-6 text-center">
                    <p className="text-slate-400 font-black uppercase text-sm mb-3">All matches played</p>
                    {t.matchQueue.length > 0 && (
                      <button
                        onClick={() => t.setQueueSelectCourtId(t.queueSelectCourtId === cId ? null : cId)}
                        className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition
                          ${t.queueSelectCourtId === cId
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {t.queueSelectCourtId === cId ? 'Cancel' : 'Assign Match'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <div className="bg-white px-3 py-1 rounded-full border-2 border-slate-100 text-[11px] font-black text-slate-400 italic shadow-sm">VS</div>
                    </div>
                    <div className="grid grid-cols-2 gap-10">
                      {(['A', 'B'] as const).map((teamKey) => {
                        const team = teamKey === 'A' ? m.teamA : m.teamB;
                        const score = teamKey === 'A' ? m.scoreA : m.scoreB;
                        const isRepeat = t.modeConfig.mode === 'rally' && (t.modeConfig.teamSize ?? 2) > 1 && team.length > 1 && t.hasPlayedTogether(team[0], team[1]);
                        return (
                          <div key={teamKey} className="relative">
                            <div
                              onClick={() => {
                                if (t.isEditMode) return;
                                t.setCurrentMatches({
                                  ...t.currentMatches,
                                  [cId]: { ...m, winner: m.winner === teamKey ? null : teamKey },
                                });
                              }}
                              className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition cursor-pointer
                                ${m.winner === teamKey ? 'bg-indigo-50 border-indigo-500 shadow-inner' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                            >
                              {team.map((pId, idx) => {
                                const isSelected = t.swapSelection?.courtId === cId && t.swapSelection.team === teamKey && t.swapSelection.index === idx;
                                const isBenchSelected = t.swapSelection?.isWaitlist === true;
                                const isDimmed = !t.isRoundOne && !!t.swapSelection && t.swapSelection.courtId !== cId && !isBenchSelected;
                                const isCourtGreyed = t.isEditMode && isBenchSelected && cId !== t.bottomCourt && cId !== t.secondBottomCourt;
                                const isEliminated = (isKnockout || isSwissKoKoPhase) && t.knockoutState.eliminatedPlayerIds.includes(pId);
                                return (
                                  <span
                                    key={idx}
                                    onClick={(e) => {
                                      if (t.isEditMode && !isDimmed) {
                                        e.stopPropagation();
                                        if (isSelected) { t.setSwapSelection(null); return; }
                                        if (!t.swapSelection) t.setSwapSelection({ courtId: cId, team: teamKey, index: idx });
                                        else t.handleSwap({ courtId: cId, team: teamKey, index: idx });
                                      }
                                    }}
                                    className={`w-full text-center text-[20px] py-4 rounded-xl font-bold truncate transition-all
                                      ${t.isEditMode ? 'bg-orange-100 text-orange-800 cursor-pointer' : ''}
                                      ${isSelected ? '!bg-orange-600 !text-white shadow-md' : ''}
                                      ${isDimmed || isCourtGreyed ? 'opacity-20 grayscale' : ''}
                                      ${isEliminated ? 'line-through opacity-40' : ''}`}
                                  >
                                    {t.capitalize(pId)}
                                  </span>
                                );
                              })}

                              {/* Score input — score mode only */}
                              {recordMode === 'score' && (
                                <input
                                  type="number"
                                  min={0}
                                  value={score?.toString() ?? ''}
                                  placeholder="0"
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => handleScoreInput(cId, teamKey, e.target.value)}
                                  className={`w-full mt-1 text-center text-2xl font-black border-2 rounded-xl p-2 outline-none transition
                                    ${m.winner === teamKey ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 focus:border-indigo-400'}`}
                                />
                              )}
                            </div>

                            {isRepeat && (
                              <div className="absolute -top-2 -right-1 bg-red-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm z-10 uppercase">
                                Repeat Partner
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Async RR: confirm button appears when winner is set */}
                    {isRoundRobin && m.winner && (
                      <button
                        onClick={() => t.confirmCourtResult(cId)}
                        className="mt-4 w-full py-3 bg-green-600 text-white font-black text-sm rounded-2xl uppercase tracking-wide hover:bg-green-700 transition shadow-sm"
                      >
                        Confirm & Next Match →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Next Round / Bracket button — Rally, KO, Swiss-KO KO phase (not RR, not Swiss, not Swiss-KO Swiss phase) */}
          {!isRoundRobin && !isSwiss && !isSwissKoSwissPhase && (
            <div className="flex gap-4 mt-6">
              <button
                disabled={nextRoundDisabled}
                onClick={t.nextRound}
                className="flex-[2] py-6 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-xl disabled:bg-slate-200 uppercase transition"
              >
                {(isKnockout || isSwissKoKoPhase) ? 'Next Bracket Round →' : 'Next Round →'}
              </button>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={t.undoRound}
              disabled={t.history.length === 0}
              className="flex-1 py-6 bg-slate-400 text-white font-black text-xl rounded-3xl disabled:opacity-10 transition duration-300 opacity-50 hover:opacity-100"
            >
              UNDO
            </button>
          </div>

          {t.bottomBonusMessage && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-sm font-bold text-amber-800 leading-tight">
              {t.bottomBonusMessage}
            </div>
          )}

          {/* Rally bench */}
          {t.modeConfig.mode === 'rally' && t.waitingPlayers.length > 0 && (
            <div className="bg-slate-50 rounded-[32px] p-5 border-2 border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Bench ({t.waitingPlayers.length})
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase">tap to swap • bottom 2 courts</span>
              </div>
              {t.benchMessage && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-xl text-[10px] font-bold text-blue-700 leading-tight">
                  {t.benchMessage}
                </div>
              )}
              <div className="space-y-2">
                {t.waitingPlayers.map(pId => {
                  const player = t.players.find(p => p.id === pId);
                  if (!player) return null;
                  const isSelected = t.swapSelection?.isWaitlist === true && t.swapSelection.pId === pId;
                  const isGreyed = t.isEditMode && !!t.swapSelection && !t.swapSelection?.isWaitlist
                    && !(t.swapSelection?.courtId === t.bottomCourt || t.swapSelection?.courtId === t.secondBottomCourt)
                    && !isSelected;
                  const badge = (player.benchCount ?? 0) === 0 ? 'bg-green-100 text-green-700'
                    : (player.benchCount ?? 0) <= 2 ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-orange-100 text-orange-700';
                  return (
                    <div
                      key={pId}
                      onClick={() => {
                        if (!t.isEditMode) return;
                        if (isSelected) { t.setSwapSelection(null); return; }
                        if (!t.swapSelection) {
                          t.setSwapSelection({ isWaitlist: true, pId });
                        } else if ((t.swapSelection.courtId === t.bottomCourt || t.swapSelection.courtId === t.secondBottomCourt) && !t.swapSelection.isWaitlist) {
                          t.handleSwap({ isWaitlist: true, pId });
                        } else if (t.swapSelection.isWaitlist) {
                          t.setSwapSelection({ isWaitlist: true, pId });
                        } else {
                          t.setSwapSelection(null);
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 select-none transition-all
                        ${t.isEditMode ? 'cursor-pointer' : ''}
                        ${isSelected ? 'bg-orange-600 border-orange-600 shadow-md' : t.isEditMode ? 'bg-orange-100 border-orange-200' : 'bg-white border-slate-200'}
                        ${isGreyed ? 'opacity-20 grayscale' : ''}`}
                    >
                      <span className={`font-black text-sm uppercase ${isSelected ? 'text-white' : t.isEditMode ? 'text-orange-800' : 'text-slate-800'}`}>
                        {t.capitalize(player.name)}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : badge}`}>
                        benched {player.benchCount ?? 0}×
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Async RR: Match Queue */}
          {isRoundRobin && (
            <div className="bg-slate-50 rounded-[32px] p-5 border-2 border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Upcoming ({t.matchQueue.length})
                </h3>
                {t.queueSelectCourtId && (
                  <span className="text-[9px] font-bold text-orange-500 uppercase animate-pulse">
                    Select for Court {t.queueSelectCourtId}
                  </span>
                )}
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-hide">
                {t.matchQueue.map(sm => {
                  const isConflict = sm.teamA.some(id => liveTeamIds.has(id)) || sm.teamB.some(id => liveTeamIds.has(id));
                  const isSelectable = !!t.queueSelectCourtId && !isConflict;
                  return (
                    <div
                      key={sm.id}
                      onClick={() => isSelectable && t.selectQueueMatch(t.queueSelectCourtId!, sm.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition
                        ${isConflict
                          ? 'opacity-40 border-slate-100 bg-white cursor-default'
                          : isSelectable
                            ? 'cursor-pointer border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-800'
                            : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      <span className="flex-1 truncate">
                        {sm.teamA.map(id => t.capitalize(id)).join(' & ')}
                      </span>
                      <span className="text-slate-300 text-[9px] shrink-0">vs</span>
                      <span className="flex-1 truncate text-right">
                        {sm.teamB.map(id => t.capitalize(id)).join(' & ')}
                      </span>
                      {isConflict && (
                        <span className="text-[8px] text-slate-300 shrink-0">live</span>
                      )}
                    </div>
                  );
                })}
                {t.matchQueue.length === 0 && (
                  <p className="text-center text-[10px] text-slate-400 font-black uppercase py-3">All matches assigned</p>
                )}
              </div>
            </div>
          )}

          {/* KO / Swiss-KO KO phase: Bracket view + KO Leaderboard */}
          {(isKnockout || isSwissKoKoPhase) && (
            <>
              <BracketView
                players={t.players}
                history={t.history}
                currentMatches={t.currentMatches}
                activeCourts={t.activeCourts}
                knockoutState={t.knockoutState}
                champions={t.champions}
                capitalize={t.capitalize}
              />
              <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl">
                <h2 className="text-lg font-black italic mb-4 tracking-tighter uppercase text-center">Standings</h2>
                {(() => {
                  const koBoard = t.getKOLeaderboard();
                  const active = koBoard.filter(e => !e.eliminated);
                  const eliminated = koBoard.filter(e => e.eliminated);
                  return (
                    <>
                      {active.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-2">Remaining</p>
                          <div className="space-y-2">
                            {active.map((e, i) => (
                              <div key={e.id} className="flex justify-between border-b border-slate-800 pb-1.5">
                                <span className="font-bold text-slate-300 text-sm">{i + 1}. {t.capitalize(e.teamLabel)}</span>
                                <span className="text-amber-400 font-bold text-sm">{e.wins}W</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {eliminated.length > 0 && (
                        <div>
                          <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2">Eliminated</p>
                          <div className="space-y-1">
                            {eliminated.map(e => (
                              <div key={e.id} className="flex justify-between pb-1">
                                <span className="font-bold text-slate-500 text-xs line-through">{t.capitalize(e.teamLabel)}</span>
                                <span className="text-slate-600 font-bold text-xs">{e.wins}W</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {/* Rally + RR + Swiss + Swiss-KO(Swiss phase): Leaderboard */}
          {!isKnockout && !isSwissKoKoPhase && (
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl">
              <h2 className="text-2xl font-black italic mb-2 tracking-tighter uppercase text-center">Leaderboard</h2>
              <div className="space-y-4">
                {t.getLeaderboard().slice(0, 8).map((e, i) => (
                  <div key={e.id} className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-400">{i + 1}. {t.capitalize(e.name)}</span>
                    <span className="text-amber-400 font-bold">{e.winCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* History Modal */}
      {t.showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 lg:p-10" onClick={() => t.setShowHistoryModal(false)}>
          <div className="bg-white rounded-[40px] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Match Log</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {isRoundRobin ? `${t.history.length} Matches Completed` : (isSwiss || isSwissKo) ? `${t.history.length} Rounds Completed` : `${t.history.length} Rounds Completed`}
                </p>
              </div>
              <button onClick={() => t.setShowHistoryModal(false)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition active:scale-95 font-bold text-xl border border-slate-200">×</button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              {t.history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <div className="text-6xl mb-4">📓</div>
                  <p className="font-black uppercase tracking-widest">No matches recorded yet</p>
                </div>
              ) : (
                [...t.history].reverse().map((round, rIdx) => {
                  const currentRoundNum = t.history.length - rIdx;
                  const courtIds = (isRoundRobin || isSwiss || isSwissKo) ? Object.keys(round.matches) : t.courtOrder;
                  return (
                    <div key={rIdx} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <div className="flex flex-col items-center">
                          <h3 className="font-black text-indigo-600 uppercase tracking-tighter text-xl italic">
                            {isRoundRobin ? `Match ${currentRoundNum}` : isSwiss ? `Swiss Round ${currentRoundNum}` : isSwissKo ? `Round ${currentRoundNum}` : `Round ${currentRoundNum}`}
                          </h3>
                          {currentRoundNum === 1 && t.modeConfig.mode === 'rally' && (
                            <span className="text-[10px] font-black text-red-400 uppercase">Seeding Only</span>
                          )}
                        </div>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {courtIds.map((cId) => {
                          const m = round.matches[cId];
                          if (!m) return null;
                          const isKingCourt = cId === t.kingCourt && t.modeConfig.mode === 'rally';
                          const isBottomCourt = cId === t.bottomCourt && t.modeConfig.mode === 'rally';
                          const countsForPoints = isKingCourt && currentRoundNum > 1;
                          return (
                            <div key={cId} className={`rounded-[32px] border-2 overflow-hidden shadow-sm ${countsForPoints ? 'bg-amber-50 border-amber-400 ring-4 ring-amber-100' : 'bg-white border-slate-100'}`}>
                              <div className={`py-2 px-4 text-[13px] font-black uppercase tracking-widest flex justify-between items-center
                                ${isKingCourt ? 'bg-amber-400 text-slate-900' : isBottomCourt ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-white'}`}>
                                <span>Court {cId}</span>
                                {isKingCourt && <span>{countsForPoints ? '👑 Points Active' : '👑'}</span>}
                                {isBottomCourt && <span>⬇️</span>}
                              </div>
                              <div className="p-2 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                  <div className="bg-white px-3 py-1 rounded-full border-2 border-slate-100 text-[11px] font-black text-slate-400 italic shadow-sm">VS</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  {(['A', 'B'] as const).map((teamKey) => {
                                    const team = teamKey === 'A' ? m.teamA : m.teamB;
                                    const isWinner = m.winner === teamKey;
                                    const score = teamKey === 'A' ? m.scoreA : m.scoreB;
                                    return (
                                      <div key={teamKey}
                                        className={`flex flex-col rounded-2xl border-2 transition-all
                                          ${isWinner ? (countsForPoints ? 'bg-amber-500 border-transparent shadow-lg scale-[1.02]' : 'bg-indigo-600 border-transparent shadow-lg scale-[1.02]') : 'bg-slate-50 border-transparent'}`}
                                      >
                                        {team.map((pId, idx) => (
                                          <span key={idx}
                                            className={`w-full text-center text-[18px] py-3 px-1 rounded-xl font-bold leading-tight
                                              ${isWinner ? 'text-white' : 'text-slate-800'}`}
                                          >
                                            {t.capitalize(pId)}
                                          </span>
                                        ))}
                                        {score !== undefined && (
                                          <span className={`text-center text-xl font-black pb-2 ${isWinner ? 'text-white/90' : 'text-slate-500'}`}>
                                            {score}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {round.waiting.length > 0 && (
                        <div className="rounded-[32px] bg-slate-50 border-2 border-slate-100 p-5">
                          <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">On Bench</div>
                          <div className="flex flex-wrap gap-2">
                            {round.waiting.map(pId => {
                              const player = t.players.find(p => p.id === pId);
                              return (
                                <span key={pId} className="text-sm font-black px-4 py-2 bg-white border-2 border-slate-200 rounded-2xl text-slate-600 uppercase">
                                  {t.capitalize(player?.name ?? pId)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <footer className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <button onClick={() => t.setShowHistoryModal(false)} className="px-10 py-3 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest text-sm">Close Log</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
