export type CourtTeamDraft = {
  teamAName: string;
  teamBName: string;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
};

export type SwapSelection = {
  courtId?: string;
  team?: 'A' | 'B';
  index?: number;
  isWaitlist?: boolean;
  pId?: string;
} | null;
