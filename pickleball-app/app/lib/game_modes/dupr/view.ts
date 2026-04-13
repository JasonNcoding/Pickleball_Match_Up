import type { GroupsKnockoutState } from '@/app/lib/engines/groups-knockout';

export function formatDuprPhaseLabel(state: GroupsKnockoutState | null): string {
  if (!state) return 'Group Knockout';
  if (state.phase === 'COMPLETED') return 'Group Knockout — Completed';
  if (state.phase === 'ROUND_ROBIN') return `Group Knockout — Round Robin ${state.currentRoundNumber + 1}`;

  const knockoutRoundIndex = Math.max(0, state.currentRoundNumber - state.roundRobinRounds);
  const knockoutRoundCount = Math.max(1, state.rounds.length - state.roundRobinRounds);
  const knockoutLabels =
    knockoutRoundCount === 3
      ? ['Quarterfinal', 'Semifinal', 'Final']
      : knockoutRoundCount === 2
        ? ['Semifinal', 'Final']
        : Array.from({ length: knockoutRoundCount }, (_, index) => `Round ${index + 1}`);
  const label = knockoutLabels[knockoutRoundIndex] ?? `Round ${knockoutRoundIndex + 1}`;
  return `Group Knockout — ${label}`;
}
