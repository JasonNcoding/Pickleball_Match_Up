import type { Player, Match, Round } from '@/app/lib/definitions';
import type { gameMode } from '@/app/lib/tournament_mode/gameMode';
import type { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import type { CourtTeamDraft, SwapSelection } from '../shared/types';

// Rally modes are the three non-bracket game modes.
export type RallyMode =
  | gameMode.RALLYTOTHETOP
  | gameMode.KINGOFTHECOURT
  | gameMode.ROUNDROBIN;

export interface TournamentMeta {
  tournamentName: string;
  tournamentDate: string;  // YYYY-MM-DD
  courtCount: number;      // total courts at the venue (1-7)
}

export interface RallyState {
  // --- tournament metadata ---
  mode: RallyMode;
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

  // --- live game state ---
  waitingPlayers: string[];
  currentMatches: Record<string, Match>;
  history: Round[];

  // --- UI state ---
  isEditMode: boolean;
  showHistoryModal: boolean;
  swapSelection: SwapSelection;

  // --- persistence tracking ---
  saveKey: number;   // increments on every dirty mutation (not on LOAD_STATE / MARK_SAVED)
  lastSaved: Date | null;
  saveError: string | null;
}

export interface SwapSlot {
  courtId: string;
  team: 'A' | 'B';
  index: number;
}

export type RallyAction =
  | { type: 'LOAD_STATE'; payload: Partial<RallyState> }
  | { type: 'SET_MODE'; payload: RallyMode }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'SET_BULK_INPUT'; payload: string }
  | { type: 'SET_SELECTED_COURTS'; payload: string[] }
  | { type: 'SET_COURT_ORDER'; payload: string[] }
  | { type: 'MOVE_COURT'; payload: { index: number; direction: 'up' | 'down' } }
  | { type: 'TOGGLE_COURT_SELECTION'; payload: string }
  | { type: 'REORDER_COURT_BY_ID'; payload: { sourceId: string; targetId: string } }
  | { type: 'UPDATE_COURT_TEAM_DRAFT'; payload: { courtId: string; field: keyof CourtTeamDraft; value: string | [string, string] } }
  | { type: 'SET_EDIT_MODE'; payload: boolean }
  | { type: 'SET_SHOW_HISTORY_MODAL'; payload: boolean }
  | { type: 'SET_SWAP_SELECTION'; payload: SwapSelection }
  | { type: 'START_TOURNAMENT' }
  | { type: 'SWAP_PLAYERS_BY_POSITION'; payload: { source: SwapSlot; target: SwapSlot } }
  | { type: 'HANDLE_SWAP'; payload: { selection: Exclude<SwapSelection, null>; target: Exclude<SwapSelection, null> } }
  | { type: 'SET_MATCH_WINNER'; payload: { courtId: string; winner: 'A' | 'B' } }
  | { type: 'NEXT_ROUND' }
  | { type: 'UNDO_ROUND' }
  | { type: 'SET_TOURNAMENT_FINISHED' }
  | { type: 'RESET_TOURNAMENT_FINISHED' }
  | { type: 'SET_WAITING_PLAYERS'; payload: string[] }
  | { type: 'SET_CURRENT_MATCHES'; payload: Record<string, Match> }
  | { type: 'SET_HISTORY'; payload: Round[] }
  | { type: 'SET_METADATA'; payload: Partial<TournamentMeta> }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_SAVE_ERROR'; payload: string };
