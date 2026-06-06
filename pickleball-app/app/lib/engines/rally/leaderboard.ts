import type { Player, Round, Match, LeaderboardEntry } from '@/app/lib/definitions';

export interface RallyLeaderboardInput {
  players: Player[];
  history: Round[];
  currentMatches: Record<string, Match>;
  kingCourt: string;
  bottomCourt: string;
}

export function calculateRallyLeaderboard(input: RallyLeaderboardInput): LeaderboardEntry[] {
  const { players, history, currentMatches, kingCourt, bottomCourt } = input;
  const wins: Record<string, number> = {};
  players.forEach(p => { wins[p.id] = 0; });

  const bonusEnabled = bottomCourt !== kingCourt;
  const hasBeenOnBottom: Record<string, boolean> = {};
  const hasReceivedBonus: Record<string, boolean> = {};

  history.forEach((round, index) => {
    if (bonusEnabled) {
      const bm = round.matches[bottomCourt];
      if (bm) [...bm.teamA, ...bm.teamB].forEach(id => { hasBeenOnBottom[id] = true; });
    }

    if (index >= 1) {
      const km = round.matches[kingCourt];
      if (km) {
        if (km.winner) {
          const winners = km.winner === 'A' ? km.teamA : km.teamB;
          winners.forEach(wId => { wins[wId] = (wins[wId] || 0) + 1; });
        }
        if (bonusEnabled) {
          [...km.teamA, ...km.teamB].forEach(pId => {
            if (hasBeenOnBottom[pId] && !hasReceivedBonus[pId]) {
              wins[pId] = (wins[pId] || 0) + 1;
              hasReceivedBonus[pId] = true;
            }
          });
        }
      }
    }
  });

  // Live round bonus: fires as soon as player is placed on king court
  if (bonusEnabled && history.length >= 1) {
    const km = currentMatches[kingCourt];
    if (km) {
      [...km.teamA, ...km.teamB].forEach(pId => {
        if (hasBeenOnBottom[pId] && !hasReceivedBonus[pId]) {
          wins[pId] = (wins[pId] || 0) + 1;
          hasReceivedBonus[pId] = true;
        }
      });
    }
  }

  return Object.entries(wins)
    .map(([id, winCount]) => ({
      id,
      name: players.find(p => p.id === id)?.name || id,
      winCount,
    }))
    .sort((a, b) => b.winCount - a.winCount);
}
