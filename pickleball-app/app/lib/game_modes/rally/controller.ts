import {
  calculateLeaderboard,
  generateRoundPairings,
  hasPlayedTogetherInHistory,
  reconcileCourtOrder,
} from '@/app/lib/tournament-engine';

export const rallyDomain = {
  generatePairings: generateRoundPairings,
  calculateLeaderboard,
  hasPlayedTogetherInHistory,
  reconcileCourtOrder,
};
