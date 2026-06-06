import type { Player, Round, Match } from '@/app/lib/definitions';
import type { PairingOutput } from '@/app/lib/engines/types';

export interface RoundRobinPairingInput {
  roster: Player[];
  courts: string[];
  history: Round[];
  legs: number;       // how many times each pair is allowed to meet
  fixedPartners?: Record<string, string>; // playerId → partnerId; keeps pairs across rounds
  teamSize?: 1 | 2;
}

function getPairMeetingCount(p1: string, p2: string, history: Round[]): number {
  let count = 0;
  history.forEach(round => {
    Object.values(round.matches).forEach(m => {
      const inA = m.teamA.includes(p1) && m.teamA.includes(p2);
      const inB = m.teamB.includes(p1) && m.teamB.includes(p2);
      const opposed = (m.teamA.includes(p1) && m.teamB.includes(p2)) ||
                      (m.teamB.includes(p1) && m.teamA.includes(p2));
      if (inA || inB || opposed) count++;
    });
  });
  return count;
}

function getWins(playerId: string, history: Round[]): number {
  let wins = 0;
  history.forEach(round => {
    Object.values(round.matches).forEach(m => {
      if (!m.winner) return;
      const winTeam = m.winner === 'A' ? m.teamA : m.teamB;
      if (winTeam.includes(playerId)) wins++;
    });
  });
  return wins;
}

function getTeamWins(team: string[], history: Round[]): number {
  let wins = 0;
  history.forEach(round => {
    Object.values(round.matches).forEach(m => {
      if (!m.winner) return;
      const winTeam = m.winner === 'A' ? m.teamA : m.teamB;
      if (team.every(id => winTeam.includes(id))) wins++;
    });
  });
  return wins;
}

function getTeamMeetings(teamA: string[], teamB: string[], history: Round[]): number {
  let count = 0;
  history.forEach(round => {
    Object.values(round.matches).forEach(m => {
      const aVsB = teamA.every(id => m.teamA.includes(id)) && teamB.every(id => m.teamB.includes(id));
      const bVsA = teamB.every(id => m.teamA.includes(id)) && teamA.every(id => m.teamB.includes(id));
      if (aVsB || bVsA) count++;
    });
  });
  return count;
}

function generateFixedTeamPairings(
  roster: Player[],
  courts: string[],
  history: Round[],
  fixedPartners: Record<string, string>,
): PairingOutput {
  // Build canonical teams (each unique partner pair)
  const seen = new Set<string>();
  const teams: string[][] = [];
  for (const player of roster) {
    const partner = fixedPartners[player.id];
    if (!partner) continue;
    const key = [player.id, partner].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    teams.push([player.id, partner]);
  }

  // Sort teams by wins DESC for standing-based court priority
  const sortedTeams = [...teams].sort((a, b) => getTeamWins(b, history) - getTeamWins(a, history));

  const used = new Set<number>();
  const newMatches: Record<string, Match> = {};

  for (let courtIdx = 0; courtIdx < courts.length; courtIdx++) {
    const remaining = sortedTeams
      .map((team, idx) => ({ team, idx }))
      .filter(({ idx }) => !used.has(idx));
    if (remaining.length < 2) break;

    const anchor = remaining[0];
    used.add(anchor.idx);

    // Pick opponent with fewest prior meetings against anchor
    const best = remaining.slice(1).reduce((prev, curr) =>
      getTeamMeetings(anchor.team, curr.team, history) < getTeamMeetings(anchor.team, prev.team, history)
        ? curr
        : prev,
    );
    used.add(best.idx);

    newMatches[courts[courtIdx]] = { teamA: anchor.team, teamB: best.team, winner: null };
  }

  const newWaiting = sortedTeams.filter((_, i) => !used.has(i)).flat();
  return { newMatches, newWaiting };
}

export function generateRoundRobinPairings(input: RoundRobinPairingInput): PairingOutput {
  const { roster, courts, history, legs, fixedPartners, teamSize = 2 } = input;

  // fixedPartners only applies to doubles
  if (fixedPartners && teamSize === 2) {
    return generateFixedTeamPairings(roster, courts, history, fixedPartners);
  }

  const ppc = teamSize * 2; // players per court (2 for singles, 4 for doubles)

  // Sort by wins DESC, then rating ASC as tiebreaker (standing-based seeding)
  const sorted = [...roster].sort((a, b) => {
    const wDiff = getWins(b.id, history) - getWins(a.id, history);
    if (wDiff !== 0) return wDiff;
    return a.rating - b.rating;
  });

  // Greedily assign groups to each court
  const used = new Set<string>();
  const groups: string[][] = [];

  for (let i = 0; i < courts.length; i++) {
    const available = sorted.filter(p => !used.has(p.id));
    if (available.length < ppc) break;

    const anchor = available[0];
    used.add(anchor.id);

    const candidates = available.slice(1).map(p => ({
      p,
      score: getPairMeetingCount(anchor.id, p.id, history),
    })).sort((a, b) => a.score - b.score);

    const group = [anchor.id];
    for (const { p } of candidates) {
      if (group.length === ppc) break;
      const maxMet = Math.max(...group.map(gId => getPairMeetingCount(gId, p.id, history)));
      if (maxMet < legs) {
        group.push(p.id);
        used.add(p.id);
      }
    }

    // Fallback: fill with least-met players if leg limit not met
    if (group.length < ppc) {
      for (const { p } of candidates) {
        if (group.length === ppc) break;
        if (!group.includes(p.id)) {
          group.push(p.id);
          used.add(p.id);
        }
      }
    }

    groups.push(group);
  }

  const newMatches: Record<string, Match> = {};
  courts.forEach((cId, i) => {
    const p = groups[i] || [];
    if (p.length < ppc) return;
    if (teamSize === 1) {
      newMatches[cId] = { teamA: [p[0]], teamB: [p[1]], winner: null };
    } else {
      newMatches[cId] = { teamA: [p[0], p[3]], teamB: [p[1], p[2]], winner: null };
    }
  });

  const newWaiting = sorted.filter(p => !used.has(p.id)).map(p => p.id);

  return { newMatches, newWaiting };
}

export function isTournamentComplete(
  history: Round[],
  legs: number,
): boolean {
  return history.length >= legs;
}
