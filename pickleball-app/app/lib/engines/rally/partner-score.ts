import type { Round } from '@/app/lib/definitions';

export function hasPlayedTogetherInHistory(history: Round[], p1: string, p2: string): boolean {
  if (history.length === 0) return false;
  return history.some((round) =>
    Object.values(round.matches).some(
      (match) =>
        (match.teamA.includes(p1) && match.teamA.includes(p2)) ||
        (match.teamB.includes(p1) && match.teamB.includes(p2)),
    ),
  );
}

export function getPartnershipCount(history: Round[], p1: string, p2: string): number {
  let count = 0;
  history.forEach((round) => {
    Object.values(round.matches).forEach((match) => {
      if (
        (match.teamA.includes(p1) && match.teamA.includes(p2)) ||
        (match.teamB.includes(p1) && match.teamB.includes(p2))
      ) {
        count += 1;
      }
    });
  });
  return count;
}
