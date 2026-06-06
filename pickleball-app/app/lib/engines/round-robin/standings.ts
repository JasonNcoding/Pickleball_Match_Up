import type { Player, Round, Match, LeaderboardEntry } from '@/app/lib/definitions';

export interface RRStandingsEntry extends LeaderboardEntry {
  losses: number;
  pointDiff: number;
  pointsFor: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPlayerMatches(playerId: string, history: Round[]): Match[] {
  const result: Match[] = [];
  history.forEach(round =>
    Object.values(round.matches).forEach(m => {
      if (m.teamA.includes(playerId) || m.teamB.includes(playerId)) result.push(m);
    }),
  );
  return result;
}

function countWins(playerId: string, matches: Match[]): number {
  return matches.filter(m => {
    if (!m.winner) return false;
    return (m.winner === 'A' ? m.teamA : m.teamB).includes(playerId);
  }).length;
}

function countLosses(playerId: string, matches: Match[]): number {
  return matches.filter(m => {
    if (!m.winner) return false;
    return (m.winner === 'A' ? m.teamB : m.teamA).includes(playerId);
  }).length;
}

function calcPointDiff(playerId: string, matches: Match[]): number {
  let diff = 0;
  matches.forEach(m => {
    if (m.scoreA === undefined || m.scoreB === undefined) return;
    if (m.teamA.includes(playerId)) diff += m.scoreA - m.scoreB;
    else if (m.teamB.includes(playerId)) diff += m.scoreB - m.scoreA;
  });
  return diff;
}

function calcPointsFor(playerId: string, matches: Match[]): number {
  let pts = 0;
  matches.forEach(m => {
    if (m.teamA.includes(playerId) && m.scoreA !== undefined) pts += m.scoreA;
    else if (m.teamB.includes(playerId) && m.scoreB !== undefined) pts += m.scoreB;
  });
  return pts;
}

/** Direct H2H win delta: positive = p1 leads vs p2. */
function h2hWinDelta(p1: string, p2: string, history: Round[]): number {
  let p1w = 0, p2w = 0;
  history.forEach(round =>
    Object.values(round.matches).forEach(m => {
      if (!m.winner) return;
      const p1A = m.teamA.includes(p1) && m.teamB.includes(p2);
      const p1B = m.teamB.includes(p1) && m.teamA.includes(p2);
      if (!p1A && !p1B) return;
      const win = (m.winner === 'A' ? m.teamA : m.teamB);
      if (win.includes(p1)) p1w++;
      else p2w++;
    }),
  );
  return p1w - p2w;
}

/** H2H point diff for p1 vs p2: positive = p1 has better diff. */
function h2hPointDelta(p1: string, p2: string, history: Round[]): number {
  let diff = 0;
  history.forEach(round =>
    Object.values(round.matches).forEach(m => {
      if (m.scoreA === undefined || m.scoreB === undefined) return;
      if (m.teamA.includes(p1) && m.teamB.includes(p2)) diff += m.scoreA - m.scoreB;
      else if (m.teamB.includes(p1) && m.teamA.includes(p2)) diff += m.scoreB - m.scoreA;
    }),
  );
  return diff;
}

/** Point diff for p1 specifically against a given opponent. */
function pointDiffVs(p1: string, opponentId: string, history: Round[]): number {
  let diff = 0;
  history.forEach(round =>
    Object.values(round.matches).forEach(m => {
      if (m.scoreA === undefined || m.scoreB === undefined) return;
      if (m.teamA.includes(p1) && m.teamB.includes(opponentId)) diff += m.scoreA - m.scoreB;
      else if (m.teamB.includes(p1) && m.teamA.includes(opponentId)) diff += m.scoreB - m.scoreA;
    }),
  );
  return diff;
}

// ── defaultTieBreak for a tied group ──────────────────────────────────────────

/**
 * USA Pickleball official tiebreak order (applied within a group tied on wins):
 * 1. Match Wins (already equal — group is pre-filtered)
 * 2. Head-to-Head (mini-standings within group for >2; direct for 2)
 * 3. Point Differential (all matches)
 * 4. H2H Point Differential (within the tied group)
 * 5. Point Diff vs Next-Higher Team (handled as post-pass in the main function)
 * 6. Total Points Scored
 */
function defaultTieBreak(
  group: RRStandingsEntry[],
  history: Round[],
  withScores: boolean,
): RRStandingsEntry[] {
  if (group.length <= 1) return group;

  if (group.length === 2) {
    const [a, b] = group;

    // Criterion 2: H2H
    const h2h = h2hWinDelta(a.id, b.id, history);
    if (h2h !== 0) return h2h > 0 ? [a, b] : [b, a];

    // Criterion 3: Point Differential
    if (withScores && a.pointDiff !== b.pointDiff)
      return a.pointDiff > b.pointDiff ? [a, b] : [b, a];

    // Criterion 4: H2H Point Differential
    if (withScores) {
      const hpd = h2hPointDelta(a.id, b.id, history);
      if (hpd !== 0) return hpd > 0 ? [a, b] : [b, a];
    }

    // Criterion 5 is applied as a post-pass in the caller.

    // Criterion 6: Total Points Scored
    if (withScores && a.pointsFor !== b.pointsFor)
      return a.pointsFor > b.pointsFor ? [a, b] : [b, a];

    // Alphabetical fallback
    return a.name.localeCompare(b.name) <= 0 ? [a, b] : [b, a];
  }

  // >2 tied: Criterion 2 → compute H2H mini-standings within the group.
  const ids = group.map(e => e.id);
  const h2hWins = new Map<string, number>(ids.map(id => [id, 0]));

  history.forEach(round =>
    Object.values(round.matches).forEach(m => {
      if (!m.winner) return;
      const winTeam = m.winner === 'A' ? m.teamA : m.teamB;
      const loseTeam = m.winner === 'A' ? m.teamB : m.teamA;
      const wInGroup = winTeam.filter(id => ids.includes(id));
      const lInGroup = loseTeam.filter(id => ids.includes(id));
      if (wInGroup.length === 0 || lInGroup.length === 0) return;
      wInGroup.forEach(id => h2hWins.set(id, (h2hWins.get(id) ?? 0) + 1));
    }),
  );

  return [...group].sort((a, b) => {
    const aH = h2hWins.get(a.id) ?? 0;
    const bH = h2hWins.get(b.id) ?? 0;
    if (aH !== bH) return bH - aH;

    // Criterion 3
    if (withScores && a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff;

    // Criterion 4 (simplified within group — skip cross-group H2H for >2)

    // Criterion 6
    if (withScores && a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;

    return a.name.localeCompare(b.name);
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export function calculateRoundRobinStandings(
  players: Player[],
  history: Round[],
  withScores = false,
): RRStandingsEntry[] {
  // Build base stats for each player.
  const entries: RRStandingsEntry[] = players.map(p => {
    const matches = getPlayerMatches(p.id, history);
    return {
      id: p.id,
      name: p.name,
      winCount: countWins(p.id, matches),
      losses: countLosses(p.id, matches),
      pointDiff: calcPointDiff(p.id, matches),
      pointsFor: calcPointsFor(p.id, matches),
    };
  });

  // Sort by wins DESC, then apply defaultTieBreak within tied groups.
  entries.sort((a, b) => b.winCount - a.winCount);

  const result: RRStandingsEntry[] = [];
  let i = 0;
  while (i < entries.length) {
    let j = i + 1;
    while (j < entries.length && entries[j].winCount === entries[i].winCount) j++;
    const group = entries.slice(i, j);
    result.push(...defaultTieBreak(group, history, withScores));
    i = j;
  }

  // Criterion 5 post-pass: for adjacent tied entries, sort by point diff vs
  // the team ranked directly above the tied group.
  if (withScores) {
    let k = 0;
    while (k < result.length) {
      // Find extent of a tied-wins group.
      let end = k + 1;
      while (end < result.length && result[end].winCount === result[k].winCount) end++;

      if (end - k >= 2 && k > 0) {
        const nextHigherId = result[k - 1].id;
        const group = result.slice(k, end);
        // Sort by point diff vs next-higher; stable for already-sorted sub-groups.
        group.sort((a, b) =>
          pointDiffVs(b.id, nextHigherId, history) - pointDiffVs(a.id, nextHigherId, history),
        );
        result.splice(k, end - k, ...group);
      }

      k = end;
    }
  }

  return result;
}
