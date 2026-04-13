import {
  createTeams,
  getFinalLeaderboard,
  getStandings,
  initialize,
  advancePhase,
  applyResult,
  type GroupsKnockoutTeamStanding,
  type GroupsKnockoutState,
} from '@/app/lib/engines/groups-knockout';

export type DuprTeamStanding = GroupsKnockoutTeamStanding;
export type DuprTournamentState = GroupsKnockoutState;

export const duprDomain = {
  initialize,
  applyWinner: applyResult,
  advancePhase,
  createTeams,
};

export function buildDuprLeaderboard(state: GroupsKnockoutState): GroupsKnockoutTeamStanding[] {
  return getStandings(state);
}

export function buildDuprFinalLeaderboard(state: GroupsKnockoutState): GroupsKnockoutTeamStanding[] {
  return getFinalLeaderboard(state);
}
