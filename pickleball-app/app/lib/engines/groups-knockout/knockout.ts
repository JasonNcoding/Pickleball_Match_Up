import type { Match, Round } from '@/app/lib/definitions';
import type { GroupsKnockoutTeam } from './types';

function makeMatch(id: string, teamAPlayerIds: string[], teamBPlayerIds: string[]): Match {
  return { id, teamA: teamAPlayerIds, teamB: teamBPlayerIds, winner: null, score: null };
}

function buildRound(matches: Match[], roundId: number): Round {
  return {
    id: roundId,
    matches: matches.reduce<Record<string, Match>>((acc, match) => {
      acc[match.id] = match;
      return acc;
    }, {}),
    waiting: [],
  };
}

function getWinnerTeamPlayers(match: Match): string[] | null {
  if (!match.winner) return null;
  return match.winner === 'A' ? match.teamA : match.teamB;
}

export function buildKnockoutRounds(
  rankedTeams: GroupsKnockoutTeam[],
  knockoutSize: 4 | 8,
  startingRoundId: number,
): Round[] {
  const selected = rankedTeams.slice(0, knockoutSize);
  if (selected.length < knockoutSize) {
    throw new Error(`Need at least ${knockoutSize} ranked teams for knockout.`);
  }

  const teamPlayers = (team: GroupsKnockoutTeam) => [team.players[0].id, team.players[1].id];
  const rounds: Round[] = [];

  if (knockoutSize === 8) {
    const qfMatches: Match[] = [
      makeMatch('QF-1', teamPlayers(selected[0]), teamPlayers(selected[7])),
      makeMatch('QF-2', teamPlayers(selected[3]), teamPlayers(selected[4])),
      makeMatch('QF-3', teamPlayers(selected[1]), teamPlayers(selected[6])),
      makeMatch('QF-4', teamPlayers(selected[2]), teamPlayers(selected[5])),
    ];
    rounds.push(buildRound(qfMatches, startingRoundId));
    rounds.push(
      buildRound(
        [makeMatch('SF-1', [], []), makeMatch('SF-2', [], [])],
        startingRoundId + 1,
      ),
    );
  } else {
    const sfMatches: Match[] = [
      makeMatch('SF-1', teamPlayers(selected[0]), teamPlayers(selected[3])),
      makeMatch('SF-2', teamPlayers(selected[1]), teamPlayers(selected[2])),
    ];
    rounds.push(buildRound(sfMatches, startingRoundId));
  }

  rounds.push(buildRound([makeMatch('F-1', [], [])], startingRoundId + rounds.length));
  return rounds;
}

export function hydrateKnockoutRounds(rounds: Round[]): Round[] {
  const next = rounds.map((round) => ({
    ...round,
    matches: Object.fromEntries(
      Object.entries(round.matches).map(([courtId, match]) => [courtId, { ...match }]),
    ),
  }));

  if (next.length === 3) {
    // QF → SF → F
    const [qf, sf, f] = next;
    const qfWinners = Object.values(qf.matches).map(getWinnerTeamPlayers);
    const sfMatches = Object.values(sf.matches);
    if (sfMatches[0]) { sfMatches[0].teamA = qfWinners[0] ?? []; sfMatches[0].teamB = qfWinners[1] ?? []; }
    if (sfMatches[1]) { sfMatches[1].teamA = qfWinners[2] ?? []; sfMatches[1].teamB = qfWinners[3] ?? []; }
    const sfWinners = sfMatches.map(getWinnerTeamPlayers);
    const final = Object.values(f.matches)[0];
    if (final) { final.teamA = sfWinners[0] ?? []; final.teamB = sfWinners[1] ?? []; }
    return next;
  }

  if (next.length === 2) {
    // SF → F
    const [sf, f] = next;
    const sfWinners = Object.values(sf.matches).map(getWinnerTeamPlayers);
    const final = Object.values(f.matches)[0];
    if (final) { final.teamA = sfWinners[0] ?? []; final.teamB = sfWinners[1] ?? []; }
  }

  return next;
}
