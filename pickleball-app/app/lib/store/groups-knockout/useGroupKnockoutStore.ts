'use client';
import { useReducer, useEffect, useState } from 'react';
import { archiveAndClearTournament, getTournamentState } from '@/app/lib/actions';
import { duprDomain, buildDuprLeaderboard, buildDuprFinalLeaderboard } from '@/app/lib/game_modes/dupr/controller';
import { findMatchRoundIndex } from '@/app/lib/game_modes/dupr/model';
import { firePodiumConfetti } from '@/app/ui/confetti';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import type { GroupsKnockoutState } from '@/app/lib/engines/groups-knockout';
import type { Round } from '@/app/lib/definitions';
import type { DuprMatchLogEntry } from '@/app/lib/game_modes/dupr/model';
import { usePersistence } from '../shared/persistence';
import type { CourtTeamDraft } from '../shared/types';
import { gkReducer, initialGKState } from './gk-reducer';
import type { GKState, GKUnassignedMatch } from './gk-types';

// ---------------------------------------------------------------------------
// Snapshot builder — converts GKState into the DB-compatible shape.
// ---------------------------------------------------------------------------
export function buildGKSnapshot(state: GKState) {
  return {
    setupComplete: state.status !== tournamentStatus.SETUP,
    tournamentFinished: state.status === tournamentStatus.COMPLETED,
    mode: state.mode,
    tournamentType: state.mode,
    tournamentName: state.tournamentName,
    tournamentDate: state.tournamentDate,
    courtCount: state.courtCount,
    duprTeamMode: state.teamMode,
    duprKnockoutStage: state.knockoutStage,
    duprState: state.gkState,
    duprInitialState: state.gkInitialState,
    duprDraftPlayers: state.draftPlayers,
    duprDraftSelection: state.draftSelection,
    duprTeamsConfirmed: state.teamsConfirmed,
    duprUnassignedMatches: state.unassignedMatches,
    duprScoreDrafts: state.scoreDrafts,
    duprMatchLog: state.matchLog,
    selectedCourts: state.selectedCourts,
    courtOrder: state.courtOrder,
    players: state.players,
    courtTeamDrafts: state.courtTeamDrafts,
    waitingPlayers: state.waitingPlayers,
    currentMatches: state.currentMatches,
    history: state.history,
    bulkInput: state.bulkInput,
  };
}

// ---------------------------------------------------------------------------
// buildGKStateFromDB — hydrates GKState from raw DB JSONB snapshot.
// ---------------------------------------------------------------------------
export function buildGKStateFromDB(data: Record<string, unknown>): Partial<GKState> {
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

  // Normalize duprScoreDrafts — previously stored as plain strings.
  const savedScoreDrafts =
    (data.duprScoreDrafts as Record<string, string | { teamA: string; teamB: string }> | undefined) ?? {};
  const normalizedScoreDrafts: Record<string, { teamA: string; teamB: string }> = {};
  for (const [matchId, value] of Object.entries(savedScoreDrafts)) {
    if (typeof value === 'string') {
      const parsed = value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
      normalizedScoreDrafts[matchId] = {
        teamA: parsed ? parsed[1] : '',
        teamB: parsed ? parsed[2] : '',
      };
    } else {
      normalizedScoreDrafts[matchId] = {
        teamA: value?.teamA ?? '',
        teamB: value?.teamB ?? '',
      };
    }
  }

  // Normalize unassigned matches — previously stored as string[] of match IDs.
  const rawUnassigned = data.duprUnassignedMatches as GKUnassignedMatch[] | string[] | undefined;
  let unassignedMatches: GKUnassignedMatch[] = [];
  if (Array.isArray(rawUnassigned)) {
    if (typeof rawUnassigned[0] === 'string') {
      unassignedMatches = (rawUnassigned as string[]).map((matchId) => ({ roundIndex: 0, matchId }));
    } else {
      unassignedMatches = rawUnassigned as GKUnassignedMatch[];
    }
  } else if (data.duprUnassignedMatchIds) {
    unassignedMatches = (data.duprUnassignedMatchIds as string[]).map((matchId) => ({
      roundIndex: 0,
      matchId,
    }));
  }

  const loadedGkState = (data.duprState as GroupsKnockoutState | undefined) ?? null;

  return {
    status,
    tournamentName: (data.tournamentName as string | undefined) ?? '',
    tournamentDate: (data.tournamentDate as string | undefined) ?? '',
    courtCount: (data.courtCount as number | undefined) ?? 7,
    players: (data.players as GKState['players'] | undefined) ?? [],
    selectedCourts: courts,
    courtOrder: (data.courtOrder as string[] | undefined) ?? courts,
    bulkInput: (data.bulkInput as string | undefined) ?? '',
    courtTeamDrafts: mergedDrafts,
    teamMode: (data.duprTeamMode as 'manual' | 'random' | undefined) ?? 'manual',
    knockoutStage: (data.duprKnockoutStage as GKState['knockoutStage'] | undefined) ?? 'SEMIFINAL',
    gkState: loadedGkState,
    gkInitialState: (data.duprInitialState as GroupsKnockoutState | undefined) ?? loadedGkState,
    draftPlayers: (data.duprDraftPlayers as GKState['draftPlayers'] | undefined) ?? null,
    draftSelection: (data.duprDraftSelection as number | null | undefined) ?? null,
    teamsConfirmed: Boolean(data.duprTeamsConfirmed),
    unassignedMatches,
    scoreDrafts: normalizedScoreDrafts,
    matchLog: (data.duprMatchLog as DuprMatchLogEntry[] | undefined) ?? [],
    waitingPlayers: (data.waitingPlayers as string[] | undefined) ?? [],
    currentMatches: (data.currentMatches as GKState['currentMatches'] | undefined) ?? {},
    history: (data.history as GKState['history'] | undefined) ?? [],
  };
}

// ---------------------------------------------------------------------------
// buildSeedQueue — compute which matches still need court assignment.
// ---------------------------------------------------------------------------
function buildSeedQueue(
  gkState: GroupsKnockoutState,
  assignedMatchIds: Set<string>,
): GKUnassignedMatch[] {
  const queue: GKUnassignedMatch[] = [];
  if (gkState.phase === 'ROUND_ROBIN') {
    gkState.rounds.slice(0, gkState.roundRobinRounds).forEach((round, roundIndex) => {
      for (const [matchId, match] of Object.entries(round.matches)) {
        if (!match.winner && !assignedMatchIds.has(match.id)) {
          queue.push({ roundIndex, matchId });
        }
      }
    });
  } else if (gkState.phase === 'KNOCKOUT') {
    const round = gkState.rounds[gkState.currentRoundNumber];
    if (round) {
      for (const [matchId, match] of Object.entries(round.matches)) {
        if (!match.winner && !assignedMatchIds.has(match.id)) {
          queue.push({ roundIndex: gkState.currentRoundNumber, matchId });
        }
      }
    }
  }
  return queue;
}

// ---------------------------------------------------------------------------
// buildGKApi — pure function that constructs the admin API for GK mode.
// ---------------------------------------------------------------------------
export function buildGKApi(
  state: GKState,
  dispatch: React.Dispatch<Parameters<typeof gkReducer>[1]>,
  onSetMode: (m: gameMode) => void,
) {
  const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
  const activeCourtOrder = Object.keys(state.currentMatches).length > 0
    ? Object.keys(state.currentMatches)
    : state.courtOrder;
  const kingCourt = activeCourtOrder[0] ?? '';
  const bottomCourt = activeCourtOrder[activeCourtOrder.length - 1] ?? '';
  const isRoundOne = state.history.length === 0;
  const setupComplete = state.status !== tournamentStatus.SETUP;
  const tournamentFinished = state.status === tournamentStatus.COMPLETED;

  const duprStandings = state.gkState ? buildDuprLeaderboard(state.gkState) : [];
  const duprFinalLeaderboard = state.gkState ? buildDuprFinalLeaderboard(state.gkState) : [];
  const duprDraftTeams = state.draftPlayers ? duprDomain.createTeams(state.draftPlayers) : [];
  const duprCanStart =
    state.players.length >= 8 && state.players.length % 2 === 0;

  const canProceedNextRound = Boolean(
    state.gkState &&
      state.gkState.phase === 'KNOCKOUT' &&
      state.gkState.rounds[state.gkState.currentRoundNumber] &&
      Object.values(state.gkState.rounds[state.gkState.currentRoundNumber].matches).every(
        (m) => m.winner,
      ),
  );

  return {
    state: {
      setupComplete,
      tournamentFinished,
      mode: state.mode as gameMode,
      isDuprMode: true,
    },
    config: {
      duprTeamMode: state.teamMode,
      duprKnockoutStage: state.knockoutStage,
      availableCourts,
      tournamentName: state.tournamentName,
      tournamentDate: state.tournamentDate,
      courtCount: state.courtCount,
      selectedCourts: state.selectedCourts,
      courtOrder: state.courtOrder,
      players: state.players,
      bulkInput: state.bulkInput,
      duprCanStart,
      duprDraftPlayers: state.draftPlayers,
      courtTeamDrafts: state.courtTeamDrafts,
      duprDraftTeams,
      duprDraftSelection: state.draftSelection,
      duprTeamsConfirmed: state.teamsConfirmed,
    },
    session: {
      isEditMode: false,
      showHistoryModal: state.showHistoryModal,
      swapSelection: null,
      waitingPlayers: state.waitingPlayers,
      currentMatches: state.currentMatches,
      history: state.history,
      duprState: state.gkState,
      activeCourtOrder,
      kingCourt,
      bottomCourt,
      isRoundOne,
      duprStandings,
      duprFinalLeaderboard,
      duprMatchLog: state.matchLog,
      duprUnassignedMatches: state.unassignedMatches,
      duprScoreDrafts: state.scoreDrafts,
      canProceedNextRound,
    },
    computed: {
      capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
      hasPlayedTogetherRecently: () => false,
      getLeaderboard: () => duprStandings.map((s) => ({ name: s.teamName, winCount: s.wins })),
      getRallyFinalLeaderboard: () => [],
      getDuprLeaderboard: () => duprStandings,
      getDuprFinalLeaderboard: () => duprFinalLeaderboard,
    },
    actions: {
      // --- mode / lifecycle ---
      setSetupComplete: () => {},
      setTournamentFinished: (v: boolean) => {
        if (v) dispatch({ type: 'SET_TOURNAMENT_FINISHED' });
        else dispatch({ type: 'RESET_TOURNAMENT_FINISHED' });
      },
      setMode: onSetMode,

      // --- metadata ---
      setMetadata: (payload: { tournamentName?: string; tournamentDate?: string; courtCount?: number }) =>
        dispatch({ type: 'SET_METADATA', payload }),

      // --- GK config ---
      setDuprTeamMode: (v: 'manual' | 'random') =>
        dispatch({ type: 'SET_TEAM_MODE', payload: v }),
      setDuprKnockoutStage: (v: GKState['knockoutStage']) =>
        dispatch({ type: 'SET_KNOCKOUT_STAGE', payload: v }),

      // --- UI (stubs / GK equivalents) ---
      setIsEditMode: () => {},
      setShowHistoryModal: (v: boolean) =>
        dispatch({ type: 'SET_SHOW_HISTORY_MODAL', payload: v }),
      setSwapSelection: () => {},

      // --- setup mutations ---
      setSelectedCourts: (v: string[]) =>
        dispatch({ type: 'SET_SELECTED_COURTS', payload: v }),
      setPlayers: (v: GKState['players']) =>
        dispatch({ type: 'SET_PLAYERS', payload: v }),
      setWaitingPlayers: () => {},
      setCurrentMatches: () => {},
      setHistory: () => {},
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

      // --- rally stubs ---
      handleSwap: () => {},
      swapPlayersByPosition: () => {},

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

      // --- GK-specific actions ---
      randomizePlayers: () => dispatch({ type: 'GENERATE_DRAFT_TEAMS' }),
      generateDuprTeams: () => dispatch({ type: 'GENERATE_DRAFT_TEAMS' }),

      swapDuprDraftPlayers: (index: number) =>
        dispatch({ type: 'SWAP_DRAFT_PLAYERS', payload: index }),

      confirmDuprTeams: () => {
        if (!state.draftPlayers) {
          alert('Generate teams first.');
          return;
        }
        dispatch({ type: 'CONFIRM_TEAMS' });
      },

      startTournament: () => {
        if (!state.gkState) {
          try {
            const teamCount = state.players.length / 2;
            if (state.knockoutStage === 'QUARTERFINAL' && teamCount < 8) {
              alert('Quarterfinal requires at least 8 teams (16 players).');
              return;
            }
            const knockoutSize: 4 | 8 = state.knockoutStage === 'QUARTERFINAL' ? 8 : 4;
            const initialized = duprDomain.initialize(state.players, {
              roundRobinRounds: 4,
              knockoutSize,
            });
            const assignedIds = new Set<string>();
            const queue = buildSeedQueue(initialized, assignedIds);
            dispatch({ type: 'START_TOURNAMENT', payload: initialized });
            dispatch({ type: 'SEED_ROUND_QUEUE', payload: queue });
          } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to start tournament.');
          }
        }
      },

      assignDuprMatchToCourt: (matchId: string, courtId: string, roundIndex?: number) => {
        if (!state.gkState) return;
        if (state.currentMatches[courtId]) {
          const occupied = state.currentMatches[courtId];
          alert(
            `Court ${courtId} is occupied by ${occupied.teamA.join('/')} vs ${occupied.teamB.join('/')}`,
          );
          return;
        }
        const resolvedRoundIndex =
          typeof roundIndex === 'number'
            ? roundIndex
            : findMatchRoundIndex(state.gkState, matchId);
        if (resolvedRoundIndex < 0) return;
        const round = state.gkState.rounds[resolvedRoundIndex];
        const match = round?.matches[matchId];
        if (!match) return;
        dispatch({
          type: 'ASSIGN_MATCH_TO_COURT',
          payload: { matchId, courtId, roundIndex: resolvedRoundIndex, match },
        });
      },

      unassignDuprCourt: (courtId: string) => {
        const match = state.currentMatches[courtId];
        if (!match || !state.gkState) return;
        const roundIndex = findMatchRoundIndex(state.gkState, match.id);
        if (roundIndex < 0) return;
        dispatch({
          type: 'UNASSIGN_COURT',
          payload: { courtId, matchId: match.id, roundIndex },
        });
      },

      setDuprWinnerOnCourt: (courtId: string, winner: 'A' | 'B') =>
        dispatch({ type: 'SET_WINNER_ON_COURT', payload: { courtId, winner } }),

      setDuprScoreDraft: (matchId: string, team: 'A' | 'B', score: string) =>
        dispatch({ type: 'SET_SCORE_DRAFT', payload: { matchId, team, score } }),

      completeDuprCourtMatch: (courtId: string) => {
        if (!state.gkState) return;
        const match = state.currentMatches[courtId];
        if (!match) return;
        const draft = state.scoreDrafts[match.id] ?? { teamA: '', teamB: '' };
        const teamAScore = Number(draft.teamA.trim());
        const teamBScore = Number(draft.teamB.trim());
        if (
          !Number.isInteger(teamAScore) ||
          !Number.isInteger(teamBScore) ||
          teamAScore < 0 ||
          teamBScore < 0
        ) {
          alert('Please enter a valid non-negative score for both teams.');
          return;
        }
        if (teamAScore === teamBScore) {
          alert('Score cannot be tied.');
          return;
        }
        const winner: 'A' | 'B' = teamAScore > teamBScore ? 'A' : 'B';
        const roundIndex = findMatchRoundIndex(state.gkState, match.id);
        if (roundIndex < 0) return;
        const phaseAtRecord = state.gkState.phase === 'KNOCKOUT' ? 'KNOCKOUT' : 'ROUND_ROBIN';
        const scoreText = `${teamAScore}-${teamBScore}`;

        let updated = duprDomain.applyWinner(
          state.gkState,
          roundIndex,
          match.id,
          winner,
          scoreText,
        );
        const roundHistory = updated.rounds[roundIndex];
        updated = duprDomain.advancePhase(updated);

        const logEntry: DuprMatchLogEntry = {
          id: `${Date.now()}-${match.id}`,
          phase: phaseAtRecord,
          roundIndex,
          matchId: match.id,
          teamA: [...match.teamA],
          teamB: [...match.teamB],
          score: scoreText,
          winner,
        };

        dispatch({
          type: 'COMPLETE_COURT_MATCH',
          payload: {
            courtId,
            updatedGkState: updated,
            logEntry,
            roundHistory: { id: roundIndex, matches: roundHistory.matches, waiting: [] },
          },
        });

        if (updated.phase === 'COMPLETED') {
          dispatch({ type: 'SET_TOURNAMENT_FINISHED' });
          firePodiumConfetti();
          return;
        }

        const assignedIds = new Set(Object.values(state.currentMatches).map((m) => m.id));
        assignedIds.delete(match.id); // this court is now free
        const queue = buildSeedQueue(updated, assignedIds);
        dispatch({ type: 'SEED_ROUND_QUEUE', payload: queue });
      },

      undoDuprLastMatch: () => {
        if (!state.gkState || !state.gkInitialState) return;

        let target: { roundIndex: number; matchId: string } | null = null;
        for (let roundIndex = state.gkState.rounds.length - 1; roundIndex >= 0; roundIndex -= 1) {
          const round: Round = state.gkState.rounds[roundIndex];
          const matchIds = Object.keys(round.matches);
          for (let mi = matchIds.length - 1; mi >= 0; mi -= 1) {
            const matchId = matchIds[mi];
            if (round.matches[matchId]?.winner) {
              target = { roundIndex, matchId };
              break;
            }
          }
          if (target) break;
        }

        if (!target) {
          alert('No completed match to undo.');
          return;
        }

        // Rebuild state from initial by replaying all winners except target.
        let rebuilt: GroupsKnockoutState = {
          ...state.gkInitialState,
          rounds: state.gkInitialState.rounds.map((round) => ({
            ...round,
            matches: Object.fromEntries(
              Object.entries(round.matches).map(([k, m]) => [k, { ...m, winner: null }]),
            ),
          })),
          phase: 'ROUND_ROBIN',
          currentRoundNumber: 0,
        };

        state.gkState.rounds.forEach((round, roundIndex) => {
          for (const [matchId, match] of Object.entries(round.matches)) {
            if (!match.winner) continue;
            if (target && target.roundIndex === roundIndex && target.matchId === matchId) continue;
            rebuilt = duprDomain.applyWinner(
              rebuilt,
              roundIndex,
              matchId,
              match.winner,
              match.score ?? null,
            );
          }
          rebuilt = duprDomain.advancePhase(rebuilt);
        });

        const assignedIds = new Set(Object.values(state.currentMatches).map((m) => m.id));
        const queue = buildSeedQueue(rebuilt, assignedIds);
        dispatch({ type: 'UNDO_LAST_MATCH', payload: { rebuiltState: rebuilt, unassignedMatches: queue } });
      },

      // --- round management ---
      nextRound: () => {
        if (!state.gkState) return;
        if (state.gkState.phase !== 'KNOCKOUT') return;
        const activeRoundIndex = state.gkState.currentRoundNumber;
        const round = state.gkState.rounds[activeRoundIndex];
        if (!round || !Object.values(round.matches).every((m) => m.winner)) {
          alert('Complete all knockout matches before proceeding.');
          return;
        }
        let updated = state.gkState;
        if (activeRoundIndex < updated.rounds.length - 1) {
          updated = { ...updated, currentRoundNumber: activeRoundIndex + 1 };
        }
        updated = duprDomain.advancePhase(updated);

        // Dispatch a COMPLETE_COURT_MATCH-less round advance via LOAD_STATE partial.
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            gkState: updated,
            waitingPlayers: [],
            history: [
              ...state.history,
              { id: activeRoundIndex, matches: round.matches, waiting: [] },
            ],
          },
        });

        if (updated.phase === 'COMPLETED') {
          dispatch({ type: 'SET_TOURNAMENT_FINISHED' });
          firePodiumConfetti();
          return;
        }

        const assignedIds = new Set(Object.values(state.currentMatches).map((m) => m.id));
        const queue = buildSeedQueue(updated, assignedIds);
        dispatch({ type: 'SEED_ROUND_QUEUE', payload: queue });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },

      undoRound: () => {
        if (!state.gkState || !state.gkInitialState) return;
        const historySlice = state.history.slice(0, -1);

        let rebuilt: GroupsKnockoutState = {
          ...state.gkInitialState,
          rounds: state.gkInitialState.rounds.map((round) => ({
            ...round,
            matches: Object.fromEntries(
              Object.entries(round.matches).map(([k, m]) => [k, { ...m, winner: null }]),
            ),
          })),
          phase: 'ROUND_ROBIN',
          currentRoundNumber: 0,
        };

        historySlice.forEach((round, index) => {
          for (const [, match] of Object.entries(round.matches)) {
            if (match.winner) {
              rebuilt = duprDomain.applyWinner(
                rebuilt,
                index,
                match.id,
                match.winner,
              );
            }
          }
          rebuilt = duprDomain.advancePhase(rebuilt);
        });

        dispatch({
          type: 'LOAD_STATE',
          payload: {
            gkState: rebuilt,
            history: historySlice,
            waitingPlayers: [],
            status: tournamentStatus.IN_PROGRESS,
          },
        });

        const assignedIds = new Set(Object.values(state.currentMatches).map((m) => m.id));
        const queue = buildSeedQueue(rebuilt, assignedIds);
        dispatch({ type: 'SEED_ROUND_QUEUE', payload: queue });
      },

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
// useGroupKnockoutStore — standalone hook for GK mode.
// ---------------------------------------------------------------------------
export function useGroupKnockoutStore() {
  const [state, dispatch] = useReducer(gkReducer, initialGKState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    getTournamentState().then((data) => {
      if (data) {
        const partial = buildGKStateFromDB(data as Record<string, unknown>);
        dispatch({ type: 'LOAD_STATE', payload: partial });
      }
      setIsHydrated(true);
    });
  }, []);

  usePersistence(
    isHydrated,
    state.status !== tournamentStatus.SETUP,
    state.saveKey,
    () => buildGKSnapshot(state),
    () => dispatch({ type: 'MARK_SAVED' }),
    (msg) => dispatch({ type: 'MARK_SAVE_ERROR', payload: msg }),
  );

  const handleSetMode = (m: gameMode) => {
    // GK mode is always GROUP_KNOCKOUT; no-op if different mode is requested.
    if (m !== gameMode.GROUP_KNOCKOUT) return;
  };

  return buildGKApi(state, dispatch, handleSetMode);
}
