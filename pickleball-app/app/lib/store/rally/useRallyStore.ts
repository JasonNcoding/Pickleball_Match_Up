'use client';
import { useReducer, useEffect, useState } from 'react';
import { archiveAndClearTournament, getTournamentState } from '@/app/lib/actions';
import { rallyDomain } from '@/app/lib/game_modes/rally/controller';
import { firePodiumConfetti } from '@/app/ui/confetti';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import { usePersistence } from '../shared/persistence';
import type { CourtTeamDraft } from '../shared/types';
import { rallyReducer, initialRallyState } from './rally-reducer';
import type { RallyState, RallyMode, SwapSlot } from './rally-types';

// ---------------------------------------------------------------------------
// Snapshot builder — converts RallyState into the DB-compatible shape that
// saveTournamentState / TournamentStateSnapshot expects.
// ---------------------------------------------------------------------------
export function buildRallySnapshot(state: RallyState) {
  return {
    setupComplete: state.status !== tournamentStatus.SETUP,
    tournamentFinished: state.status === tournamentStatus.COMPLETED,
    mode: state.mode,
    tournamentType: state.mode,
    tournamentName: state.tournamentName,
    tournamentDate: state.tournamentDate,
    courtCount: state.courtCount,
    selectedCourts: state.selectedCourts,
    courtOrder: state.courtOrder,
    players: state.players,
    waitingPlayers: state.waitingPlayers,
    currentMatches: state.currentMatches,
    history: state.history,
    courtTeamDrafts: state.courtTeamDrafts,
    bulkInput: state.bulkInput,
  };
}

// ---------------------------------------------------------------------------
// buildRallyStateFromDB — hydrates RallyState from raw DB JSONB snapshot.
// Called by both the standalone hook and the composite controller.
// ---------------------------------------------------------------------------
export function buildRallyStateFromDB(data: Record<string, unknown>): Partial<RallyState> {
  const rawMode = (data.mode ?? data.tournamentType ?? gameMode.RALLYTOTHETOP) as string;
  const resolvedMode: RallyMode =
    rawMode === 'DUPR Tournament' || rawMode === gameMode.GROUP_KNOCKOUT
      ? gameMode.RALLYTOTHETOP // fallback if GK state somehow ends up here
      : (rawMode as RallyMode);

  const isFinished = Boolean(data.tournamentFinished);
  const isSetup = Boolean(data.setupComplete);
  const status = isFinished
    ? tournamentStatus.COMPLETED
    : isSetup
      ? tournamentStatus.IN_PROGRESS
      : tournamentStatus.SETUP;

  const courts = (data.selectedCourts as string[] | undefined) ?? [];
  const storedDrafts = (data.courtTeamDrafts as Record<string, CourtTeamDraft> | undefined) ?? {};
  const mergedDrafts: Record<string, CourtTeamDraft> = {};
  courts.forEach((courtId) => {
    mergedDrafts[courtId] = storedDrafts[courtId] ?? {
      teamAName: `Court ${courtId} Team A`,
      teamBName: `Court ${courtId} Team B`,
      teamAPlayers: ['', ''],
      teamBPlayers: ['', ''],
    };
  });

  return {
    mode: resolvedMode,
    status,
    tournamentName: (data.tournamentName as string | undefined) ?? '',
    tournamentDate: (data.tournamentDate as string | undefined) ?? '',
    courtCount: (data.courtCount as number | undefined) ?? 7,
    players: (data.players as RallyState['players'] | undefined) ?? [],
    selectedCourts: courts,
    courtOrder: (data.courtOrder as string[] | undefined) ?? courts,
    bulkInput: (data.bulkInput as string | undefined) ?? '',
    courtTeamDrafts: mergedDrafts,
    waitingPlayers: (data.waitingPlayers as string[] | undefined) ?? [],
    currentMatches: (data.currentMatches as RallyState['currentMatches'] | undefined) ?? {},
    history: (data.history as RallyState['history'] | undefined) ?? [],
  };
}

// ---------------------------------------------------------------------------
// buildRallyApi — pure function (not a hook) that constructs the { state,
// config, session, computed, actions } object consumed by admin/page.tsx.
// Shared between the standalone hook and the composite controller.
// ---------------------------------------------------------------------------
export function buildRallyApi(
  state: RallyState,
  dispatch: React.Dispatch<Parameters<typeof rallyReducer>[1]>,
  onSetMode: (m: gameMode) => void,
) {
  const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
  const activeCourtOrder = state.courtOrder;
  const kingCourt = activeCourtOrder[0] ?? '';
  const bottomCourt = activeCourtOrder[activeCourtOrder.length - 1] ?? '';
  const isRoundOne = state.history.length === 0;
  const setupComplete = state.status !== tournamentStatus.SETUP;
  const tournamentFinished = state.status === tournamentStatus.COMPLETED;

  const canProceedNextRound = Object.values(state.currentMatches).every((m) => m.winner);

  return {
    state: {
      setupComplete,
      tournamentFinished,
      mode: state.mode as gameMode,
      isDuprMode: false,
    },
    config: {
      duprTeamMode: 'manual' as const,
      duprKnockoutStage: 'SEMIFINAL' as const,
      availableCourts,
      tournamentName: state.tournamentName,
      tournamentDate: state.tournamentDate,
      courtCount: state.courtCount,
      selectedCourts: state.selectedCourts,
      courtOrder: state.courtOrder,
      players: state.players,
      bulkInput: state.bulkInput,
      duprCanStart: false,
      duprDraftPlayers: null,
      courtTeamDrafts: state.courtTeamDrafts,
      duprDraftTeams: [],
      duprDraftSelection: null,
      duprTeamsConfirmed: false,
    },
    session: {
      isEditMode: state.isEditMode,
      showHistoryModal: state.showHistoryModal,
      swapSelection: state.swapSelection,
      waitingPlayers: state.waitingPlayers,
      currentMatches: state.currentMatches,
      history: state.history,
      duprState: null,
      activeCourtOrder,
      kingCourt,
      bottomCourt,
      isRoundOne,
      duprStandings: [],
      duprFinalLeaderboard: [],
      duprMatchLog: [],
      duprUnassignedMatches: [],
      duprScoreDrafts: {} as Record<string, { teamA: string; teamB: string }>,
      canProceedNextRound,
    },
    computed: {
      capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
      hasPlayedTogetherRecently: (p1: string, p2: string) =>
        rallyDomain.hasPlayedTogetherInHistory(state.history, p1, p2),
      getLeaderboard: () =>
        rallyDomain.calculateLeaderboard({ players: state.players, history: state.history, kingCourt }),
      getRallyFinalLeaderboard: () =>
        rallyDomain.calculateLeaderboard({ players: state.players, history: state.history, kingCourt }),
      getDuprLeaderboard: () => [],
      getDuprFinalLeaderboard: () => [],
    },
    actions: {
      // --- mode / lifecycle ---
      setSetupComplete: (v: boolean) => {
        if (v && state.status === tournamentStatus.SETUP) {
          dispatch({ type: 'START_TOURNAMENT' });
        }
      },
      setTournamentFinished: (v: boolean) => {
        if (v) dispatch({ type: 'SET_TOURNAMENT_FINISHED' });
        else dispatch({ type: 'RESET_TOURNAMENT_FINISHED' });
      },
      setMode: onSetMode,

      // --- metadata ---
      setMetadata: (payload: { tournamentName?: string; tournamentDate?: string; courtCount?: number }) =>
        dispatch({ type: 'SET_METADATA', payload }),

      // --- GK stubs (no-ops in rally mode) ---
      setDuprTeamMode: () => {},
      setDuprKnockoutStage: () => {},

      // --- UI toggles ---
      setIsEditMode: (v: boolean) => dispatch({ type: 'SET_EDIT_MODE', payload: v }),
      setShowHistoryModal: (v: boolean) => dispatch({ type: 'SET_SHOW_HISTORY_MODAL', payload: v }),
      setSwapSelection: (v: RallyState['swapSelection']) =>
        dispatch({ type: 'SET_SWAP_SELECTION', payload: v }),

      // --- setup mutations ---
      setSelectedCourts: (v: string[]) =>
        dispatch({ type: 'SET_SELECTED_COURTS', payload: v }),
      setPlayers: (v: RallyState['players']) =>
        dispatch({ type: 'SET_PLAYERS', payload: v }),
      setWaitingPlayers: (v: string[]) =>
        dispatch({ type: 'SET_WAITING_PLAYERS', payload: v }),
      setCurrentMatches: (v: RallyState['currentMatches']) =>
        dispatch({ type: 'SET_CURRENT_MATCHES', payload: v }),
      setHistory: (v: RallyState['history']) =>
        dispatch({ type: 'SET_HISTORY', payload: v }),
      setBulkInput: (v: string) => dispatch({ type: 'SET_BULK_INPUT', payload: v }),

      // --- court ordering ---
      moveCourt: (index: number, direction: 'up' | 'down') =>
        dispatch({ type: 'MOVE_COURT', payload: { index, direction } }),
      toggleCourtSelection: (courtId: string) =>
        dispatch({ type: 'TOGGLE_COURT_SELECTION', payload: courtId }),
      reorderCourtById: (sourceCourtId: string, targetCourtId: string) =>
        dispatch({
          type: 'REORDER_COURT_BY_ID',
          payload: { sourceId: sourceCourtId, targetId: targetCourtId },
        }),

      // --- player swaps ---
      handleSwap: (target: Exclude<RallyState['swapSelection'], null>) => {
        if (!state.swapSelection) return;
        const selection = state.swapSelection;
        if (
          !isRoundOne &&
          (selection.courtId !== target.courtId || selection.isWaitlist || target.isWaitlist)
        ) {
          alert('From Round 2, players can only be swapped within the same court.');
          dispatch({ type: 'SET_SWAP_SELECTION', payload: null });
          return;
        }
        dispatch({ type: 'HANDLE_SWAP', payload: { selection, target } });
      },
      swapPlayersByPosition: (
        source: SwapSlot,
        target: SwapSlot,
      ) => {
        if (!isRoundOne && source.courtId !== target.courtId) {
          alert('From Round 2, players can only be swapped within the same court.');
          return;
        }
        dispatch({ type: 'SWAP_PLAYERS_BY_POSITION', payload: { source, target } });
      },

      // --- court team drafts ---
      updateCourtTeamDraft: (
        courtId: string,
        field: keyof CourtTeamDraft,
        value: string | [string, string],
      ) =>
        dispatch({ type: 'UPDATE_COURT_TEAM_DRAFT', payload: { courtId, field, value } }),
      swapCourtTeams: (courtId: string) => {
        const draft = state.courtTeamDrafts[courtId];
        if (!draft) return;
        dispatch({ type: 'UPDATE_COURT_TEAM_DRAFT', payload: { courtId, field: 'teamAName', value: draft.teamBName } });
        dispatch({ type: 'UPDATE_COURT_TEAM_DRAFT', payload: { courtId, field: 'teamBName', value: draft.teamAName } });
        dispatch({ type: 'UPDATE_COURT_TEAM_DRAFT', payload: { courtId, field: 'teamAPlayers', value: draft.teamBPlayers } });
        dispatch({ type: 'UPDATE_COURT_TEAM_DRAFT', payload: { courtId, field: 'teamBPlayers', value: draft.teamAPlayers } });
      },
      swapPlayersWithinTeam: (courtId: string, team: 'A' | 'B') => {
        const draft = state.courtTeamDrafts[courtId];
        if (!draft) return;
        const field = team === 'A' ? 'teamAPlayers' : 'teamBPlayers';
        const current = team === 'A' ? draft.teamAPlayers : draft.teamBPlayers;
        dispatch({
          type: 'UPDATE_COURT_TEAM_DRAFT',
          payload: { courtId, field, value: [current[1], current[0]] },
        });
      },

      // --- player import ---
      importPlayersFromCsv: (csvText: string) => {
        const parseCsvLine = (line: string) => {
          const cells: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1; }
              else inQuotes = !inQuotes;
              continue;
            }
            if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
            current += char;
          }
          cells.push(current.trim());
          return cells;
        };
        const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) return { ok: false, count: 0 };
        const normalized = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
        const headerCells = parseCsvLine(lines[0]).map(normalized);
        const firstNameIndex = headerCells.findIndex((c) => c === 'firstname');
        const duprIndex = headerCells.findIndex((c) => c === 'dupr' || c === 'duprrating');
        if (firstNameIndex < 0 || duprIndex < 0) return { ok: false, count: 0 };
        const parsed = lines.slice(1).map(parseCsvLine).map((parts) => {
          const name = (parts[firstNameIndex] ?? '').trim();
          const ratingRaw = (parts[duprIndex] ?? '').trim();
          const parsedRating = parseFloat(ratingRaw);
          return { id: name, name, rating: Number.isFinite(parsedRating) ? parsedRating : 3.5 };
        }).filter((p) => p.name.length > 0);
        if (parsed.length === 0) return { ok: false, count: 0 };
        dispatch({ type: 'SET_PLAYERS', payload: parsed });
        dispatch({ type: 'SET_BULK_INPUT', payload: parsed.map((p) => `${p.name}:${p.rating}`).join('\n') });
        return { ok: true, count: parsed.length };
      },

      // --- GK stubs ---
      randomizePlayers: () => {
        const next = [...state.players];
        for (let i = next.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [next[i], next[j]] = [next[j], next[i]];
        }
        dispatch({ type: 'SET_PLAYERS', payload: next });
        dispatch({ type: 'SET_BULK_INPUT', payload: next.map((p) => `${p.name}:${p.rating}`).join('\n') });
      },
      generateDuprTeams: () => {},
      swapDuprDraftPlayers: () => {},
      confirmDuprTeams: () => {},
      assignDuprMatchToCourt: () => {},
      unassignDuprCourt: () => {},
      setDuprWinnerOnCourt: () => {},
      setDuprScoreDraft: () => {},
      completeDuprCourtMatch: () => {},
      undoDuprLastMatch: () => {},

      // --- round management ---
      startTournament: () => dispatch({ type: 'START_TOURNAMENT' }),
      nextRound: () => {
        dispatch({ type: 'NEXT_ROUND' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      undoRound: () => dispatch({ type: 'UNDO_ROUND' }),

      // --- session lifecycle ---
      resetTournament: async () => {
        if (confirm('R U Sure, Reset?')) {
          await archiveAndClearTournament('reset-button');
          localStorage.removeItem('kotc_session');
          location.reload();
        }
      },
      newSession: async () => {
        if (confirm('Start a brand new session? This clears all data.')) {
          await archiveAndClearTournament('new-session');
          localStorage.removeItem('kotc_session');
          location.reload();
        }
      },
      finishTournament: () => {
        dispatch({ type: 'SET_TOURNAMENT_FINISHED' });
        firePodiumConfetti();
      },
    },
  };
}

// ---------------------------------------------------------------------------
// useRallyStore — standalone hook for Rally mode.
// Self-contained: loads from DB, saves via usePersistence, returns full API.
// ---------------------------------------------------------------------------
export function useRallyStore() {
  const [state, dispatch] = useReducer(rallyReducer, initialRallyState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    getTournamentState().then((data) => {
      if (data) {
        const partial = buildRallyStateFromDB(data as Record<string, unknown>);
        dispatch({ type: 'LOAD_STATE', payload: partial });
      }
      setIsHydrated(true);
    });
  }, []);

  usePersistence(
    isHydrated,
    state.status !== tournamentStatus.SETUP,
    state.saveKey,
    () => buildRallySnapshot(state),
    () => dispatch({ type: 'MARK_SAVED' }),
    (msg) => dispatch({ type: 'MARK_SAVE_ERROR', payload: msg }),
  );

  const handleSetMode = (m: gameMode) => {
    dispatch({ type: 'SET_MODE', payload: m as RallyMode });
  };

  return buildRallyApi(state, dispatch, handleSetMode);
}
