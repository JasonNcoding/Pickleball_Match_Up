import type { Match, Player, Round } from '@/app/lib/definitions';
import { getPartnershipCount, hasPlayedTogetherInHistory } from './partner-score';

export interface GenerateRoundPairingsInput {
  isFirst: boolean;
  roster: Player[];
  courts: string[];
  currentMatches: Record<string, Match>;
  waitingPlayers: string[];
  courtOrder: string[];
  history: Round[];
}

export interface GenerateRoundPairingsResult {
  matches: Record<string, Match>;
  waitingIds: string[];
}

export function reconcileCourtOrder(prevOrder: string[], selectedCourts: string[]): string[] {
  const kept = selectedCourts.filter((court) => prevOrder.includes(court));
  const added = selectedCourts.filter((court) => !prevOrder.includes(court));
  return [...kept, ...added];
}

export function generateRoundPairings(input: GenerateRoundPairingsInput): GenerateRoundPairingsResult {
  const { isFirst, roster, courts, currentMatches, waitingPlayers, courtOrder, history } = input;
  const needed = courts.length * 4;
  let playingIds: string[] = [];
  let waitingIds: string[] = [];

  if (isFirst) {
    const sortedIds = [...roster].sort((a, b) => a.rating - b.rating).map((player) => player.id);
    playingIds = sortedIds.slice(0, needed);
    waitingIds = sortedIds.slice(needed);
  } else {
    const rankedPool: string[][] = [];

    courtOrder.forEach((courtId) => {
      const match = currentMatches[courtId];
      const winnerTeam = match?.winner === 'B' ? match.teamB : match?.teamA ?? [];
      const loserTeam = match?.winner === 'B' ? match.teamA : match?.teamB ?? [];
      rankedPool.push(winnerTeam);
      rankedPool.push(loserTeam);
    });

    const newOrder: string[][] = [rankedPool[0] ?? []];
    for (let i = 1; i < courtOrder.length; i++) {
      newOrder.push(rankedPool[i * 2] ?? [], rankedPool[(i - 1) * 2 + 1] ?? []);
    }

    const totalPool = [
      ...newOrder.flat(),
      ...waitingPlayers,
      ...(rankedPool[rankedPool.length - 1] ?? []),
    ];
    playingIds = totalPool.slice(0, needed);
    waitingIds = totalPool.slice(needed);
  }

  const matches: Record<string, Match> = {};
  courtOrder.forEach((courtId, index) => {
    const p = playingIds.slice(index * 4, (index + 1) * 4);
    const combos = [
      { teamA: [p[0], p[3]], teamB: [p[1], p[2]] },
      { teamA: [p[0], p[2]], teamB: [p[1], p[3]] },
      { teamA: [p[0], p[1]], teamB: [p[2], p[3]] },
    ];

    const scored = combos
      .map((combo) => ({
        ...combo,
        score:
          (hasPlayedTogetherInHistory(history, combo.teamA[0], combo.teamA[1]) ? 100 : 0) +
          (hasPlayedTogetherInHistory(history, combo.teamB[0], combo.teamB[1]) ? 100 : 0) +
          getPartnershipCount(history, combo.teamA[0], combo.teamA[1]) +
          getPartnershipCount(history, combo.teamB[0], combo.teamB[1]),
      }))
      .sort((a, b) => a.score - b.score);

    const best = scored[0];
    matches[courtId] = {
      id: `${courtId}-${index}`,
      teamA: best.teamA,
      teamB: best.teamB,
      winner: null,
      score: null,
    };
  });

  return { matches, waitingIds };
}
