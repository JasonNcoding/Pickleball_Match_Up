import type { Player, Match, PreAssignment, RatingOrder } from '@/app/lib/definitions';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function autoFillByRating(
  players: Player[],
  courts: string[],
  order: RatingOrder,
  teamSize: 1 | 2 = 2,
): PreAssignment {
  const ppc = teamSize * 2; // players per court
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const needed = courts.length * ppc;
  const playing = sorted.slice(0, needed);
  const bench = sorted.slice(needed).map(p => p.id);

  const groups: { teamA: string[]; teamB: string[]; avgRating: number }[] = [];
  for (let i = 0; i < playing.length; i += ppc) {
    const g = playing.slice(i, i + ppc);
    if (g.length < ppc) break;
    const avgRating = g.reduce((s, p) => s + p.rating, 0) / ppc;
    if (teamSize === 1) {
      groups.push({ teamA: [g[0].id], teamB: [g[1].id], avgRating });
    } else {
      groups.push({ teamA: [g[0].id, g[3].id], teamB: [g[1].id, g[2].id], avgRating });
    }
  }

  // Sort groups by average rating for court assignment
  const sortedGroups = [...groups].sort((a, b) =>
    order === 'highToTop' ? b.avgRating - a.avgRating : a.avgRating - b.avgRating,
  );

  const courtMatches: Record<string, Match> = {};
  courts.forEach((cId, i) => {
    const g = sortedGroups[i];
    if (!g) return;
    courtMatches[cId] = { teamA: g.teamA, teamB: g.teamB, winner: null };
  });

  return { courts: courtMatches, bench };
}

// Keep same partner pairs, shuffle which court each pair-vs-pair is assigned to
export function shuffleTeams(pre: PreAssignment): PreAssignment {
  const courtIds = Object.keys(pre.courts);
  const matches = shuffle(Object.values(pre.courts));
  const newCourts: Record<string, Match> = {};
  courtIds.forEach((cId, i) => {
    newCourts[cId] = { ...matches[i], winner: null };
  });
  return { courts: newCourts, bench: pre.bench };
}

// Scatter all individuals randomly across court slots — may change partners
export function shufflePlayers(players: Player[], courts: string[], teamSize: 1 | 2 = 2): PreAssignment {
  const ppc = teamSize * 2;
  const needed = courts.length * ppc;
  const shuffled = shuffle(players.map(p => p.id));
  const playing = shuffled.slice(0, needed);
  const bench = shuffled.slice(needed);

  const courtMatches: Record<string, Match> = {};
  courts.forEach((cId, i) => {
    const base = i * ppc;
    courtMatches[cId] = teamSize === 1
      ? { teamA: [playing[base]], teamB: [playing[base + 1]], winner: null }
      : { teamA: [playing[base], playing[base + 1]], teamB: [playing[base + 2], playing[base + 3]], winner: null };
  });

  return { courts: courtMatches, bench };
}
