import {
  calculateLeaderboard,
  generateRoundPairings,
  hasPlayedTogetherInHistory,
  reconcileCourtOrder,
} from '@/app/lib/engines/rally';

export const rallyDomain = {
  generatePairings: generateRoundPairings,
  calculateLeaderboard,
  hasPlayedTogetherInHistory,
  reconcileCourtOrder,
};
