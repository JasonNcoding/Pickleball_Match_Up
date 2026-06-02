import type { Match, Player } from './definitions';

export interface BenchRotationInput {
  bottomCourtMatch: Match;
  waitingCount: number;
  players: Player[];
  currentRound: number;
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
  const { bottomCourtMatch, waitingCount, players, currentRound } = input;

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

  if (waitingCount === 1) {
    const bench = sortedLosers[0];
    return {
      toBenchIds: [bench],
      message: `Auto-bench: ${playerName(bench)} (bottom court loser, lowest bench count)`,
    };
  }

  if (waitingCount === 2) {
    return {
      toBenchIds: losers,
      message: `Auto-bench: ${losers.map(playerName).join(', ')} (bottom court losing team)`,
    };
  }

  if (waitingCount === 3) {
    const extraBench = sortedWinners[0];
    return {
      toBenchIds: [...losers, extraBench],
      message: `Auto-bench: ${[...losers, extraBench].map(playerName).join(', ')} (losing team + 1 winner with lowest bench count)`,
    };
  }

  // 4+ extras: not handled
  return { toBenchIds: [], message: `${waitingCount} bench slots — add more courts to reduce extras` };
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
