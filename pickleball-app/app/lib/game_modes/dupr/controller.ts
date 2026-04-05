import {
  applyMatchWinner,
  createFixedPartnerTeams,
  getDuprFinalLeaderboard,
  getDuprStandings,
  initializeDuprTournament,
  maybeAdvanceDuprPhase,
  type DuprTeamStanding,
  type DuprTournamentState,
} from '@/app/lib/tournament_mode/duprTournament';

export type { DuprTeamStanding, DuprTournamentState };

export const duprDomain = {
  initialize: initializeDuprTournament,
  applyWinner: applyMatchWinner,
  advancePhase: maybeAdvanceDuprPhase,
  createTeams: createFixedPartnerTeams,
};

export function buildDuprLeaderboard(state: DuprTournamentState): DuprTeamStanding[] {
  return getDuprStandings(state);
}

export function buildDuprFinalLeaderboard(state: DuprTournamentState): DuprTeamStanding[] {
  return getDuprFinalLeaderboard(state);
}
