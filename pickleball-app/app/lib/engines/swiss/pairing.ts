import type { Player, Round, Match } from '@/app/lib/definitions';

export interface SwissPairingInput {
  teams: string[][];     // each team = sorted array of player IDs
  courts: string[];
  history: Round[];      // all confirmed Swiss rounds so far
  swissRound: number;    // 0-indexed current round number
  players: Player[];     // for rating lookup
}

function getKey(team: string[]): string {
  return team.slice().sort().join('|');
}

function getAvgRating(team: string[], players: Player[]): number {
  if (!team.length) return 0;
  const sum = team.reduce((a, id) => a + (players.find(p => p.id === id)?.rating ?? 0), 0);
  return sum / team.length;
}

function getTeamWins(teamKey: string, history: Round[]): number {
  let wins = 0;
  history.forEach(round => {
    Object.values(round.matches).forEach(m => {
      if (!m.winner) return;
      if (getKey(m.teamA) === teamKey && m.winner === 'A') wins++;
      if (getKey(m.teamB) === teamKey && m.winner === 'B') wins++;
    });
  });
  return wins;
}

function hasMetBefore(a: string[], b: string[], history: Round[]): boolean {
  const kA = getKey(a), kB = getKey(b);
  return history.some(round =>
    Object.values(round.matches).some(m => {
      const mA = getKey(m.teamA), mB = getKey(m.teamB);
      return (mA === kA && mB === kB) || (mA === kB && mB === kA);
    })
  );
}

// Greedy pairing: for each unmatched team in order, find the first unpaired team
// that hasn't met them before (fall back to any unpaired team if needed).
function pairGreedy(sorted: string[][], history: Round[]): [string[], string[]][] {
  const unpaired = [...sorted];
  const pairs: [string[], string[]][] = [];

  while (unpaired.length >= 2) {
    const a = unpaired.shift()!;
    // Try to find a non-rematch partner
    let idx = unpaired.findIndex(b => !hasMetBefore(a, b, history));
    if (idx === -1) idx = 0; // fallback: accept rematch
    const [b] = unpaired.splice(idx, 1);
    pairs.push([a, b]);
  }

  return pairs;
}

/**
 * Generate Swiss-format pairings for one round and return them as an ordered list.
 * Round 0: fold by rating. Round 1+: sort by wins DESC / rating DESC, greedy rematch-avoidance.
 */
export function generateSwissPairingsList(
  input: Omit<SwissPairingInput, 'courts'>,
): { teamA: string[]; teamB: string[] }[] {
  const { teams, history, swissRound, players } = input;
  let sorted: string[][];
  if (swissRound === 0) {
    sorted = [...teams].sort((a, b) => getAvgRating(b, players) - getAvgRating(a, players));
    const half = Math.floor(sorted.length / 2);
    const top = sorted.slice(0, half);
    const bottom = sorted.slice(half);
    const interleaved: string[][] = [];
    for (let i = 0; i < half; i++) {
      interleaved.push(top[i]);
      if (bottom[i]) interleaved.push(bottom[i]);
    }
    if (sorted.length % 2 !== 0) interleaved.push(sorted[sorted.length - 1]);
    sorted = interleaved;
  } else {
    sorted = [...teams].sort((a, b) => {
      const wDiff = getTeamWins(getKey(b), history) - getTeamWins(getKey(a), history);
      if (wDiff !== 0) return wDiff;
      return getAvgRating(b, players) - getAvgRating(a, players);
    });
  }
  const pairs = pairGreedy(sorted, history);
  return pairs.map(([teamA, teamB]) => ({ teamA, teamB }));
}

/**
 * Generate Swiss-format pairings for one round.
 * Round 0: fold by rating (rank 1 vs N/2+1, 2 vs N/2+2, …).
 * Round 1+: sort by wins DESC then rating DESC, pair greedily avoiding rematches.
 * Returns courtId → Match; courts with no match get an idle (empty) placeholder.
 */
export function generateSwissPairings(input: SwissPairingInput): Record<string, Match> {
  const { teams, courts, history, swissRound, players } = input;

  let sorted: string[][];

  if (swissRound === 0) {
    // Round 1: fold pairing by rating
    sorted = [...teams].sort((a, b) => getAvgRating(b, players) - getAvgRating(a, players));
    const half = Math.floor(sorted.length / 2);
    const top = sorted.slice(0, half);
    const bottom = sorted.slice(half);
    // Re-order so that top[0] is adjacent to bottom[0] for the greedy pairer
    const interleaved: string[][] = [];
    for (let i = 0; i < half; i++) {
      interleaved.push(top[i]);
      if (bottom[i]) interleaved.push(bottom[i]);
    }
    // Remaining (odd team) stays unpaired
    if (sorted.length % 2 !== 0) interleaved.push(sorted[sorted.length - 1]);
    sorted = interleaved;
  } else {
    // Round 2+: sort by wins DESC, then rating DESC
    sorted = [...teams].sort((a, b) => {
      const wDiff = getTeamWins(getKey(b), history) - getTeamWins(getKey(a), history);
      if (wDiff !== 0) return wDiff;
      return getAvgRating(b, players) - getAvgRating(a, players);
    });
  }

  const pairs = pairGreedy(sorted, history);

  // Assign pairs to courts
  const result: Record<string, Match> = {};
  courts.forEach((courtId, i) => {
    const pair = pairs[i];
    result[courtId] = pair
      ? { teamA: pair[0], teamB: pair[1], winner: null }
      : { teamA: [], teamB: [], winner: null }; // idle
  });

  return result;
}
