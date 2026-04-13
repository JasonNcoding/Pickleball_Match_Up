import { describe } from 'node:test';
import { buildKnockoutRounds, hydrateKnockoutRounds } from '../knockout';
import type { GroupsKnockoutTeam } from '../types';
import type { Player } from '@/app/lib/definitions';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makePlayer(id: string): Player {
  return { id, name: `Name-${id}`, rating: 3.5 };
}

function makeTeam(seed: number): GroupsKnockoutTeam {
  const p1 = makePlayer(`T${seed}P1`);
  const p2 = makePlayer(`T${seed}P2`);
  return { id: `TEAM-${seed}`, name: `Team ${seed}`, players: [p1, p2], seed };
}

const EIGHT_TEAMS = Array.from({ length: 8 }, (_, i) => makeTeam(i + 1));
const FOUR_TEAMS = Array.from({ length: 4 }, (_, i) => makeTeam(i + 1));

// ─── buildKnockoutRounds — 8-team bracket ──────────────────────────────────

describe('buildKnockoutRounds — 8-team (QF → SF → F)', () => {
  it('produces exactly 3 rounds', () => {
    const rounds = buildKnockoutRounds(EIGHT_TEAMS, 8, 0);
    expect(rounds).toHaveLength(3);
  });

  it('first round has 4 matches (QF)', () => {
    const rounds = buildKnockoutRounds(EIGHT_TEAMS, 8, 0);
    expect(Object.keys(rounds[0].matches)).toHaveLength(4);
  });

  it('second round has 2 matches (SF) — teams start as empty', () => {
    const rounds = buildKnockoutRounds(EIGHT_TEAMS, 8, 0);
    const sf = Object.values(rounds[1].matches);
    expect(sf).toHaveLength(2);
    // teams not filled yet — should be empty arrays
    sf.forEach((m) => {
      expect(m.teamA).toHaveLength(0);
      expect(m.teamB).toHaveLength(0);
    });
  });

  it('final round has 1 match', () => {
    const rounds = buildKnockoutRounds(EIGHT_TEAMS, 8, 0);
    expect(Object.keys(rounds[2].matches)).toHaveLength(1);
  });

  it('seeding seeds 1st vs 8th and 4th vs 5th in QF', () => {
    const rounds = buildKnockoutRounds(EIGHT_TEAMS, 8, 0);
    const qfMatches = Object.values(rounds[0].matches);
    const qf1 = qfMatches.find((m) => m.id === 'QF-1')!;
    expect(qf1.teamA).toContain('T1P1'); // seed 1 team
    expect(qf1.teamB).toContain('T8P1'); // seed 8 team
  });

  it('uses startingRoundId for round numbering', () => {
    const rounds = buildKnockoutRounds(EIGHT_TEAMS, 8, 5);
    expect(rounds[0].id).toBe(5);
    expect(rounds[1].id).toBe(6);
    expect(rounds[2].id).toBe(7);
  });

  it('throws when fewer teams than knockoutSize', () => {
    expect(() => buildKnockoutRounds(FOUR_TEAMS, 8, 0)).toThrow();
  });
});

// ─── buildKnockoutRounds — 4-team bracket ──────────────────────────────────

describe('buildKnockoutRounds — 4-team (SF → F)', () => {
  it('produces exactly 2 rounds', () => {
    const rounds = buildKnockoutRounds(FOUR_TEAMS, 4, 0);
    expect(rounds).toHaveLength(2);
  });

  it('first round has 2 matches (SF)', () => {
    const rounds = buildKnockoutRounds(FOUR_TEAMS, 4, 0);
    expect(Object.keys(rounds[0].matches)).toHaveLength(2);
  });

  it('seeds 1st vs 4th in SF-1', () => {
    const rounds = buildKnockoutRounds(FOUR_TEAMS, 4, 0);
    const sf1 = rounds[0].matches['SF-1']!;
    expect(sf1.teamA).toContain('T1P1');
    expect(sf1.teamB).toContain('T4P1');
  });
});

// ─── hydrateKnockoutRounds ──────────────────────────────────────────────────

describe('hydrateKnockoutRounds — 4-team (SF → F)', () => {
  it('fills final teams from SF match winners', () => {
    let [sf, final] = buildKnockoutRounds(FOUR_TEAMS, 4, 0);
    // Mark SF-1 winner = team A; SF-2 winner = team B
    sf = {
      ...sf,
      matches: {
        ...sf.matches,
        'SF-1': { ...sf.matches['SF-1'], winner: 'A' },
        'SF-2': { ...sf.matches['SF-2'], winner: 'B' },
      },
    };
    const hydrated = hydrateKnockoutRounds([sf, final]);

    const hydratedFinal = Object.values(hydrated[1].matches)[0];
    expect(hydratedFinal.teamA).toEqual(sf.matches['SF-1'].teamA);
    expect(hydratedFinal.teamB).toEqual(sf.matches['SF-2'].teamB);
  });
});

describe('hydrateKnockoutRounds — 8-team (QF → SF → F)', () => {
  it('propagates QF winners into SF slots', () => {
    let [qf, sf, final] = buildKnockoutRounds(EIGHT_TEAMS, 8, 0);
    // All QF matches won by team A
    qf = {
      ...qf,
      matches: Object.fromEntries(
        Object.entries(qf.matches).map(([id, m]) => [id, { ...m, winner: 'A' as const }]),
      ),
    };
    const hydrated = hydrateKnockoutRounds([qf, sf, final]);
    const hydratedSF = Object.values(hydrated[1].matches);
    // SF slots should now have players from QF winners
    hydratedSF.forEach((sfMatch) => {
      expect(sfMatch.teamA.length).toBeGreaterThan(0);
      expect(sfMatch.teamB.length).toBeGreaterThan(0);
    });
  });
});
