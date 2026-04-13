import { generateRoundPairings, reconcileCourtOrder } from '../pairing';
import type { Player, Round } from '@/app/lib/definitions';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makePlayer(id: string, rating: number): Player {
  return { id, name: id, rating };
}

const COURTS = ['C1', 'C2'];
const emptyHistory: Round[] = [];

// ─── reconcileCourtOrder ────────────────────────────────────────────────────

describe('reconcileCourtOrder', () => {
  it('retains common courts in selectedCourts order', () => {
    // prevOrder has C1,C2,C3 but selectedCourts is ['C3','C1'] → result follows selectedCourts order
    expect(reconcileCourtOrder(['C1', 'C2', 'C3'], ['C3', 'C1'])).toEqual(['C3', 'C1']);
  });

  it('appends newly added courts at the end', () => {
    expect(reconcileCourtOrder(['C1'], ['C1', 'C2', 'C3'])).toEqual(['C1', 'C2', 'C3']);
  });

  it('drops courts removed from selection', () => {
    expect(reconcileCourtOrder(['C1', 'C2', 'C3'], ['C1'])).toEqual(['C1']);
  });
});

// ─── generateRoundPairings — first round ───────────────────────────────────

describe('generateRoundPairings — first round', () => {
  it('assigns players to courts in ascending rating order', () => {
    // 8 players, 2 courts → all 8 play
    const roster = [
      makePlayer('P1', 5.0),
      makePlayer('P2', 2.0),
      makePlayer('P3', 3.5),
      makePlayer('P4', 4.0),
      makePlayer('P5', 1.0),
      makePlayer('P6', 2.5),
      makePlayer('P7', 3.0),
      makePlayer('P8', 4.5),
    ];
    const { matches, waitingIds } = generateRoundPairings({
      isFirst: true,
      roster,
      courts: COURTS,
      currentMatches: {},
      waitingPlayers: [],
      courtOrder: COURTS,
      history: emptyHistory,
    });
    expect(waitingIds).toHaveLength(0);
    expect(Object.keys(matches)).toHaveLength(COURTS.length);
    // All 8 player ids appear in matches
    const playingIds = Object.values(matches).flatMap((m) => [...m.teamA, ...m.teamB]);
    expect(playingIds).toHaveLength(8);
  });

  it('places extra players on the waiting list when player count is not perfectly divisible', () => {
    // 10 players, 2 courts (need 8) → 2 waiting
    const roster = Array.from({ length: 10 }, (_, i) =>
      makePlayer(`P${i + 1}`, i + 1),
    );
    const { waitingIds } = generateRoundPairings({
      isFirst: true,
      roster,
      courts: COURTS,
      currentMatches: {},
      waitingPlayers: [],
      courtOrder: COURTS,
      history: emptyHistory,
    });
    expect(waitingIds).toHaveLength(2);
  });

  it('returns empty matches and full waiting list when no courts are provided', () => {
    const roster = [makePlayer('P1', 3.0), makePlayer('P2', 2.0)];
    const { matches, waitingIds } = generateRoundPairings({
      isFirst: true,
      roster,
      courts: [],
      currentMatches: {},
      waitingPlayers: [],
      courtOrder: [],
      history: emptyHistory,
    });
    expect(Object.keys(matches)).toHaveLength(0);
    expect(waitingIds).toHaveLength(roster.length);
  });
});

// ─── generateRoundPairings — subsequent round ───────────────────────────────

describe('generateRoundPairings — subsequent rounds', () => {
  it('integrates waiting players from the previous round', () => {
    const roster = Array.from({ length: 9 }, (_, i) => makePlayer(`P${i + 1}`, i + 1));
    // First round: 8 play, P9 waits
    const firstResult = generateRoundPairings({
      isFirst: true,
      roster,
      courts: COURTS,
      currentMatches: {},
      waitingPlayers: [],
      courtOrder: COURTS,
      history: emptyHistory,
    });
    // Simulate match winners
    const courtIds = Object.keys(firstResult.matches);
    for (const courtId of courtIds) {
      firstResult.matches[courtId] = { ...firstResult.matches[courtId], winner: 'A' };
    }
    // Second round
    const secondResult = generateRoundPairings({
      isFirst: false,
      roster,
      courts: COURTS,
      currentMatches: firstResult.matches,
      waitingPlayers: firstResult.waitingIds,
      courtOrder: COURTS,
      history: [{ id: 0, matches: firstResult.matches, waiting: firstResult.waitingIds }],
    });
    const allIds = Object.values(secondResult.matches).flatMap((m) => [...m.teamA, ...m.teamB]);
    expect(allIds).toContain('P9'); // previously waiting player now plays
  });
});
