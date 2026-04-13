import { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { generateRoundPairings, reconcileCourtOrder } from '@/app/lib/engines/rally';
import type { Match } from '@/app/lib/definitions';
import type { CourtTeamDraft } from '../shared/types';
import type { RallyState, RallyAction } from './rally-types';

export const initialRallyState: RallyState = {
  mode: gameMode.RALLYTOTHETOP,
  status: tournamentStatus.SETUP,
  tournamentName: '',
  tournamentDate: '',
  courtCount: 7,
  players: [],
  selectedCourts: ['3', '4', '5', '6', '7'],
  courtOrder: ['3', '4', '5', '6', '7'],
  bulkInput: '',
  courtTeamDrafts: {},
  waitingPlayers: [],
  currentMatches: {},
  history: [],
  isEditMode: false,
  showHistoryModal: false,
  swapSelection: null,
  saveKey: 0,
  lastSaved: null,
  saveError: null,
};

function buildDefaultCourtDraft(courtId: string): CourtTeamDraft {
  return {
    teamAName: `Court ${courtId} Team A`,
    teamBName: `Court ${courtId} Team B`,
    teamAPlayers: ['', ''],
    teamBPlayers: ['', ''],
  };
}

export function rallyReducer(state: RallyState, action: RallyAction): RallyState {
  switch (action.type) {
    case 'LOAD_STATE':
      // LOAD_STATE does NOT increment saveKey — loading is not a dirty mutation.
      return { ...state, ...action.payload };

    case 'SET_MODE':
      return { ...state, mode: action.payload, saveKey: state.saveKey + 1 };

    case 'SET_METADATA':
      return { ...state, ...action.payload, saveKey: state.saveKey + 1 };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload, saveKey: state.saveKey + 1 };

    case 'SET_BULK_INPUT':
      return { ...state, bulkInput: action.payload, saveKey: state.saveKey + 1 };

    case 'SET_SELECTED_COURTS': {
      const newOrder = reconcileCourtOrder(state.courtOrder, action.payload);
      const updatedDrafts = { ...state.courtTeamDrafts };
      action.payload.forEach((courtId) => {
        if (!updatedDrafts[courtId]) {
          updatedDrafts[courtId] = buildDefaultCourtDraft(courtId);
        }
      });
      return {
        ...state,
        selectedCourts: action.payload,
        courtOrder: newOrder,
        courtTeamDrafts: updatedDrafts,
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_COURT_ORDER':
      return { ...state, courtOrder: action.payload, saveKey: state.saveKey + 1 };

    case 'MOVE_COURT': {
      const { index, direction } = action.payload;
      const newOrder = [...state.courtOrder];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return state;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      return { ...state, courtOrder: newOrder, saveKey: state.saveKey + 1 };
    }

    case 'TOGGLE_COURT_SELECTION': {
      const courtId = action.payload;
      const next = state.selectedCourts.includes(courtId)
        ? state.selectedCourts.filter((id) => id !== courtId)
        : [...state.selectedCourts, courtId];
      const newOrder = reconcileCourtOrder(state.courtOrder, next);
      return {
        ...state,
        selectedCourts: next,
        courtOrder: newOrder,
        saveKey: state.saveKey + 1,
      };
    }

    case 'REORDER_COURT_BY_ID': {
      const { sourceId, targetId } = action.payload;
      if (sourceId === targetId) return state;
      const src = state.courtOrder.indexOf(sourceId);
      const dst = state.courtOrder.indexOf(targetId);
      if (src === -1 || dst === -1) return state;
      const next = [...state.courtOrder];
      const [moved] = next.splice(src, 1);
      next.splice(dst, 0, moved);
      return { ...state, courtOrder: next, saveKey: state.saveKey + 1 };
    }

    case 'UPDATE_COURT_TEAM_DRAFT': {
      const { courtId, field, value } = action.payload;
      const current: CourtTeamDraft =
        state.courtTeamDrafts[courtId] ?? buildDefaultCourtDraft(courtId);
      return {
        ...state,
        courtTeamDrafts: {
          ...state.courtTeamDrafts,
          [courtId]: { ...current, [field]: value },
        },
        saveKey: state.saveKey + 1,
      };
    }

    // --- UI state (no saveKey increment — purely local) ---
    case 'SET_EDIT_MODE':
      return { ...state, isEditMode: action.payload };
    case 'SET_SHOW_HISTORY_MODAL':
      return { ...state, showHistoryModal: action.payload };
    case 'SET_SWAP_SELECTION':
      return { ...state, swapSelection: action.payload };

    // --- active tournament mutations ---
    case 'START_TOURNAMENT': {
      const result = generateRoundPairings({
        isFirst: true,
        roster: state.players,
        courts: state.selectedCourts,
        currentMatches: {},
        waitingPlayers: [],
        courtOrder: state.courtOrder,
        history: [],
      });
      return {
        ...state,
        status: tournamentStatus.IN_PROGRESS,
        currentMatches: result.matches,
        waitingPlayers: result.waitingIds,
        history: [],
        saveKey: state.saveKey + 1,
      };
    }

    case 'SWAP_PLAYERS_BY_POSITION': {
      const { source, target } = action.payload;
      const sourceMatch = state.currentMatches[source.courtId];
      const targetMatch = state.currentMatches[target.courtId];
      if (!sourceMatch || !targetMatch) return state;
      const srcKey = source.team === 'A' ? 'teamA' : 'teamB';
      const tgtKey = target.team === 'A' ? 'teamA' : 'teamB';
      const srcPlayer = sourceMatch[srcKey][source.index];
      const tgtPlayer = targetMatch[tgtKey][target.index];
      if (!srcPlayer || !tgtPlayer) return state;
      const nextMatches = JSON.parse(JSON.stringify(state.currentMatches)) as Record<string, Match>;
      nextMatches[source.courtId][srcKey][source.index] = tgtPlayer;
      nextMatches[target.courtId][tgtKey][target.index] = srcPlayer;
      return {
        ...state,
        currentMatches: nextMatches,
        swapSelection: null,
        saveKey: state.saveKey + 1,
      };
    }

    case 'HANDLE_SWAP': {
      const { selection, target } = action.payload;
      const nextMatches = JSON.parse(JSON.stringify(state.currentMatches)) as Record<string, Match>;
      const nextWaiting = [...state.waitingPlayers];

      const getPlayer = (pos: Exclude<typeof selection, null>): string => {
        if (pos.isWaitlist) return pos.pId ?? '';
        const teamKey = pos.team === 'A' ? 'teamA' : 'teamB';
        return nextMatches[pos.courtId ?? '']?.[teamKey]?.[pos.index ?? 0] ?? '';
      };

      const setPlayer = (pos: Exclude<typeof selection, null>, playerId: string) => {
        if (pos.isWaitlist) {
          const idx = nextWaiting.indexOf(pos.pId ?? '');
          if (idx !== -1) nextWaiting[idx] = playerId;
        } else {
          const teamKey = pos.team === 'A' ? 'teamA' : 'teamB';
          const court = nextMatches[pos.courtId ?? ''];
          if (court) court[teamKey][pos.index ?? 0] = playerId;
        }
      };

      const p1 = getPlayer(selection);
      const p2 = getPlayer(target);
      setPlayer(selection, p2);
      setPlayer(target, p1);

      return {
        ...state,
        currentMatches: nextMatches,
        waitingPlayers: nextWaiting,
        swapSelection: null,
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_MATCH_WINNER': {
      const { courtId, winner } = action.payload;
      const match = state.currentMatches[courtId];
      if (!match) return state;
      return {
        ...state,
        currentMatches: { ...state.currentMatches, [courtId]: { ...match, winner } },
        saveKey: state.saveKey + 1,
      };
    }

    case 'NEXT_ROUND': {
      const newHistory = [
        ...state.history,
        {
          id: state.history.length,
          matches: { ...state.currentMatches },
          waiting: [...state.waitingPlayers],
        },
      ];
      const result = generateRoundPairings({
        isFirst: false,
        roster: state.players,
        courts: state.selectedCourts,
        currentMatches: state.currentMatches,
        waitingPlayers: state.waitingPlayers,
        courtOrder: state.courtOrder,
        history: newHistory,
      });
      return {
        ...state,
        history: newHistory,
        currentMatches: result.matches,
        waitingPlayers: result.waitingIds,
        saveKey: state.saveKey + 1,
      };
    }

    case 'UNDO_ROUND': {
      if (state.history.length === 0) return state;
      const newHistory = state.history.slice(0, -1);
      const last = newHistory[newHistory.length - 1];
      return {
        ...state,
        history: newHistory,
        currentMatches: last?.matches ?? {},
        waitingPlayers: last?.waiting ?? [],
        status: tournamentStatus.IN_PROGRESS,
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_TOURNAMENT_FINISHED':
      return { ...state, status: tournamentStatus.COMPLETED, saveKey: state.saveKey + 1 };

    case 'RESET_TOURNAMENT_FINISHED':
      return { ...state, status: tournamentStatus.IN_PROGRESS, saveKey: state.saveKey + 1 };

    case 'SET_WAITING_PLAYERS':
      return { ...state, waitingPlayers: action.payload, saveKey: state.saveKey + 1 };

    case 'SET_CURRENT_MATCHES':
      return { ...state, currentMatches: action.payload, saveKey: state.saveKey + 1 };

    case 'SET_HISTORY':
      return { ...state, history: action.payload, saveKey: state.saveKey + 1 };

    // --- persistence bookkeeping (no saveKey increment) ---
    case 'MARK_SAVED':
      return { ...state, lastSaved: new Date(), saveError: null };

    case 'MARK_SAVE_ERROR':
      return { ...state, saveError: action.payload };

    default:
      return state;
  }
}
