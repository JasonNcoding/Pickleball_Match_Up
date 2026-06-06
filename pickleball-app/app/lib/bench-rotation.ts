import type { Match, Player } from './definitions';

export interface BenchRotationInput {
  bottomCourtMatch: Match;
  waitingCount: number;
  players: Player[];
  currentRound: number;
  teamSize?: 1 | 2; // default 2
}

export interface BenchRotationResult {
  toBenchIds: string[];
  message: string;
}

// Sort player IDs by bench priority:
// 1. Lowest benchCount first (they've rested less)
// 2. Tiebreaker: null lastBenchedRound first (never benched = longest streak = bench them)
//    Otherwise, smallest lastBenchedRound first (benched earliest = longest since last bench)
export function sortByBenchPriority(ids: string[], players: Player[]): string[] {
  return [...ids].sort((a, b) => {
    const pa = players.find(p => p.id === a);
    const pb = players.find(p => p.id === b);
    const aCount = pa?.benchCount ?? 0;
    const bCount = pb?.benchCount ?? 0;
    if (aCount !== bCount) return aCount - bCount;
    const aLast = pa?.lastBenchedRound ?? -Infinity;
    const bLast = pb?.lastBenchedRound ?? -Infinity;
    return (aLast as number) - (bLast as number);
  });
}

// Determine which active players should go to bench for the next round.
// Returns empty array if no rotation is needed or if the match has no winner.
//
// Rules:
//   +1 extra on bench: pick 1 from bottom court losing team (lowest bench count)
//   +2 extra:          both bottom court losers bench
//   +3 extra:          both bottom court losers + 1 from winning team (lowest bench count)
//   4+:                not handled (admin should add more courts)
//
// TODO: handle mid-tournament player removal (out of scope for MVP)
export function selectPlayersForBench(input: BenchRotationInput): BenchRotationResult {
  const { bottomCourtMatch, waitingCount, players, currentRound, teamSize = 2 } = input;

  if (waitingCount === 0 || !bottomCourtMatch.winner) {
    return { toBenchIds: [], message: '' };
  }

  const losers = bottomCourtMatch.winner === 'A'
    ? [...bottomCourtMatch.teamB]
    : [...bottomCourtMatch.teamA];
  const winners = bottomCourtMatch.winner === 'A'
    ? [...bottomCourtMatch.teamA]
    : [...bottomCourtMatch.teamB];

  const sortedLosers = sortByBenchPriority(losers, players);
  const sortedWinners = sortByBenchPriority(winners, players);
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? id;

  // Max players we can pull from the bottom court = full losing team + full winning team
  const maxHandled = teamSize * 2;
  if (waitingCount > maxHandled) {
    return { toBenchIds: [], message: `${waitingCount} bench slots — add more courts to reduce extras` };
  }

  const benchFromLosers = Math.min(waitingCount, teamSize);
  const benchFromWinners = Math.min(waitingCount - benchFromLosers, teamSize);

  const toBenchIds = [
    ...sortedLosers.slice(0, benchFromLosers),
    ...sortedWinners.slice(0, benchFromWinners),
  ];

  return {
    toBenchIds,
    message: `Auto-bench: ${toBenchIds.map(playerName).join(', ')}`,
  };
}

// Apply updated bench counts to the player list.
export function applyBenchCounts(
  players: Player[],
  toBenchIds: string[],
  roundNumber: number,
): Player[] {
  return players.map(p =>
    toBenchIds.includes(p.id)
      ? { ...p, benchCount: (p.benchCount ?? 0) + 1, lastBenchedRound: roundNumber }
      : p,
  );
}
