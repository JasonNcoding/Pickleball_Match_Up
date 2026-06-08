export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export type GameMode = 'rally' | 'round-robin' | 'knockout' | 'swiss' | 'swiss-ko';

export type RatingOrder = 'highToTop' | 'lowToTop';

export interface ModeConfig {
  mode: GameMode;
  legs?: number; // round-robin: how many full round robins to play (default: 1)
  maxMatchesPerTeam?: number; // round-robin: cap how many matches each team plays (default: no limit)
  swissRounds?: number; // swiss / swiss-ko: number of swiss rounds to play (default: 4)
  swissKoAdvancing?: number; // swiss-ko: how many teams advance to KO bracket (power of 2, default: 4)
  fixedPartners?: Record<string, string>; // playerId → partnerId; set at startTournament for RR/Knockout
  teamSize?: 1 | 2; // 1 = singles (1v1), 2 = doubles (2v2); default 2
  recordMode?: 'win-loss' | 'score'; // RR/KO/Swiss: whether to record match scores; default 'win-loss'
  groupCount?: number; // number of groups (undefined/1 = no groups); groups run sequentially then feed a KO final
  advancingPerGroup?: number; // top N per group advancing to KO bracket (default: 1)
}

export interface PreAssignment {
  courts: Record<string, Match>; // courtId → Match (winner: null)
  bench: string[];               // player IDs not assigned to any court
}

export interface Player {
  id: string;
  name: string;
  rating: number;
  benchCount: number;
  lastBenchedRound: number | null;
}

export interface Match {
  teamA: string[];
  teamB: string[];
  winner: 'A' | 'B' | null;
  scoreA?: number;
  scoreB?: number;
}

export interface ScheduledMatch {
  id: string;
  teamA: string[];
  teamB: string[];
}

export interface Round {
  id: number;
  matches: Record<string, Match>;
  waiting: string[];
  players?: Player[]; // bench counts snapshot — used by undo to revert bench counts
  eliminatedPlayerIds?: string[]; // knockout snapshot — used by undo
  swissRound?: number; // swissCurrentRound at commit time — used by undo to restore counter
  isSwissKoTransition?: boolean; // true when this commit triggered the Swiss→KO phase transition
  activeCourts?: string[]; // KO/Swiss-KO KO phase: courts active when this round was committed — used by undo
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  winCount: number;
}