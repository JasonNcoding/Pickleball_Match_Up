import type { Player, Match } from '@/app/lib/definitions';

export interface BracketRound {
  newMatches: Record<string, Match>;
  activeCourts: string[]; // subset of courts being used this bracket round
}

export function generateBracket(
  activePlayers: Player[],
  allCourts: string[], // ordered (used to pick courts for this round)
  fixedPartners?: Record<string, string>,
  teamSize: 1 | 2 = 2,
  preSeeded = false, // if true, skip internal rating sort (use array order as seeds)
): BracketRound {
  if (fixedPartners && teamSize === 2) {
    return generateFixedTeamBracket(activePlayers, allCourts, fixedPartners, preSeeded);
  }

  const ppc = teamSize * 2; // players per court
  const seeds = preSeeded ? [...activePlayers] : [...activePlayers].sort((a, b) => b.rating - a.rating);
  const courtCount = Math.floor(seeds.length / ppc);
  const courts = allCourts.slice(0, courtCount);

  const newMatches: Record<string, Match> = {};
  courts.forEach((cId, i) => {
    const base = i * ppc;
    if (teamSize === 1) {
      newMatches[cId] = {
        teamA: [seeds[base].id],
        teamB: [seeds[base + 1].id],
        winner: null,
      };
    } else {
      newMatches[cId] = {
        teamA: [seeds[base].id, seeds[base + 3].id],
        teamB: [seeds[base + 1].id, seeds[base + 2].id],
        winner: null,
      };
    }
  });

  return { newMatches, activeCourts: courts };
}

function generateFixedTeamBracket(
  activePlayers: Player[],
  allCourts: string[],
  fixedPartners: Record<string, string>,
  preSeeded = false, // if true, use array order instead of rating sort
): BracketRound {
  // Build canonical teams from surviving players (preserve input order when preSeeded)
  const seen = new Set<string>();
  const teams: Player[][] = [];
  for (const player of activePlayers) {
    const partnerId = fixedPartners[player.id];
    if (!partnerId) continue;
    const key = [player.id, partnerId].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const partner = activePlayers.find(p => p.id === partnerId);
    if (partner) teams.push([player, partner]);
  }

  // Seed teams: by average rating descending (normal) or preserve input order (preSeeded)
  const sorted = preSeeded ? teams : [...teams].sort((a, b) => {
    const avgA = (a[0].rating + a[1].rating) / 2;
    const avgB = (b[0].rating + b[1].rating) / 2;
    return avgB - avgA;
  });

  // Pair: team[0] vs team[last], team[1] vs team[last-1], etc. (bracket seeding)
  const courtCount = Math.floor(sorted.length / 2);
  const courts = allCourts.slice(0, courtCount);
  const newMatches: Record<string, Match> = {};
  courts.forEach((cId, i) => {
    const top = sorted[i];
    const bottom = sorted[sorted.length - 1 - i];
    if (!top || !bottom || top === bottom) return;
    newMatches[cId] = {
      teamA: top.map(p => p.id),
      teamB: bottom.map(p => p.id),
      winner: null,
    };
  });

  return { newMatches, activeCourts: courts };
}
