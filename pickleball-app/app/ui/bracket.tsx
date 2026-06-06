'use client';

import type { Player, Match, Round } from '@/app/lib/definitions';
import type { KnockoutState } from '@/app/lib/engines/single-elimination';

interface BracketProps {
  players: Player[];
  history: Round[];
  currentMatches: Record<string, Match>;
  activeCourts: string[];
  knockoutState: KnockoutState;
  champions: Player[];
  capitalize: (s: string) => string;
}

export function BracketView({
  players, history, currentMatches, activeCourts, knockoutState, champions, capitalize,
}: BracketProps) {
  const eliminated = new Set(knockoutState.eliminatedPlayerIds);

  type Status = 'champion' | 'active' | 'eliminated';
  const getStatus = (player: Player): Status => {
    if (champions.some(c => c.id === player.id)) return 'champion';
    if (eliminated.has(player.id)) return 'eliminated';
    return 'active';
  };

  const allRounds = [...history, { id: history.length, matches: currentMatches, waiting: [] }];

  return (
    <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl space-y-4">
      <h2 className="text-xl font-black italic tracking-tighter uppercase text-center">
        Bracket — Round {knockoutState.knockoutRound + 1}
      </h2>

      {/* Player status grid */}
      <div className="space-y-2">
        {players.map(p => {
          const status = getStatus(p);
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-2 rounded-xl transition-all
                ${status === 'champion' ? 'bg-amber-500 text-black' : ''}
                ${status === 'active' ? 'bg-slate-800 text-white' : ''}
                ${status === 'eliminated' ? 'bg-slate-700 text-slate-500 line-through' : ''}`}
            >
              <span className="font-black text-sm uppercase">{capitalize(p.name)}</span>
              {status === 'champion' && <span className="text-xs font-black">👑 CHAMPION</span>}
              {status === 'active' && <span className="text-xs font-bold text-slate-400">STILL IN</span>}
              {status === 'eliminated' && <span className="text-xs font-bold">OUT</span>}
            </div>
          );
        })}
      </div>

      {/* Round history summary */}
      {history.length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
            {history.length} Round{history.length !== 1 ? 's' : ''} Completed
          </p>
          {allRounds.slice(0, -1).map((round, i) => (
            <div key={i} className="text-[11px] text-slate-400 mb-1">
              <span className="font-black text-slate-300">R{i + 1}: </span>
              {Object.entries(round.matches).map(([cId, m]) => {
                if (!m.winner) return null;
                const winners = m.winner === 'A' ? m.teamA : m.teamB;
                return (
                  <span key={cId} className="mr-2">
                    Court {cId} → {winners.map(id => capitalize(players.find(p => p.id === id)?.name || id)).join(' & ')}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
