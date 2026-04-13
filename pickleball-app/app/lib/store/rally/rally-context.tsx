'use client';
import React, { createContext, useContext } from 'react';
import type { RallyState, RallyAction } from './rally-types';

interface RallyContextValue {
  state: RallyState;
  dispatch: React.Dispatch<RallyAction>;
}

const RallyContext = createContext<RallyContextValue | null>(null);

export function RallyProvider({
  value,
  children,
}: {
  value: RallyContextValue;
  children: React.ReactNode;
}) {
  return <RallyContext.Provider value={value}>{children}</RallyContext.Provider>;
}

export function useRallyContext(): RallyContextValue {
  const ctx = useContext(RallyContext);
  if (!ctx) throw new Error('useRallyContext must be used within RallyProvider');
  return ctx;
}
