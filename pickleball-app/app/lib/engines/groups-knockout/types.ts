import type { Player, Match, Round } from '@/app/lib/definitions';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';

export type { Player, Match, Round };

export interface GroupsKnockoutTeam {
  id: string;
  name: string;
  players: [Player, Player];
  seed: number;
}

export interface GroupsKnockoutTeamStanding {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

export interface GroupsKnockoutOptions {
  roundRobinRounds?: number;
  knockoutSize?: 4 | 8;
}

export interface GroupsKnockoutState {
  mode: gameMode.GROUP_KNOCKOUT;
  teams: GroupsKnockoutTeam[];
  roundRobinRounds: number;
  knockoutSize: 4 | 8;
  phase: 'ROUND_ROBIN' | 'KNOCKOUT' | 'COMPLETED';
  rounds: Round[];
  currentRoundNumber: number;
}

/** @deprecated Use GroupsKnockoutTeam */
export type DuprTeam = GroupsKnockoutTeam;
/** @deprecated Use GroupsKnockoutTeamStanding */
export type DuprTeamStanding = GroupsKnockoutTeamStanding;
/** @deprecated Use GroupsKnockoutOptions */
export type DuprTournamentOptions = GroupsKnockoutOptions;
/** @deprecated Use GroupsKnockoutState */
export type DuprTournamentState = GroupsKnockoutState;
