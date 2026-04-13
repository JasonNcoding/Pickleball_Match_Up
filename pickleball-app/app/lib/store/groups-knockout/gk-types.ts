import type { Player, Match, Round } from '@/app/lib/definitions';
import type { gameMode } from '@/app/lib/tournament_mode/gameMode';
import type { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import type { GroupsKnockoutState } from '@/app/lib/engines/groups-knockout';
import type { DuprMatchLogEntry } from '@/app/lib/game_modes/dupr/model';
import type { CourtTeamDraft } from '../shared/types';

export type GKKnockoutStage = 'SEMIFINAL' | 'QUARTERFINAL';

export interface GKScoreDraft {
  teamA: string;
  teamB: string;
}

export interface GKUnassignedMatch {
  roundIndex: number;
  matchId: string;
}

export interface GKState {
  // --- tournament metadata ---
  mode: gameMode.GROUP_KNOCKOUT;
  status: tournamentStatus;
  tournamentName: string;
  tournamentDate: string;
  courtCount: number;

  // --- setup ---
  players: Player[];
  selectedCourts: string[];
  courtOrder: string[];
  bulkInput: string;
  courtTeamDrafts: Record<string, CourtTeamDraft>;

  // --- GK-specific setup ---
  teamMode: 'manual' | 'random';
  knockoutStage: GKKnockoutStage;
  draftPlayers: Player[] | null;
  draftSelection: number | null;
  teamsConfirmed: boolean;

  // --- live game state ---
  gkState: GroupsKnockoutState | null;
  gkInitialState: GroupsKnockoutState | null;
  waitingPlayers: string[];
  currentMatches: Record<string, Match>;
  history: Round[];
  unassignedMatches: GKUnassignedMatch[];
  scoreDrafts: Record<string, GKScoreDraft>;
  matchLog: DuprMatchLogEntry[];

  // --- UI state ---
  showHistoryModal: boolean;

  // --- persistence tracking ---
  saveKey: number;
  lastSaved: Date | null;
  saveError: string | null;
}

export type GKAction =
  | { type: 'LOAD_STATE'; payload: Partial<GKState> }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'SET_BULK_INPUT'; payload: string }
  | { type: 'SET_SELECTED_COURTS'; payload: string[] }
  | { type: 'MOVE_COURT'; payload: { index: number; direction: 'up' | 'down' } }
  | { type: 'TOGGLE_COURT_SELECTION'; payload: string }
  | { type: 'REORDER_COURT_BY_ID'; payload: { sourceId: string; targetId: string } }
  | { type: 'UPDATE_COURT_TEAM_DRAFT'; payload: { courtId: string; field: keyof CourtTeamDraft; value: string | [string, string] } }
  | { type: 'SET_TEAM_MODE'; payload: 'manual' | 'random' }
  | { type: 'SET_KNOCKOUT_STAGE'; payload: GKKnockoutStage }
  | { type: 'GENERATE_DRAFT_TEAMS' }
  | { type: 'SWAP_DRAFT_PLAYERS'; payload: number }
  | { type: 'CONFIRM_TEAMS' }
  | { type: 'START_TOURNAMENT'; payload: GroupsKnockoutState }
  | { type: 'SEED_ROUND_QUEUE'; payload: GKUnassignedMatch[] }
  | { type: 'ASSIGN_MATCH_TO_COURT'; payload: { matchId: string; courtId: string; roundIndex: number; match: Match } }
  | { type: 'UNASSIGN_COURT'; payload: { courtId: string; matchId: string; roundIndex: number } }
  | { type: 'SET_WINNER_ON_COURT'; payload: { courtId: string; winner: 'A' | 'B' } }
  | { type: 'SET_SCORE_DRAFT'; payload: { matchId: string; team: 'A' | 'B'; score: string } }
  | { type: 'COMPLETE_COURT_MATCH'; payload: { courtId: string; updatedGkState: GroupsKnockoutState; logEntry: DuprMatchLogEntry; roundHistory: Round } }
  | { type: 'UNDO_LAST_MATCH'; payload: { rebuiltState: GroupsKnockoutState; unassignedMatches: GKUnassignedMatch[] } }
  | { type: 'SET_METADATA'; payload: { tournamentName?: string; tournamentDate?: string; courtCount?: number } }
  | { type: 'SET_SHOW_HISTORY_MODAL'; payload: boolean }
  | { type: 'SET_TOURNAMENT_FINISHED' }
  | { type: 'RESET_TOURNAMENT_FINISHED' }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_SAVE_ERROR'; payload: string };
