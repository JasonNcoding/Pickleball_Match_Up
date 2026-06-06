import type { Player, Match, Round } from '@/app/lib/definitions';
import type { PairingOutput } from '@/app/lib/engines/types';
import { selectPlayersForBench, applyBenchCounts } from '@/app/lib/bench-rotation';
import { getPartnershipCount, hasPlayedTogetherRecently } from './partner-score';

export interface RallyPairingInput {
  isFirst: boolean;
  roster: Player[];
  courts: string[];        // ordered (index 0 = king court)
  history: Round[];
  currentMatches: Record<string, Match>;
  waitingPlayers: string[];
  teamSize?: 1 | 2;
}

export function generateRallyPairings(input: RallyPairingInput): PairingOutput & { updatedPlayers: Player[]; benchMessage: string | null } {
  const { isFirst, roster, courts, history, currentMatches, waitingPlayers, teamSize = 2 } = input;
  const ppc = teamSize * 2; // players per court
  const needed = courts.length * ppc;
  let playingIds: string[] = [];
  let waitingIds: string[] = [];
  let updatedPlayers = [...roster];
  let benchMessage: string | null = null;

  if (isFirst) {
    const sortedIds = [...roster].sort((a, b) => a.rating - b.rating).map(p => p.id);
    playingIds = sortedIds.slice(0, needed);
    waitingIds = sortedIds.slice(needed);
  } else {
    // Rally ranking: winners move up, losers move down
    const rankedPool: string[][] = [];
    courts.forEach((cId) => {
      const m = currentMatches[cId];
      rankedPool.push(m.winner === 'A' ? m.teamA : m.teamB); // winners
      rankedPool.push(m.winner === 'A' ? m.teamB : m.teamA); // losers
    });

    const newOrder: string[][] = [rankedPool[0]];
    for (let i = 1; i < courts.length; i++) {
      newOrder.push(rankedPool[i * 2], rankedPool[(i - 1) * 2 + 1]);
    }

    const bottomCourtId = courts[courts.length - 1];
    const bottomMatch = currentMatches[bottomCourtId];
    const roundNumber = history.length;

    const { toBenchIds, message } = selectPlayersForBench({
      bottomCourtMatch: bottomMatch,
      waitingCount: waitingPlayers.length,
      players: roster,
      currentRound: roundNumber,
      teamSize,
    });

    if (toBenchIds.length > 0) {
      updatedPlayers = applyBenchCounts(roster, toBenchIds, roundNumber);
      benchMessage = message;
    }

    const filteredNewOrder = newOrder.map(group => group.filter(id => !toBenchIds.includes(id)));
    const bottomLosers = (bottomMatch.winner === 'A' ? bottomMatch.teamB : bottomMatch.teamA)
      .filter(id => !toBenchIds.includes(id));
    const comingIn = [...waitingPlayers];

    const totalPool = [...filteredNewOrder.flat(), ...bottomLosers, ...comingIn];
    playingIds = totalPool.slice(0, needed);
    waitingIds = toBenchIds.length > 0 ? [...toBenchIds] : totalPool.slice(needed);
  }

  const newMatches: Record<string, Match> = {};
  courts.forEach((cId, i) => {
    const p = playingIds.slice(i * ppc, (i + 1) * ppc);
    if (teamSize === 1) {
      newMatches[cId] = { teamA: [p[0]], teamB: [p[1]], winner: null };
    } else {
      const combos = [
        { teamA: [p[0], p[3]], teamB: [p[1], p[2]] },
        { teamA: [p[0], p[2]], teamB: [p[1], p[3]] },
        { teamA: [p[0], p[1]], teamB: [p[2], p[3]] },
      ];
      const scored = combos.map(c => ({
        ...c,
        score:
          (hasPlayedTogetherRecently(c.teamA[0], c.teamA[1], history) ? 100 : 0) +
          (hasPlayedTogetherRecently(c.teamB[0], c.teamB[1], history) ? 100 : 0) +
          getPartnershipCount(c.teamA[0], c.teamA[1], history) +
          getPartnershipCount(c.teamB[0], c.teamB[1], history),
      })).sort((a, b) => a.score - b.score);
      newMatches[cId] = { ...scored[0], winner: null };
    }
  });

  return { newMatches, newWaiting: waitingIds, updatedPlayers, benchMessage };
}
