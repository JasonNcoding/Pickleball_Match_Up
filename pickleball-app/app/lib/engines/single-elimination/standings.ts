import type { Player, Round } from '@/app/lib/definitions';

export interface KOLeaderboardEntry {
  /** Representative player ID (first member of the team). */
  id: string;
  /** Display label: player name (singles) or "A & B" (doubles). */
  teamLabel: string;
  wins: number;
  eliminated: boolean;
}

function teamWins(teamIds: string[], history: Round[]): number {
  let w = 0;
  history.forEach(round =>
    Object.values(round.matches).forEach(m => {
      if (!m.winner) return;
      const winTeam = m.winner === 'A' ? m.teamA : m.teamB;
      if (teamIds.every(id => winTeam.includes(id))) w++;
    }),
  );
  return w;
}

export function getKnockoutLeaderboard(
  players: Player[],
  history: Round[],
  eliminatedPlayerIds: string[],
  fixedPartners?: Record<string, string>,
): KOLeaderboardEntry[] {
  const seen = new Set<string>();
  const entries: KOLeaderboardEntry[] = [];

  for (const p of players) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);

    let teamIds: string[];
    let teamLabel: string;

    const partnerId = fixedPartners?.[p.id];
    if (partnerId && players.find(pl => pl.id === partnerId)) {
      seen.add(partnerId);
      teamIds = [p.id, partnerId];
      const partnerName = players.find(pl => pl.id === partnerId)?.name ?? partnerId;
      teamLabel = `${p.name} & ${partnerName}`;
    } else {
      teamIds = [p.id];
      teamLabel = p.name;
    }

    const eliminated = teamIds.some(id => eliminatedPlayerIds.includes(id));
    entries.push({
      id: p.id,
      teamLabel,
      wins: teamWins(teamIds, history),
      eliminated,
    });
  }

  const compare = (a: KOLeaderboardEntry, b: KOLeaderboardEntry) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamLabel.localeCompare(b.teamLabel);
  };

  const active = entries.filter(e => !e.eliminated).sort(compare);
  const eliminated = entries.filter(e => e.eliminated).sort(compare);
  return [...active, ...eliminated];
}
