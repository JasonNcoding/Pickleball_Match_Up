import type { Player, Match } from '@/app/lib/definitions';
import { generateBracket } from './bracket';

export interface KnockoutState {
  eliminatedPlayerIds: string[];
  knockoutRound: number;
}

export interface AdvanceResult {
  nextState: KnockoutState;
  newMatches: Record<string, Match>;
  activeCourts: string[];
  isFinished: boolean;
  champions: Player[];
}

export function advanceWinners(
  currentMatches: Record<string, Match>,
  activeCourts: string[],
  allPlayers: Player[],
  state: KnockoutState,
  allCourts: string[],
  fixedPartners?: Record<string, string>,
  teamSize: 1 | 2 = 2,
): AdvanceResult {
  const newEliminated = [...state.eliminatedPlayerIds];

  activeCourts.forEach(cId => {
    const m = currentMatches[cId];
    if (!m || !m.winner) return;
    const losers = m.winner === 'A' ? m.teamB : m.teamA;
    losers.forEach(id => {
      if (!newEliminated.includes(id)) newEliminated.push(id);
    });
  });

  const survivors = allPlayers.filter(p => !newEliminated.includes(p.id));

  // Finished when surviving players = one winning team (teamSize players)
  const isFinished = survivors.length <= teamSize;

  if (isFinished) {
    return {
      nextState: { eliminatedPlayerIds: newEliminated, knockoutRound: state.knockoutRound + 1 },
      newMatches: {},
      activeCourts: [],
      isFinished: true,
      champions: survivors,
    };
  }

  const { newMatches, activeCourts: nextCourts } = generateBracket(survivors, allCourts, fixedPartners, teamSize);

  return {
    nextState: { eliminatedPlayerIds: newEliminated, knockoutRound: state.knockoutRound + 1 },
    newMatches,
    activeCourts: nextCourts,
    isFinished: false,
    champions: [],
  };
}

export function isKnockoutComplete(
  currentMatches: Record<string, Match>,
  activeCourts: string[],
  allPlayers: Player[],
  state: KnockoutState,
  teamSize: 1 | 2 = 2,
): boolean {
  const survivors = allPlayers.filter(p => !state.eliminatedPlayerIds.includes(p.id));
  const ppc = teamSize * 2; // players on the final court (1 match = 2 teams)
  return activeCourts.length === 1 && survivors.length <= ppc && Object.values(currentMatches).every(m => !!m.winner);
}
