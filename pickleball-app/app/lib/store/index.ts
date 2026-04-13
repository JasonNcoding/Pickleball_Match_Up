// Public API for app/lib/store
export { useTournamentController } from './tournament-controller';

// Root context (for future deeply-nested components such as the display page)
export { TournamentProvider, useTournamentRoot } from './context/tournament-context';

// Rally slice
export { rallyReducer, initialRallyState } from './rally/rally-reducer';
export { RallyProvider, useRallyContext } from './rally/rally-context';
export { useRallyStore, buildRallyApi, buildRallySnapshot, buildRallyStateFromDB } from './rally/useRallyStore';
export type { RallyState, RallyAction, RallyMode, SwapSlot as RallySwapSlot } from './rally/rally-types';

// GroupKnockout slice
export { gkReducer, initialGKState } from './groups-knockout/gk-reducer';
export { GroupKnockoutProvider, useGKContext } from './groups-knockout/gk-context';
export {
  useGroupKnockoutStore,
  buildGKApi,
  buildGKSnapshot,
  buildGKStateFromDB,
} from './groups-knockout/useGroupKnockoutStore';
export type { GKState, GKAction, GKKnockoutStage, GKScoreDraft, GKUnassignedMatch } from './groups-knockout/gk-types';

// Shared primitives
export type { CourtTeamDraft, SwapSelection } from './shared/types';
