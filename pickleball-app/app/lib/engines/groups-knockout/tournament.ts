import type { Player } from '@/app/lib/definitions';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import type { GroupsKnockoutOptions, GroupsKnockoutState, GroupsKnockoutTeamStanding } from './types';
import { createTeams } from './teams';
import { buildRoundRobinRounds, createTeamKeyLookup, isRoundComplete, mapRoundResultsToStandings } from './round-robin';
import { buildKnockoutRounds, hydrateKnockoutRounds } from './knockout';

type Winner = 'A' | 'B';

function teamKeyFromPlayers(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
}

export function initialize(players: Player[], options?: GroupsKnockoutOptions): GroupsKnockoutState {
  const teams = createTeams(players);
  if (teams.length < 4) throw new Error('Group Knockout mode needs at least 4 teams.');
  if (teams.length % 2 !== 0) throw new Error('Group Knockout mode currently supports an even number of teams.');

  const roundRobinRounds = options?.roundRobinRounds ?? 4;
  const defaultKnockoutSize: 4 | 8 = teams.length >= 8 ? 8 : 4;
  const knockoutSize = options?.knockoutSize ?? defaultKnockoutSize;

  if (knockoutSize > teams.length) {
    throw new Error(`Knockout size ${knockoutSize} is larger than available teams ${teams.length}.`);
  }

  const rounds = buildRoundRobinRounds(teams, roundRobinRounds);
  return { mode: gameMode.GROUP_KNOCKOUT, teams, roundRobinRounds, knockoutSize, phase: 'ROUND_ROBIN', rounds, currentRoundNumber: 0 };
}

export function applyResult(
  state: GroupsKnockoutState,
  roundIndex: number,
  matchIdentifier: string,
  winner: Winner,
  score?: string | null,
): GroupsKnockoutState {
  const rounds = state.rounds.map((round, index) => {
    if (index !== roundIndex) return round;
    const directKey = round.matches[matchIdentifier] ? matchIdentifier : Object.keys(round.matches).find((k) => round.matches[k].id === matchIdentifier);
    if (!directKey) return round;
    const match = round.matches[directKey];
    if (!match) return round;
    return { ...round, matches: { ...round.matches, [directKey]: { ...match, winner, score: score ?? match.score ?? null } } };
  });

  let next: GroupsKnockoutState = { ...state, rounds };

  if (state.phase === 'KNOCKOUT') {
    const rrRounds = rounds.slice(0, state.roundRobinRounds);
    const knockoutRounds = hydrateKnockoutRounds(rounds.slice(state.roundRobinRounds));
    next = { ...next, rounds: [...rrRounds, ...knockoutRounds] };
  }

  return next;
}

export function getStandings(state: GroupsKnockoutState): GroupsKnockoutTeamStanding[] {
  const rrRounds = state.rounds.slice(0, state.roundRobinRounds);
  return mapRoundResultsToStandings(state.teams, rrRounds);
}

export function getFinalLeaderboard(state: GroupsKnockoutState): GroupsKnockoutTeamStanding[] {
  const base = getStandings(state);
  if (state.phase !== 'COMPLETED' || state.rounds.length === 0) return base;

  const finalRound = state.rounds[state.rounds.length - 1];
  const finalMatch = finalRound ? Object.values(finalRound.matches)[0] : null;
  if (!finalMatch?.winner) return base;

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

export function advancePhase(state: GroupsKnockoutState): GroupsKnockoutState {
  if (state.phase === 'ROUND_ROBIN') {
    const rrRounds = state.rounds.slice(0, state.roundRobinRounds);
    if (!rrRounds.every(isRoundComplete)) return state;

    const standings = getStandings(state);
    const teamLookup = state.teams.reduce<Record<string, (typeof state.teams)[number]>>((acc, t) => { acc[t.id] = t; return acc; }, {});
    const rankedTeams = standings.map((s) => teamLookup[s.teamId]).filter(Boolean);
    const knockoutRounds = buildKnockoutRounds(rankedTeams, state.knockoutSize, state.roundRobinRounds);

    return { ...state, phase: 'KNOCKOUT', rounds: [...rrRounds, ...knockoutRounds], currentRoundNumber: state.roundRobinRounds };
  }

  if (state.phase === 'KNOCKOUT') {
    const knockoutRounds = state.rounds.slice(state.roundRobinRounds);
    if (knockoutRounds.every(isRoundComplete)) {
      return { ...state, phase: 'COMPLETED' };
    }
  }

  return state;
}
