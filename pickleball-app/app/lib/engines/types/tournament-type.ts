import type { Player, Match } from '@/app/lib/definitions';

export interface Team {
  id: string;
  name: string;
  players: [Player, Player];
  seed: number;
}

export interface MatchResult {
  winner: 'A' | 'B';
  score?: string | null;
}

export interface ITournamentStage<TConfig, TState, TStandings> {
  initialize(config: TConfig, participants: Team[]): TState;
  applyResult(state: TState, matchId: string, result: MatchResult): TState;
  getStandings(state: TState): TStandings;
  isComplete(state: TState): boolean;
  getAdvancingParticipants(state: TState, promoteCount: number): Team[];
}

export type { Player, Match };
