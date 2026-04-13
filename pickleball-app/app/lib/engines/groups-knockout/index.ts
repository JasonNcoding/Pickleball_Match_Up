export type {
  GroupsKnockoutTeam,
  GroupsKnockoutTeamStanding,
  GroupsKnockoutOptions,
  GroupsKnockoutState,
  // backward-compat aliases
  DuprTeam,
  DuprTeamStanding,
  DuprTournamentOptions,
  DuprTournamentState,
} from './types';

export { createTeams } from './teams';
export { buildRoundRobinRounds, mapRoundResultsToStandings, isRoundComplete, createTeamKeyLookup } from './round-robin';
export { buildKnockoutRounds, hydrateKnockoutRounds } from './knockout';
export { initialize, applyResult, getStandings, getFinalLeaderboard, advancePhase } from './tournament';
