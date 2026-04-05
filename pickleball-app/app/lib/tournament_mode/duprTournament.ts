import { Match, Player, Round } from '../definitions';
import { gameMode } from './gameMode';
import { tournamentStatus } from './tournamentStatus';
import { TournamentType } from './tournamentType';

type Winner = 'A' | 'B';

export interface DuprTeam {
  id: string;
  name: string;
  players: [Player, Player];
  seed: number;
}

export interface DuprTeamStanding {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

export interface DuprTournamentOptions {
  roundRobinRounds?: number;
  knockoutSize?: 4 | 8;
}

export interface DuprTournamentState {
  mode: gameMode.DUPR;
  teams: DuprTeam[];
  roundRobinRounds: number;
  knockoutSize: 4 | 8;
  phase: 'ROUND_ROBIN' | 'KNOCKOUT' | 'COMPLETED';
  rounds: Round[];
  currentRoundNumber: number;
}

function isRoundComplete(round: Round): boolean {
  return Object.values(round.matches).every((match) => match.winner !== null);
}

function teamFromMatchSide(match: Match, side: Winner): string[] {
  return side === 'A' ? match.teamA : match.teamB;
}

function getWinnerTeamPlayers(match: Match): string[] | null {
  if (!match.winner) return null;
  return teamFromMatchSide(match, match.winner);
}

function toTeamLookup(teams: DuprTeam[]): Record<string, DuprTeam> {
  return teams.reduce<Record<string, DuprTeam>>((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {});
}

function teamKeyFromPlayers(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
}

function createTeamKeyLookup(teams: DuprTeam[]): Record<string, DuprTeam> {
  return teams.reduce<Record<string, DuprTeam>>((acc, team) => {
    acc[teamKeyFromPlayers([team.players[0].id, team.players[1].id])] = team;
    return acc;
  }, {});
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

function makeMatch(id: string, teamAPlayerIds: string[], teamBPlayerIds: string[]): Match {
  return {
    id,
    teamA: teamAPlayerIds,
    teamB: teamBPlayerIds,
    winner: null,
    score: null,
  };
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
      const a = current[i];
      const b = current[current.length - 1 - i];
      pairings.push([a, b]);
    }
    rounds.push(pairings);
    const rotated = rotateTeams(current);
    current.splice(0, current.length, ...rotated);
  }

  return rounds;
}

function buildRoundRobinRounds(
  teams: DuprTeam[],
  totalRounds: number,
): Round[] {
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

function mapRoundResultsToStandings(teams: DuprTeam[], rounds: Round[]): DuprTeamStanding[] {
  const standings = teams.reduce<Record<string, DuprTeamStanding>>((acc, team) => {
    acc[team.id] = {
      teamId: team.id,
      teamName: team.name,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
    };
    return acc;
  }, {});
  const poolPointDifferential = teams.reduce<Record<string, number>>((acc, team) => {
    acc[team.id] = 0;
    return acc;
  }, {});
  const headToHeadPointDifferential = teams.reduce<Record<string, Record<string, number>>>((acc, team) => {
    acc[team.id] = {};
    return acc;
  }, {});

  const teamKeyLookup = createTeamKeyLookup(teams);
  const teamIdSet = new Set(teams.map((team) => team.id));

  const parseMatchScore = (score: string | null | undefined): { teamAScore: number; teamBScore: number } | null => {
    if (!score) return null;
    const parsed = score.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!parsed) return null;
    return { teamAScore: Number(parsed[1]), teamBScore: Number(parsed[2]) };
  };

  const addHeadToHeadPointDiff = (teamAId: string, teamBId: string, diffForTeamA: number) => {
    if (!headToHeadPointDifferential[teamAId][teamBId]) headToHeadPointDifferential[teamAId][teamBId] = 0;
    if (!headToHeadPointDifferential[teamBId][teamAId]) headToHeadPointDifferential[teamBId][teamAId] = 0;
    headToHeadPointDifferential[teamAId][teamBId] += diffForTeamA;
    headToHeadPointDifferential[teamBId][teamAId] -= diffForTeamA;
  };

  rounds.forEach((round) => {
    Object.values(round.matches).forEach((match) => {
      const teamA = teamKeyLookup[teamKeyFromPlayers(match.teamA)];
      const teamB = teamKeyLookup[teamKeyFromPlayers(match.teamB)];
      if (!teamA || !teamB) return;
      if (!teamIdSet.has(teamA.id) || !teamIdSet.has(teamB.id)) return;

      const parsedScore = parseMatchScore(match.score ?? null);
      if (parsedScore) {
        const diffForTeamA = parsedScore.teamAScore - parsedScore.teamBScore;
        poolPointDifferential[teamA.id] += diffForTeamA;
        poolPointDifferential[teamB.id] -= diffForTeamA;
        addHeadToHeadPointDiff(teamA.id, teamB.id, diffForTeamA);
      }

      if (!match.winner) return;

      const winnerTeam = match.winner === 'A' ? teamA : teamB;
      const loserTeam = match.winner === 'A' ? teamB : teamA;

      standings[winnerTeam.id].wins += 1;
      standings[winnerTeam.id].matchesPlayed += 1;
      standings[loserTeam.id].losses += 1;
      standings[loserTeam.id].matchesPlayed += 1;
    });
  });

  const teamNameById = teams.reduce<Record<string, string>>((acc, team) => {
    acc[team.id] = team.name;
    return acc;
  }, {});

  const pointDiffWithinTiedGroup = (teamId: string, tiedTeamIds: string[]): number =>
    tiedTeamIds
      .filter((otherTeamId) => otherTeamId !== teamId)
      .reduce((sum, otherTeamId) => sum + (headToHeadPointDifferential[teamId][otherTeamId] ?? 0), 0);

  const pointDiffAgainstSpecificTeam = (teamId: string, opponentTeamId: string | null): number => {
    if (!opponentTeamId) return 0;
    return headToHeadPointDifferential[teamId][opponentTeamId] ?? 0;
  };

  const sortTieGroup = (teamIds: string[], nextHigherTeamId: string | null): string[] =>
    [...teamIds].sort((teamAId, teamBId) => {
      const headToHeadDiffA = pointDiffWithinTiedGroup(teamAId, teamIds);
      const headToHeadDiffB = pointDiffWithinTiedGroup(teamBId, teamIds);
      if (headToHeadDiffB !== headToHeadDiffA) return headToHeadDiffB - headToHeadDiffA;

      const poolDiffA = poolPointDifferential[teamAId] ?? 0;
      const poolDiffB = poolPointDifferential[teamBId] ?? 0;
      if (poolDiffB !== poolDiffA) return poolDiffB - poolDiffA;

      const vsNextHigherA = pointDiffAgainstSpecificTeam(teamAId, nextHigherTeamId);
      const vsNextHigherB = pointDiffAgainstSpecificTeam(teamBId, nextHigherTeamId);
      if (vsNextHigherB !== vsNextHigherA) return vsNextHigherB - vsNextHigherA;

      return (teamNameById[teamAId] ?? teamAId).localeCompare(teamNameById[teamBId] ?? teamBId);
    });

  const groupedByWins = Object.values(standings).reduce<Record<number, string[]>>((acc, entry) => {
    if (!acc[entry.wins]) acc[entry.wins] = [];
    acc[entry.wins].push(entry.teamId);
    return acc;
  }, {});

  const orderedWins = Object.keys(groupedByWins)
    .map(Number)
    .sort((a, b) => b - a);

  const rankedTeamIds: string[] = [];
  orderedWins.forEach((wins) => {
    const tiedTeamIds = groupedByWins[wins];
    const nextHigherTeamId = rankedTeamIds.length > 0 ? rankedTeamIds[rankedTeamIds.length - 1] : null;
    const sortedGroup = sortTieGroup(tiedTeamIds, nextHigherTeamId);
    rankedTeamIds.push(...sortedGroup);
  });

  return rankedTeamIds.map((teamId) => standings[teamId]).filter(Boolean);
}

function buildKnockoutRounds(
  rankedTeams: DuprTeam[],
  knockoutSize: 4 | 8,
  startingRoundId: number,
): Round[] {
  const selected = rankedTeams.slice(0, knockoutSize);
  if (selected.length < knockoutSize) {
    throw new Error(`Need at least ${knockoutSize} ranked teams for knockout.`);
  }

  const teamPlayers = (team: DuprTeam) => [team.players[0].id, team.players[1].id];
  const rounds: Round[] = [];

  if (knockoutSize === 8) {
    const quarterFinalMatches: Match[] = [
      makeMatch('QF-1', teamPlayers(selected[0]), teamPlayers(selected[7])),
      makeMatch('QF-2', teamPlayers(selected[3]), teamPlayers(selected[4])),
      makeMatch('QF-3', teamPlayers(selected[1]), teamPlayers(selected[6])),
      makeMatch('QF-4', teamPlayers(selected[2]), teamPlayers(selected[5])),
    ];
    rounds.push(buildRound(quarterFinalMatches, startingRoundId));

    rounds.push(
      buildRound(
        [
          makeMatch('SF-1', [], []),
          makeMatch('SF-2', [], []),
        ],
        startingRoundId + 1,
      ),
    );
  } else {
    const semiFinalMatches: Match[] = [
      makeMatch('SF-1', teamPlayers(selected[0]), teamPlayers(selected[3])),
      makeMatch('SF-2', teamPlayers(selected[1]), teamPlayers(selected[2])),
    ];
    rounds.push(buildRound(semiFinalMatches, startingRoundId));
  }

  rounds.push(buildRound([makeMatch('F-1', [], [])], startingRoundId + rounds.length));
  return rounds;
}

function hydrateKnockoutRounds(rounds: Round[]): Round[] {
  const next = rounds.map((round) => ({
    ...round,
    matches: Object.fromEntries(
      Object.entries(round.matches).map(([courtId, match]) => [courtId, { ...match }]),
    ),
  }));

  if (next.length === 3) {
    // QF -> SF -> F
    const qf = next[0];
    const sf = next[1];
    const f = next[2];

    const qfWinners = Object.values(qf.matches).map(getWinnerTeamPlayers);
    const sfMatches = Object.values(sf.matches);
    if (sfMatches[0]) {
      sfMatches[0].teamA = qfWinners[0] ?? [];
      sfMatches[0].teamB = qfWinners[1] ?? [];
    }
    if (sfMatches[1]) {
      sfMatches[1].teamA = qfWinners[2] ?? [];
      sfMatches[1].teamB = qfWinners[3] ?? [];
    }

    const sfWinners = sfMatches.map(getWinnerTeamPlayers);
    const final = Object.values(f.matches)[0];
    if (final) {
      final.teamA = sfWinners[0] ?? [];
      final.teamB = sfWinners[1] ?? [];
    }

    return next;
  }

  if (next.length === 2) {
    // SF -> F
    const sf = next[0];
    const f = next[1];
    const sfWinners = Object.values(sf.matches).map(getWinnerTeamPlayers);
    const final = Object.values(f.matches)[0];
    if (final) {
      final.teamA = sfWinners[0] ?? [];
      final.teamB = sfWinners[1] ?? [];
    }
  }

  return next;
}

export function createFixedPartnerTeams(players: Player[]): DuprTeam[] {
  if (players.length < 8) {
    throw new Error('DUPR mode needs at least 8 players (4 teams).');
  }
  if (players.length % 2 !== 0) {
    throw new Error('DUPR mode requires an even number of players for fixed partners.');
  }

  const teams: DuprTeam[] = [];
  for (let i = 0; i < players.length; i += 2) {
    const first = players[i];
    const second = players[i + 1];
    const seed = i / 2 + 1;
    teams.push({
      id: `TEAM-${seed}`,
      name: `${first.name} / ${second.name}`,
      players: [first, second],
      seed,
    });
  }
  return teams;
}

export function initializeDuprTournament(
  players: Player[],
  options?: DuprTournamentOptions,
): DuprTournamentState {
  const teams = createFixedPartnerTeams(players);
  if (teams.length < 4) {
    throw new Error('DUPR mode needs at least 4 teams.');
  }
  if (teams.length % 2 !== 0) {
    throw new Error('DUPR mode currently supports an even number of teams.');
  }

  const roundRobinRounds = options?.roundRobinRounds ?? 4;
  const defaultKnockoutSize: 4 | 8 = teams.length >= 8 ? 8 : 4;
  const knockoutSize = options?.knockoutSize ?? defaultKnockoutSize;

  if (knockoutSize > teams.length) {
    throw new Error(`Knockout size ${knockoutSize} is larger than available teams ${teams.length}.`);
  }

  const rounds = buildRoundRobinRounds(teams, roundRobinRounds);

  return {
    mode: gameMode.DUPR,
    teams,
    roundRobinRounds,
    knockoutSize,
    phase: 'ROUND_ROBIN',
    rounds,
    currentRoundNumber: 0,
  };
}

export function applyMatchWinner(
  state: DuprTournamentState,
  roundIndex: number,
  matchIdentifier: string,
  winner: Winner,
  score?: string | null,
): DuprTournamentState {
  const rounds = state.rounds.map((round, index) => {
    if (index !== roundIndex) return round;
    const direct = round.matches[matchIdentifier];
    const key = direct
      ? matchIdentifier
      : Object.keys(round.matches).find((candidate) => round.matches[candidate].id === matchIdentifier);
    if (!key) return round;
    const match = round.matches[key];
    if (!match) return round;
    return {
      ...round,
      matches: {
        ...round.matches,
        [key]: {
          ...match,
          winner,
          score: score ?? match.score ?? null,
        },
      },
    };
  });

  let nextState: DuprTournamentState = {
    ...state,
    rounds,
  };

  if (state.phase === 'KNOCKOUT') {
    const knockoutRounds = rounds.slice(state.roundRobinRounds);
    const hydrated = hydrateKnockoutRounds(knockoutRounds);
    nextState = {
      ...nextState,
      rounds: [...rounds.slice(0, state.roundRobinRounds), ...hydrated],
    };
  }

  return nextState;
}

export function getDuprStandings(state: DuprTournamentState): DuprTeamStanding[] {
  const rrRounds = state.rounds.slice(0, state.roundRobinRounds);
  return mapRoundResultsToStandings(state.teams, rrRounds);
}

export function getDuprFinalLeaderboard(state: DuprTournamentState): DuprTeamStanding[] {
  const base = getDuprStandings(state);
  if (state.phase !== 'COMPLETED' || state.rounds.length === 0) return base;

  const finalRound = state.rounds[state.rounds.length - 1];
  const finalMatch = finalRound ? Object.values(finalRound.matches)[0] : null;
  if (!finalMatch || !finalMatch.winner) return base;

  const championPlayers = finalMatch.winner === 'A' ? finalMatch.teamA : finalMatch.teamB;
  if (championPlayers.length === 0) return base;

  const teamLookup = createTeamKeyLookup(state.teams);
  const championTeam = teamLookup[teamKeyFromPlayers(championPlayers)];
  if (!championTeam) return base;

  const championIndex = base.findIndex((entry) => entry.teamId === championTeam.id);
  if (championIndex <= 0) return base;

  const reordered = [...base];
  const [champion] = reordered.splice(championIndex, 1);
  reordered.unshift(champion);
  return reordered;
}

export function maybeAdvanceDuprPhase(state: DuprTournamentState): DuprTournamentState {
  if (state.phase === 'ROUND_ROBIN') {
    const rrRounds = state.rounds.slice(0, state.roundRobinRounds);
    const rrComplete = rrRounds.every(isRoundComplete);
    if (!rrComplete) return state;

    const standings = getDuprStandings(state);
    const teamLookup = toTeamLookup(state.teams);
    const rankedTeams = standings.map((standing) => teamLookup[standing.teamId]).filter(Boolean);
    const knockoutRounds = buildKnockoutRounds(
      rankedTeams,
      state.knockoutSize,
      state.roundRobinRounds,
    );

    return {
      ...state,
      phase: 'KNOCKOUT',
      rounds: [...rrRounds, ...knockoutRounds],
      currentRoundNumber: state.roundRobinRounds,
    };
  }

  if (state.phase === 'KNOCKOUT') {
    const knockoutRounds = state.rounds.slice(state.roundRobinRounds);
    const allDone = knockoutRounds.every(isRoundComplete);
    if (!allDone) return state;

    return {
      ...state,
      phase: 'COMPLETED',
    };
  }

  return state;
}

export class DuprTournament implements TournamentType {
  mode: gameMode = gameMode.DUPR;
  date_created: Date = new Date();
  status: tournamentStatus = tournamentStatus.SETUP;
  courtOrder: number[] = [1, 2, 3, 4];
  leaderboard: Record<number, Player> = {};
  players: Player[] | null = null;
  rounds: Round[] = [];
  waitList: Player[] | null = [];
  currentRoundNumber = 0;

  private state: DuprTournamentState | null = null;

  constructor(players: Player[], options?: DuprTournamentOptions) {
    this.players = players;
    this.state = initializeDuprTournament(players, options);
    this.rounds = this.state.rounds;
    this.status = tournamentStatus.IN_PROGRESS;
  }

  getNextRound(): Round | null {
    if (!this.state) return null;

    const advanced = maybeAdvanceDuprPhase(this.state);
    this.state = advanced;
    this.rounds = advanced.rounds;

    if (advanced.phase === 'COMPLETED') {
      this.status = tournamentStatus.COMPLETED;
      return null;
    }

    const round = advanced.rounds[this.currentRoundNumber] ?? null;
    if (!round) return null;

    if (isRoundComplete(round)) {
      this.currentRoundNumber += 1;
      return advanced.rounds[this.currentRoundNumber] ?? null;
    }

    return round;
  }

  getLastRound(): Round | null {
    if (!this.state) return null;
    if (this.currentRoundNumber <= 0) {
      return this.rounds[0] ?? null;
    }
    this.currentRoundNumber -= 1;
    return this.rounds[this.currentRoundNumber] ?? null;
  }

  recordWinner(roundIndex: number, courtId: string, winner: Winner) {
    if (!this.state) return;
    this.state = applyMatchWinner(this.state, roundIndex, courtId, winner);
    this.rounds = this.state.rounds;
  }

  getStandings(): DuprTeamStanding[] {
    if (!this.state) return [];
    return getDuprStandings(this.state);
  }

  save(): void {
    // no-op: wire with persistence later
  }

  load(): TournamentType {
    return this;
  }
}
