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
}