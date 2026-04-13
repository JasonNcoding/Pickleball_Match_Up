import type { Player } from '@/app/lib/definitions';
import type { GroupsKnockoutTeam } from './types';

export function createTeams(players: Player[]): GroupsKnockoutTeam[] {
  if (players.length < 8) {
    throw new Error('Group Knockout mode needs at least 8 players (4 teams).');
  }
  if (players.length % 2 !== 0) {
    throw new Error('Group Knockout mode requires an even number of players for fixed partners.');
  }

  const teams: GroupsKnockoutTeam[] = [];
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
