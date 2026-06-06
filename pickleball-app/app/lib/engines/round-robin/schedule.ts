import type { ScheduledMatch } from '@/app/lib/definitions';

/**
 * Circle method (Berger tables) round-robin schedule.
 * For N teams: produces N-1 rounds × N/2 matches per round = N*(N-1)/2 total.
 * Supports legs > 1 (each pair meets `legs` times).
 */
export function generateFullSchedule(
  teams: string[][],
  legs: number = 1,
): ScheduledMatch[] {
  const n = teams.length;
  if (n < 2) return [];

  // For odd N, add a phantom "bye" team so the algorithm stays symmetric.
  const table: (string[] | null)[] = n % 2 === 0
    ? [...teams]
    : [...teams, null];
  const N = table.length; // always even

  const matches: ScheduledMatch[] = [];

  for (let leg = 0; leg < legs; leg++) {
    const t = [...table];

    for (let round = 0; round < N - 1; round++) {
      for (let i = 0; i < N / 2; i++) {
        const home = t[i];
        const away = t[N - 1 - i];
        if (home && away) {
          // Alternate which side is A/B each leg to balance home/away.
          if (leg % 2 === 0) {
            matches.push({ id: `m-${matches.length}`, teamA: home, teamB: away });
          } else {
            matches.push({ id: `m-${matches.length}`, teamA: away, teamB: home });
          }
        }
      }
      // Rotate: pin t[0], shift the rest one step clockwise.
      const fixed = t[0];
      const rotating = t.slice(1);
      rotating.unshift(rotating.pop()!);
      t.splice(0, N, fixed, ...rotating);
    }
  }

  return matches;
}
