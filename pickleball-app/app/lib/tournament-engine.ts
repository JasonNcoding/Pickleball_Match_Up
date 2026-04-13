// Shim — all logic lives in engines/rally/. This file remains for backward compatibility.
export {
  hasPlayedTogetherInHistory,
  getPartnershipCount,
  reconcileCourtOrder,
  generateRoundPairings,
  calculateLeaderboard,
} from '@/app/lib/engines/rally';
export type {
  LeaderboardEntry,
  CalculateLeaderboardInput,
  GenerateRoundPairingsInput,
  GenerateRoundPairingsResult,
} from '@/app/lib/engines/rally';
