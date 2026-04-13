'use client';
import { useReducer, useEffect, useState } from 'react';
import { getTournamentState } from '@/app/lib/actions';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { tournamentStatus } from '@/app/lib/tournament_mode/tournamentStatus';
import { usePersistence } from './shared/persistence';
import { rallyReducer, initialRallyState } from './rally/rally-reducer';
import { buildRallyApi, buildRallySnapshot, buildRallyStateFromDB } from './rally/useRallyStore';
import type { RallyMode } from './rally/rally-types';
import { gkReducer, initialGKState } from './groups-knockout/gk-reducer';
import { buildGKApi, buildGKSnapshot, buildGKStateFromDB } from './groups-knockout/useGroupKnockoutStore';

// ---------------------------------------------------------------------------
// useTournamentController — the composite hook consumed by admin/page.tsx.
//
// Architecture:
//   - Always calls BOTH useReducer hooks (React hook rules require unconditional
//     calls). Only the active slice is exposed; the inactive one holds its last
//     state silently.
//   - DB hydration happens once in this hook; it dispatches LOAD_STATE to the
//     correct slice reducer based on the loaded mode.
//   - Persistence fires from this hook on the active slice's saveKey so only
//     one save ever fires per change — no double-save risk.
//   - handleSetMode is passed down as the onSetMode callback. After the first
//     successful save, mode is locked and SET_MODE becomes a no-op.
//
// The returned API shape is identical to the old useTournamentController, so
// admin/page.tsx only needs its import path changed.
// ---------------------------------------------------------------------------

function isGKMode(m: gameMode): boolean {
  return m === gameMode.GROUP_KNOCKOUT;
}

function resolveMode(data: Record<string, unknown>): gameMode {
  const raw = (data.mode ?? data.tournamentType ?? gameMode.RALLYTOTHETOP) as string;
  if (raw === 'DUPR Tournament') return gameMode.GROUP_KNOCKOUT;
  const values = Object.values(gameMode) as string[];
  return values.includes(raw) ? (raw as gameMode) : gameMode.RALLYTOTHETOP;
}

export function useTournamentController() {
  // Both reducers are always initialised — hook call order must be stable.
  const [rallyState, dispatchRally] = useReducer(rallyReducer, initialRallyState);
  const [gkState, dispatchGK] = useReducer(gkReducer, initialGKState);

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeMode, setActiveMode] = useState<gameMode>(gameMode.RALLYTOTHETOP);
  const [isModeLocked, setIsModeLocked] = useState(false);

  // ------- single DB load on mount -------
  useEffect(() => {
    getTournamentState().then((data) => {
      if (data) {
        const raw = data as Record<string, unknown>;
        const resolved = resolveMode(raw);
        setActiveMode(resolved);

        if (isGKMode(resolved)) {
          dispatchGK({ type: 'LOAD_STATE', payload: buildGKStateFromDB(raw) });
        } else {
          dispatchRally({ type: 'LOAD_STATE', payload: buildRallyStateFromDB(raw) });
        }

        if (data.setupComplete) setIsModeLocked(true);
      }
      setIsHydrated(true);
    });
  }, []);

  // ------- persistence: only active slice saves -------
  const isGK = isGKMode(activeMode);
  const activeSaveKey = isGK ? gkState.saveKey : rallyState.saveKey;
  const activeCanSave = isGK
    ? gkState.status !== tournamentStatus.SETUP
    : rallyState.status !== tournamentStatus.SETUP;

  usePersistence(
    isHydrated,
    activeCanSave,
    activeSaveKey,
    () => (isGK ? buildGKSnapshot(gkState) : buildRallySnapshot(rallyState)),
    () => {
      if (isGK) dispatchGK({ type: 'MARK_SAVED' });
      else dispatchRally({ type: 'MARK_SAVED' });
      // Lock mode on first successful save (setupComplete was just persisted).
      if (!isModeLocked && activeCanSave) setIsModeLocked(true);
    },
    (msg) => {
      if (isGK) dispatchGK({ type: 'MARK_SAVE_ERROR', payload: msg });
      else dispatchRally({ type: 'MARK_SAVE_ERROR', payload: msg });
    },
  );

  // ------- mode setter (locked after first save) -------
  const handleSetMode = (m: gameMode) => {
    if (isModeLocked) return;
    setActiveMode(m);
    if (isGKMode(m)) {
      // Carry player list across mode switch so the user doesn't lose their setup.
      dispatchGK({
        type: 'LOAD_STATE',
        payload: { players: rallyState.players, bulkInput: rallyState.bulkInput },
      });
    } else {
      dispatchRally({
        type: 'SET_MODE',
        payload: m as RallyMode,
      });
      dispatchRally({
        type: 'LOAD_STATE',
        payload: { players: gkState.players, bulkInput: gkState.bulkInput },
      });
    }
  };

  // ------- return active slice API -------
  if (isGK) {
    return buildGKApi(gkState, dispatchGK, handleSetMode);
  }
  return buildRallyApi(rallyState, dispatchRally, handleSetMode);
}
