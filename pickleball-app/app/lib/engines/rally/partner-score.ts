import type { Round } from '@/app/lib/definitions';

export function getPartnershipCount(p1: string, p2: string, history: Round[]): number {
  let count = 0;
  history.forEach(round => {
    Object.values(round.matches).forEach(m => {
      if (
        (m.teamA.includes(p1) && m.teamA.includes(p2)) ||
        (m.teamB.includes(p1) && m.teamB.includes(p2))
      ) count++;
    });
  });
  return count;
}

export function hasPlayedTogetherRecently(p1: string, p2: string, history: Round[]): boolean {
  if (history.length === 0) return false;
  return history.some(round =>
    Object.values(round.matches).some(m =>
      (m.teamA.includes(p1) && m.teamA.includes(p2)) ||
      (m.teamB.includes(p1) && m.teamB.includes(p2))
    )
  );
}
