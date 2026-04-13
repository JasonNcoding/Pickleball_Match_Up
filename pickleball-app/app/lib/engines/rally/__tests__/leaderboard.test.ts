import { calculateLeaderboard } from '../leaderboard';
import type { Player, Round } from '@/app/lib/definitions';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makePlayer(id: string): Player {
  return { id, name: `Name-${id}`, rating: 3.5 };
}

function makeRound(kingCourtId: string, winnerTeam: 'A' | 'B', teamA: string[], teamB: string[]): Round {
  return {
    id: 0,
    matches: {
      [kingCourtId]: { id: kingCourtId, teamA, teamB, winner: winnerTeam, score: null },
    },
    waiting: [],
  };
}

const KING = 'C1';
const PLAYERS = ['P1', 'P2', 'P3', 'P4'].map(makePlayer);

// ─── Round-1 skip rule ──────────────────────────────────────────────────────

describe('calculateLeaderboard — round 1 skip', () => {
  it('does not count king court wins from round index 0 (the first round)', () => {
    const history: Round[] = [makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4'])];
    const result = calculateLeaderboard({ players: PLAYERS, history, kingCourt: KING });
    expect(result.every((e) => e.winCount === 0)).toBe(true);
  });

  it('counts king court wins starting from round index 1+', () => {
    const history: Round[] = [
      makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4']), // round 0 — skipped
      makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4']), // round 1 — counted
    ];
    const result = calculateLeaderboard({ players: PLAYERS, history, kingCourt: KING });
    const p1 = result.find((e) => e.name === 'Name-P1');
    const p2 = result.find((e) => e.name === 'Name-P2');
    const p3 = result.find((e) => e.name === 'Name-P3');
    expect(p1?.winCount).toBe(1);
    expect(p2?.winCount).toBe(1);
    expect(p3?.winCount).toBe(0);
  });
});

// ─── Accumulation across multiple rounds ────────────────────────────────────

describe('calculateLeaderboard — win accumulation', () => {
  it('accumulates wins across many rounds', () => {
    // Rounds 0-4: P1/P2 win every king court round (0 is skipped)
    const history: Round[] = Array.from({ length: 5 }, () =>
      makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4']),
    );
    const result = calculateLeaderboard({ players: PLAYERS, history, kingCourt: KING });
    const p1 = result.find((e) => e.name === 'Name-P1');
    expect(p1?.winCount).toBe(4); // rounds 1-4
  });

  it('returns all zeroes when no kingCourt is supplied', () => {
    const history: Round[] = [makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4'])];
    const result = calculateLeaderboard({ players: PLAYERS, history });
    expect(result.every((e) => e.winCount === 0)).toBe(true);
  });

  it('sorts results in descending win order', () => {
    const history: Round[] = [
      makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4']),
      makeRound(KING, 'A', ['P1', 'P2'], ['P3', 'P4']),
      makeRound(KING, 'B', ['P1', 'P2'], ['P3', 'P4']),
    ];
    const result = calculateLeaderboard({ players: PLAYERS, history, kingCourt: KING });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].winCount).toBeGreaterThanOrEqual(result[i].winCount);
    }
  });
});
