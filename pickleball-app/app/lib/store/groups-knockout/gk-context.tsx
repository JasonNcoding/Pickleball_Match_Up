'use client';
import React, { createContext, useContext } from 'react';
import type { GKState, GKAction } from './gk-types';

interface GKContextValue {
  state: GKState;
  dispatch: React.Dispatch<GKAction>;
}

const GKContext = createContext<GKContextValue | null>(null);

export function GroupKnockoutProvider({
  value,
  children,
}: {
  value: GKContextValue;
  children: React.ReactNode;
}) {
  return <GKContext.Provider value={value}>{children}</GKContext.Provider>;
}

export function useGKContext(): GKContextValue {
  const ctx = useContext(GKContext);
  if (!ctx) throw new Error('useGKContext must be used within GroupKnockoutProvider');
  return ctx;
}
