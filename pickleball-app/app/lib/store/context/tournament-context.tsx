'use client';
import React, { createContext, useContext, useReducer } from 'react';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';

// ---------------------------------------------------------------------------
// Root tournament context — owns ONLY mode selection and the mode-lock flag.
// Once a tournament is first saved (setupComplete), mode is locked forever.
// All game-state lives in the mode-specific slice contexts/hooks.
// ---------------------------------------------------------------------------

export interface TournamentRootState {
  mode: gameMode;
  isModeLocked: boolean;
}

type TournamentRootAction =
  | { type: 'SET_MODE'; payload: gameMode }
  | { type: 'LOCK_MODE' };

function rootReducer(
  state: TournamentRootState,
  action: TournamentRootAction,
): TournamentRootState {
  switch (action.type) {
    case 'SET_MODE':
      if (state.isModeLocked) return state;
      return { ...state, mode: action.payload };
    case 'LOCK_MODE':
      return { ...state, isModeLocked: true };
    default:
      return state;
  }
}

const initialRootState: TournamentRootState = {
  mode: gameMode.RALLYTOTHETOP,
  isModeLocked: false,
};

interface TournamentContextValue {
  root: TournamentRootState;
  dispatch: React.Dispatch<TournamentRootAction>;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [root, dispatch] = useReducer(rootReducer, initialRootState);
  return (
    <TournamentContext.Provider value={{ root, dispatch }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournamentRoot(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournamentRoot must be used within TournamentProvider');
  return ctx;
}
