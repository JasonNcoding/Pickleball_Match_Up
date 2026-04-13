import type { Match, Round } from '@/app/lib/definitions';
import type { GroupsKnockoutTeam, GroupsKnockoutTeamStanding } from './types';

// ── internal helpers ────────────────────────────────────────────────────────

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

function toTeamLookup(teams: GroupsKnockoutTeam[]): Record<string, GroupsKnockoutTeam> {
  return teams.reduce<Record<string, GroupsKnockoutTeam>>((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {});
}

function teamKeyFromPlayers(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
}

export function createTeamKeyLookup(teams: GroupsKnockoutTeam[]): Record<string, GroupsKnockoutTeam> {
  return teams.reduce<Record<string, GroupsKnockoutTeam>>((acc, team) => {
    acc[teamKeyFromPlayers([team.players[0].id, team.players[1].id])] = team;
    return acc;
  }, {});
}

function rotateTeams(teamIds: string[]): string[] {
  if (teamIds.length <= 2) return teamIds;
  return [teamIds[0], teamIds[teamIds.length - 1], ...teamIds.slice(1, -1)];
}

function generateUniqueRoundRobinPairings(teamIds: string[]): [string, string][][] {
  const current = [...teamIds];
  const rounds: [string, string][][] = [];
  const roundsToGenerate = Math.max(0, current.length - 1);

  for (let round = 0; round < roundsToGenerate; round++) {
    const pairings: [string, string][] = [];
    const half = current.length / 2;
    for (let i = 0; i < half; i++) {
      pairings.push([current[i], current[current.length - 1 - i]]);
    }
    rounds.push(pairings);
    current.splice(0, current.length, ...rotateTeams(current));
  }

  return rounds;
}

// ── public API ────────────────────────────────────────────────────────────────

export function buildRoundRobinRounds(teams: GroupsKnockoutTeam[], totalRounds: number): Round[] {
  const teamIds = teams.map((team) => team.id);
  const teamLookup = toTeamLookup(teams);
  const uniqueRounds = generateUniqueRoundRobinPairings(teamIds);
  const rounds: Round[] = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const pairings = uniqueRounds[roundIndex % uniqueRounds.length];
    const matches = pairings.map(([teamAId, teamBId], matchIndex) =>
      makeMatch(
        `RR-${roundIndex + 1}-${matchIndex + 1}`,
        [teamLookup[teamAId].players[0].id, teamLookup[teamAId].players[1].id],
        [teamLookup[teamBId].players[0].id, teamLookup[teamBId].players[1].id],
      ),
    );
    rounds.push(buildRound(matches, roundIndex));
  }

  return rounds;
}

export function isRoundComplete(round: Round): boolean {
  return Object.values(round.matches).every((match) => match.winner !== null);
}

export function mapRoundResultsToStandings(
  teams: GroupsKnockoutTeam[],
  rounds: Round[],
): GroupsKnockoutTeamStanding[] {
  const standings = teams.reduce<Record<string, GroupsKnockoutTeamStanding>>((acc, team) => {
    acc[team.id] = { teamId: team.id, teamName: team.name, wins: 0, losses: 0, matchesPlayed: 0 };
    return acc;
  }, {});

  const poolPointDiff = teams.reduce<Record<string, number>>((acc, team) => {
    acc[team.id] = 0;
    return acc;
  }, {});

  const headToHeadDiff = teams.reduce<Record<string, Record<string, number>>>((acc, team) => {
    acc[team.id] = {};
    return acc;
  }, {});

  const teamKeyLookup = createTeamKeyLookup(teams);
  const teamIdSet = new Set(teams.map((team) => team.id));

  const parseScore = (score: string | null | undefined): { aScore: number; bScore: number } | null => {
    if (!score) return null;
    const parsed = score.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!parsed) return null;
    return { aScore: Number(parsed[1]), bScore: Number(parsed[2]) };
  };

  const addH2HDiff = (aId: string, bId: string, diffForA: number) => {
    headToHeadDiff[aId][bId] = (headToHeadDiff[aId][bId] ?? 0) + diffForA;
    headToHeadDiff[bId][aId] = (headToHeadDiff[bId][aId] ?? 0) - diffForA;
  };

  rounds.forEach((round) => {
    Object.values(round.matches).forEach((match) => {
      const teamA = teamKeyLookup[teamKeyFromPlayers(match.teamA)];
      const teamB = teamKeyLookup[teamKeyFromPlayers(match.teamB)];
      if (!teamA || !teamB) return;
      if (!teamIdSet.has(teamA.id) || !teamIdSet.has(teamB.id)) return;

      const parsed = parseScore(match.score ?? null);
      if (parsed) {
        const diff = parsed.aScore - parsed.bScore;
        poolPointDiff[teamA.id] += diff;
        poolPointDiff[teamB.id] -= diff;
        addH2HDiff(teamA.id, teamB.id, diff);
      }

      if (!match.winner) return;

      const winner = match.winner === 'A' ? teamA : teamB;
      const loser = match.winner === 'A' ? teamB : teamA;

      standings[winner.id].wins += 1;
      standings[winner.id].matchesPlayed += 1;
      standings[loser.id].losses += 1;
      standings[loser.id].matchesPlayed += 1;
    });
  });

  const teamNameById = teams.reduce<Record<string, string>>((acc, team) => {
    acc[team.id] = team.name;
    return acc;
  }, {});

  const h2hDiffWithinGroup = (teamId: string, tiedIds: string[]): number =>
    tiedIds
      .filter((id) => id !== teamId)
      .reduce((sum, id) => sum + (headToHeadDiff[teamId][id] ?? 0), 0);

  const sortTieGroup = (teamIds: string[], nextHigherId: string | null): string[] =>
    [...teamIds].sort((aId, bId) => {
      const h2hA = h2hDiffWithinGroup(aId, teamIds);
      const h2hB = h2hDiffWithinGroup(bId, teamIds);
      if (h2hB !== h2hA) return h2hB - h2hA;

      const poolA = poolPointDiff[aId] ?? 0;
      const poolB = poolPointDiff[bId] ?? 0;
      if (poolB !== poolA) return poolB - poolA;

      const vsNextA = nextHigherId ? (headToHeadDiff[aId][nextHigherId] ?? 0) : 0;
      const vsNextB = nextHigherId ? (headToHeadDiff[bId][nextHigherId] ?? 0) : 0;
      if (vsNextB !== vsNextA) return vsNextB - vsNextA;

      return (teamNameById[aId] ?? aId).localeCompare(teamNameById[bId] ?? bId);
    });

  const groupedByWins = Object.values(standings).reduce<Record<number, string[]>>((acc, entry) => {
    if (!acc[entry.wins]) acc[entry.wins] = [];
    acc[entry.wins].push(entry.teamId);
    return acc;
  }, {});

  const orderedWins = Object.keys(groupedByWins).map(Number).sort((a, b) => b - a);

  const rankedTeamIds: string[] = [];
  orderedWins.forEach((wins) => {
    const tied = groupedByWins[wins];
    const nextHigherId = rankedTeamIds.length > 0 ? rankedTeamIds[rankedTeamIds.length - 1] : null;
    rankedTeamIds.push(...sortTieGroup(tied, nextHigherId));
  });

  return rankedTeamIds.map((teamId) => standings[teamId]).filter(Boolean);
}
