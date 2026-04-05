import { Player, Match, Round } from '../definitions';
import { gameMode } from './gameMode';
import { tournamentStatus } from './tournamentStatus';

export interface TournamentType {
  mode: gameMode;
  date_created: Date;
  status: tournamentStatus;
  courtOrder: number[];
  leaderboard: Record<number, Player>;
  players: Player[] | null;
  rounds: Round[];
  waitList: Player[] | null;
  currentRoundNumber: number;

  getNextRound(): Round | null;
  getLastRound(): Round | null;
  save(): void;
  load(): TournamentType;

}
