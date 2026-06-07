export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
};

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
}

export interface Round {
  id: number;
  matches: Record<string, Match>;
  waiting: string[];
  players?: Player[]; // bench counts snapshot — used by undo to revert bench counts
}