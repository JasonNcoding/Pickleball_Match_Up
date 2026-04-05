import type { Match } from '@/app/lib/definitions';
import type { DuprTournamentState } from '@/app/lib/tournament_mode/duprTournament';

export type { DuprTournamentState } from '@/app/lib/tournament_mode/duprTournament';

export type DuprPhase = 'ROUND_ROBIN' | 'KNOCKOUT' | 'COMPLETED';

export type DuprMatchLogEntry = {
  id: string;
  phase: 'ROUND_ROBIN' | 'KNOCKOUT';
  roundIndex: number;
  matchId: string;
  teamA: string[];
  teamB: string[];
  score: string;
  winner: 'A' | 'B';
};

export function findMatchRoundIndex(state: DuprTournamentState, matchId: string): number {
  return state.rounds.findIndex((round) => Boolean(round.matches[matchId]));
}

export function getFinalMatch(state: DuprTournamentState): Match | null {
  if (state.rounds.length === 0) return null;
  const finalRound = state.rounds[state.rounds.length - 1];
  const finalMatch = finalRound ? Object.values(finalRound.matches)[0] : null;
  return finalMatch ?? null;
}
