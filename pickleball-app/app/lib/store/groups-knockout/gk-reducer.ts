import { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { reconcileCourtOrder } from '@/app/lib/engines/rally';
import type { CourtTeamDraft } from '../shared/types';
import type { GKState, GKAction } from './gk-types';

export const initialGKState: GKState = {
  mode: gameMode.GROUP_KNOCKOUT,
  status: tournamentStatus.SETUP,
  tournamentName: '',
  tournamentDate: '',
  courtCount: 7,
  players: [],
  selectedCourts: ['3', '4', '5', '6', '7'],
  courtOrder: ['3', '4', '5', '6', '7'],
  bulkInput: '',
  courtTeamDrafts: {},
  teamMode: 'manual',
  knockoutStage: 'SEMIFINAL',
  draftPlayers: null,
  draftSelection: null,
  teamsConfirmed: false,
  gkState: null,
  gkInitialState: null,
  waitingPlayers: [],
  currentMatches: {},
  history: [],
  unassignedMatches: [],
  scoreDrafts: {},
  matchLog: [],
  showHistoryModal: false,
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

export function gkReducer(state: GKState, action: GKAction): GKState {
  switch (action.type) {
    case 'LOAD_STATE':
      // LOAD_STATE does NOT increment saveKey.
      return { ...state, ...action.payload };

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
      const current = state.courtTeamDrafts[courtId] ?? buildDefaultCourtDraft(courtId);
      return {
        ...state,
        courtTeamDrafts: {
          ...state.courtTeamDrafts,
          [courtId]: { ...current, [field]: value },
        },
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_TEAM_MODE':
      return { ...state, teamMode: action.payload, saveKey: state.saveKey + 1 };

    case 'SET_KNOCKOUT_STAGE':
      return { ...state, knockoutStage: action.payload, saveKey: state.saveKey + 1 };

    case 'GENERATE_DRAFT_TEAMS': {
      const shuffled = [...state.players];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return {
        ...state,
        draftPlayers: shuffled,
        draftSelection: null,
        teamsConfirmed: false,
        saveKey: state.saveKey + 1,
      };
    }

    case 'SWAP_DRAFT_PLAYERS': {
      if (!state.draftPlayers) return state;
      const index = action.payload;
      if (state.draftSelection === null) {
        return { ...state, draftSelection: index };
      }
      if (state.draftSelection === index) {
        return { ...state, draftSelection: null };
      }
      const next = [...state.draftPlayers];
      [next[state.draftSelection], next[index]] = [next[index], next[state.draftSelection]];
      return {
        ...state,
        draftPlayers: next,
        draftSelection: null,
        teamsConfirmed: false,
        saveKey: state.saveKey + 1,
      };
    }

    case 'CONFIRM_TEAMS':
      if (!state.draftPlayers) return state;
      return { ...state, teamsConfirmed: true, saveKey: state.saveKey + 1 };

    case 'START_TOURNAMENT': {
      const initialized = action.payload;
      return {
        ...state,
        status: tournamentStatus.IN_PROGRESS,
        gkState: initialized,
        gkInitialState: initialized,
        history: [],
        waitingPlayers: [],
        currentMatches: {},
        matchLog: [],
        courtOrder: state.selectedCourts,
        saveKey: state.saveKey + 1,
      };
    }

    case 'SEED_ROUND_QUEUE':
      return {
        ...state,
        unassignedMatches: action.payload,
        scoreDrafts: {},
        saveKey: state.saveKey + 1,
      };

    case 'ASSIGN_MATCH_TO_COURT': {
      const { matchId, courtId, roundIndex, match } = action.payload;
      return {
        ...state,
        currentMatches: { ...state.currentMatches, [courtId]: { ...match } },
        unassignedMatches: state.unassignedMatches.filter(
          (e) => !(e.matchId === matchId && e.roundIndex === roundIndex),
        ),
        saveKey: state.saveKey + 1,
      };
    }

    case 'UNASSIGN_COURT': {
      const { courtId, matchId, roundIndex } = action.payload;
      const next = { ...state.currentMatches };
      delete next[courtId];
      const alreadyQueued = state.unassignedMatches.some(
        (e) => e.matchId === matchId && e.roundIndex === roundIndex,
      );
      return {
        ...state,
        currentMatches: next,
        unassignedMatches: alreadyQueued
          ? state.unassignedMatches
          : [...state.unassignedMatches, { roundIndex, matchId }],
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_WINNER_ON_COURT': {
      const { courtId, winner } = action.payload;
      const match = state.currentMatches[courtId];
      if (!match) return state;
      return {
        ...state,
        currentMatches: { ...state.currentMatches, [courtId]: { ...match, winner } },
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_SCORE_DRAFT': {
      const { matchId, team, score } = action.payload;
      const key = team === 'A' ? 'teamA' : 'teamB';
      const prev = state.scoreDrafts[matchId] ?? { teamA: '', teamB: '' };
      return {
        ...state,
        scoreDrafts: { ...state.scoreDrafts, [matchId]: { ...prev, [key]: score } },
        saveKey: state.saveKey + 1,
      };
    }

    case 'COMPLETE_COURT_MATCH': {
      const { courtId, updatedGkState, logEntry, roundHistory } = action.payload;
      const nextMatches = { ...state.currentMatches };
      delete nextMatches[courtId];

      const idx = state.history.findIndex((r) => r.id === roundHistory.id);
      const newHistory =
        idx === -1
          ? [...state.history, roundHistory]
          : state.history.map((r, i) => (i === idx ? roundHistory : r));

      return {
        ...state,
        gkState: updatedGkState,
        currentMatches: nextMatches,
        history: newHistory,
        matchLog: [...state.matchLog, logEntry],
        saveKey: state.saveKey + 1,
      };
    }

    case 'UNDO_LAST_MATCH': {
      const { rebuiltState, unassignedMatches } = action.payload;
      return {
        ...state,
        gkState: rebuiltState,
        status: tournamentStatus.IN_PROGRESS,
        unassignedMatches,
        scoreDrafts: {},
        saveKey: state.saveKey + 1,
      };
    }

    case 'SET_SHOW_HISTORY_MODAL':
      return { ...state, showHistoryModal: action.payload };

    case 'SET_TOURNAMENT_FINISHED':
      return { ...state, status: tournamentStatus.COMPLETED, saveKey: state.saveKey + 1 };

    case 'RESET_TOURNAMENT_FINISHED':
      return { ...state, status: tournamentStatus.IN_PROGRESS, saveKey: state.saveKey + 1 };

    case 'MARK_SAVED':
      return { ...state, lastSaved: new Date(), saveError: null };

    case 'MARK_SAVE_ERROR':
      return { ...state, saveError: action.payload };

    default:
      return state;
  }
}
