'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TournamentHistoryEntry } from '@/app/lib/actions';

type HistoryClientProps = {
  sessions: TournamentHistoryEntry[];
  onDelete: (id: number) => Promise<{ success: boolean }>;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTeam(players: string[]): string {
  if (players.length === 0) return 'TBD';
  return players.join(' and ');
}

export default function HistoryClient({ sessions, onDelete }: HistoryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [playerQuery, setPlayerQuery] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Record<number, boolean>>({});
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  const tournamentTypes = useMemo(
    () => ['ALL', ...Array.from(new Set(sessions.map((session) => session.tournamentType))).sort()],
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const playerQueryNormalized = playerQuery.trim().toLowerCase();
    const startTimestamp = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endTimestamp = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return sessions.filter((session) => {
      const archivedAt = new Date(session.archivedAt).getTime();
      if (startTimestamp !== null && archivedAt < startTimestamp) return false;
      if (endTimestamp !== null && archivedAt > endTimestamp) return false;
      if (selectedType !== 'ALL' && session.tournamentType !== selectedType) return false;
      if (
        playerQueryNormalized &&
        !session.playerNames.some((name) => name.toLowerCase().includes(playerQueryNormalized))
      ) {
        return false;
      }
      return true;
    });
  }, [sessions, startDate, endDate, selectedType, playerQuery]);

  const toggleSession = (sessionId: number) => {
    setExpandedSessions((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const toggleRound = (sessionId: number, roundNumber: number) => {
    const key = `${sessionId}-${roundNumber}`;
    setExpandedRounds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = (sessionId: number) => {
    startTransition(async () => {
      await onDelete(sessionId);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-10">
      <header className="mb-8">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Session History</h1>
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          Archived tournament snapshots saved at reset
        </p>
      </header>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start Date</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            />
          </label>
          <label className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">End Date</p>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            />
          </label>
          <label className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tournament Type</p>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            >
              {tournamentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Player</p>
            <input
              type="text"
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              placeholder="Find participant"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            />
          </label>
        </div>
      </section>

      {filteredSessions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-black uppercase tracking-widest text-slate-400">No sessions match filters</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Adjust date range, tournament type, or player name.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSessions.map((session) => {
            const isOpen = expandedSessions[session.id] ?? false;
            const roundsDescending = [...session.rounds].reverse();
            return (
              <article key={session.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">{session.tournamentType}</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {formatDate(session.archivedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">
                      {session.archiveReason ?? 'manual-reset'}
                    </span>
                    {session.id > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(session.id)}
                        disabled={isPending}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSession(session.id)}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase text-indigo-700 hover:bg-indigo-100"
                    >
                      {isOpen ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Players</p>
                    <p className="text-2xl font-black text-slate-900">{session.playerCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rounds</p>
                    <p className="text-2xl font-black text-slate-900">{session.roundsPlayed}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Courts</p>
                    <p className="text-2xl font-black text-slate-900">
                      {session.selectedCourts.length > 0 ? session.selectedCourts.join(', ') : '-'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Winners</p>
                    <p className="text-sm font-black uppercase text-emerald-700">
                      {session.winnerNames.length > 0 ? session.winnerNames.join(', ') : 'N/A'}
                    </p>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-5 space-y-3">
                    {roundsDescending.length === 0 ? (
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No round history saved</p>
                    ) : (
                      roundsDescending.map((round) => {
                        const roundKey = `${session.id}-${round.roundNumber}`;
                        const roundOpen = expandedRounds[roundKey] ?? false;
                        return (
                          <div key={round.roundNumber} className="rounded-2xl border border-slate-200 p-4">
                            <button
                              type="button"
                              onClick={() => toggleRound(session.id, round.roundNumber)}
                              className="w-full text-left text-sm font-black uppercase tracking-widest text-indigo-700"
                            >
                              {roundOpen ? '▾' : '▸'} Round {round.roundNumber}
                            </button>
                            {roundOpen && (
                              <div className="mt-3 space-y-2">
                                {round.matches.map((match) => (
                                  <div key={`${round.roundNumber}-${match.courtId}`} className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                                      Court {match.courtId} • Score: {match.score ?? 'N/A'} • Winner: {match.winner ?? 'N/A'}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                      Team A : {formatTeam(match.teamA)} vs Team B: {formatTeam(match.teamB)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
