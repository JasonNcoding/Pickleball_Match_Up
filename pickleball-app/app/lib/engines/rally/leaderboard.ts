import type { Player, Round } from '@/app/lib/definitions';

export interface LeaderboardEntry {
  name: string;
  winCount: number;
}

export interface CalculateLeaderboardInput {
  players: Player[];
  history: Round[];
  kingCourt?: string;
}

export function calculateLeaderboard(input: CalculateLeaderboardInput): LeaderboardEntry[] {
  const { players, history, kingCourt } = input;
  const wins: Record<string, number> = {};
  players.forEach((player) => {
    wins[player.id] = 0;
  });

  history.forEach((round, index) => {
    if (!kingCourt || index < 1) return;

    const kingMatch = round.matches[kingCourt];
    if (!kingMatch?.winner) return;

    const winners = kingMatch.winner === 'A' ? kingMatch.teamA : kingMatch.teamB;
    winners.forEach((winnerId) => {
      wins[winnerId] = (wins[winnerId] || 0) + 1;
    });
  });

  return Object.entries(wins)
    .map(([id, winCount]) => ({
      name: players.find((player) => player.id === id)?.name || id,
      winCount,
    }))
    .sort((a, b) => b.winCount - a.winCount);
}
