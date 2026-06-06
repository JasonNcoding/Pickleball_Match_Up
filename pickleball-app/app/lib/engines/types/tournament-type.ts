import type { Player, Match, LeaderboardEntry, GameMode } from '@/app/lib/definitions';

export interface MatchResult {
  winner: 'A' | 'B';
}

export interface PairingOutput {
  newMatches: Record<string, Match>;
  newWaiting: string[];
  updatedPlayers?: Player[];
  benchMessage?: string | null;
}

export interface ITournamentStage<TConfig, TState, TStandings> {
  initialize(config: TConfig, participants: Player[]): TState;
  applyResult(state: TState, matchId: string, result: MatchResult): TState;
  getStandings(state: TState): TStandings;
  isComplete(state: TState): boolean;
  getAdvancingParticipants(state: TState, promoteCount: number): Player[];
}

export type TournamentPhase =
  | { kind: 'setup' }
  | { kind: 'active'; round: number; mode: GameMode }
  | { kind: 'finished'; podium: LeaderboardEntry[] };
