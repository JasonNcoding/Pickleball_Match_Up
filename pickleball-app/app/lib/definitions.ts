export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export interface Round {
  id: number; // TODO remove
  matches: Record<string, Match>;
  waiting: string[];
}

export interface Match {
  id: string;
  teamA: string[];
  teamB: string[];
  winner: 'A' | 'B' | null;
  score?: string | null;
}

export interface Player {
  id: string;
  name: string;
  rating: number;
}
