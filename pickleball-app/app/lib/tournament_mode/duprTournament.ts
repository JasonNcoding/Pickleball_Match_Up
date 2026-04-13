// Shim — all logic lives in engines/groups-knockout/. This file remains for backward compatibility.
export type {
  GroupsKnockoutTeam as DuprTeam,
  GroupsKnockoutTeamStanding as DuprTeamStanding,
  GroupsKnockoutOptions as DuprTournamentOptions,
  GroupsKnockoutState as DuprTournamentState,
} from '@/app/lib/engines/groups-knockout';

export {
  createTeams as createFixedPartnerTeams,
  initialize as initializeDuprTournament,
  applyResult as applyMatchWinner,
  advancePhase as maybeAdvanceDuprPhase,
  getStandings as getDuprStandings,
  getFinalLeaderboard as getDuprFinalLeaderboard,
} from '@/app/lib/engines/groups-knockout';

