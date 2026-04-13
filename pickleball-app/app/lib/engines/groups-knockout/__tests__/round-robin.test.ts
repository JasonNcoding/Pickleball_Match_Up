import { buildRoundRobinRounds, mapRoundResultsToStandings, isRoundComplete, createTeamKeyLookup } from '../round-robin';
import type { GroupsKnockoutTeam } from '../types';
import type { Player } from '@/app/lib/definitions';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makePlayer(id: string): Player {
  return { id, name: `Name-${id}`, rating: 3.5 };
}

function makeTeam(seed: number): GroupsKnockoutTeam {
  const p1 = makePlayer(`T${seed}P1`);
  const p2 = makePlayer(`T${seed}P2`);
  return {
    id: `TEAM-${seed}`,
    name: `Team ${seed}`,
    players: [p1, p2],
    seed,
  };
}

const FOUR_TEAMS = [1, 2, 3, 4].map(makeTeam);

// ─── buildRoundRobinRounds ──────────────────────────────────────────────────

describe('buildRoundRobinRounds', () => {
  it('generates the correct number of rounds', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 3);
    expect(rounds).toHaveLength(3);
  });

  it('each round has n/2 matches for n teams', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 3);
    rounds.forEach((round) => {
      expect(Object.keys(round.matches)).toHaveLength(FOUR_TEAMS.length / 2);
    });
  });

  it('every player appears exactly once per round', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 3);
    const allPlayerIds = FOUR_TEAMS.flatMap((t) => [t.players[0].id, t.players[1].id]);
    rounds.forEach((round) => {
      const idsInRound = Object.values(round.matches).flatMap((m) => [...m.teamA, ...m.teamB]);
      expect(idsInRound.sort()).toEqual(allPlayerIds.sort());
    });
  });

  it('cycles round pairings when totalRounds > teams-1', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 6); // 4 teams = 3 unique rounds; 6 cycles
    expect(rounds).toHaveLength(6);
  });
});

// ─── isRoundComplete ────────────────────────────────────────────────────────

describe('isRoundComplete', () => {
  it('returns false when any match has no winner', () => {
    const [round] = buildRoundRobinRounds(FOUR_TEAMS, 1);
    expect(isRoundComplete(round)).toBe(false);
  });

  it('returns true when all matches have winners', () => {
    const [round] = buildRoundRobinRounds(FOUR_TEAMS, 1);
    const completed = {
      ...round,
      matches: Object.fromEntries(
        Object.entries(round.matches).map(([id, m]) => [id, { ...m, winner: 'A' as const }]),
      ),
    };
    expect(isRoundComplete(completed)).toBe(true);
  });
});

// ─── createTeamKeyLookup ─────────────────────────────────────────────────────

describe('createTeamKeyLookup', () => {
  it('returns a lookup keyed by sorted player-id pair', () => {
    const lookup = createTeamKeyLookup(FOUR_TEAMS);
    const team1 = FOUR_TEAMS[0];
    const key = [team1.players[0].id, team1.players[1].id].sort().join('|');
    expect(lookup[key]).toBe(team1);
  });
});

// ─── mapRoundResultsToStandings ─────────────────────────────────────────────

describe('mapRoundResultsToStandings', () => {
  it('counts wins and losses correctly', () => {
    const [round] = buildRoundRobinRounds(FOUR_TEAMS, 1);
    // Set all matches with team A winning
    const completedRound = {
      ...round,
      matches: Object.fromEntries(
        Object.entries(round.matches).map(([id, m]) => [id, { ...m, winner: 'A' as const }]),
      ),
    };
    const standings = mapRoundResultsToStandings(FOUR_TEAMS, [completedRound]);
    const totalWins = standings.reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = standings.reduce((sum, s) => sum + s.losses, 0);
    expect(totalWins).toBe(Object.keys(completedRound.matches).length);
    expect(totalLosses).toBe(Object.keys(completedRound.matches).length);
  });

  it('includes all teams in standings', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 3).map((round) => ({
      ...round,
      matches: Object.fromEntries(
        Object.entries(round.matches).map(([id, m]) => [id, { ...m, winner: 'A' as const }]),
      ),
    }));
    const standings = mapRoundResultsToStandings(FOUR_TEAMS, rounds);
    expect(standings).toHaveLength(FOUR_TEAMS.length);
    FOUR_TEAMS.forEach((team) => {
      expect(standings.find((s) => s.teamId === team.id)).toBeDefined();
    });
  });

  it('sorts standings so highest-wins team is first', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 3).map((round) => ({
      ...round,
      matches: Object.fromEntries(
        Object.entries(round.matches).map(([id, m]) => [id, { ...m, winner: 'A' as const }]),
      ),
    }));
    const standings = mapRoundResultsToStandings(FOUR_TEAMS, rounds);
    for (let i = 1; i < standings.length; i++) {
      expect(standings[i - 1].wins).toBeGreaterThanOrEqual(standings[i].wins);
    }
  });

  it('returns zeroed standings for rounds with no played matches', () => {
    const rounds = buildRoundRobinRounds(FOUR_TEAMS, 1); // unplayed
    const standings = mapRoundResultsToStandings(FOUR_TEAMS, rounds);
    standings.forEach((s) => {
      expect(s.wins).toBe(0);
      expect(s.losses).toBe(0);
      expect(s.matchesPlayed).toBe(0);
    });
  });
});
