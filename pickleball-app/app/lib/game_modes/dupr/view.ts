import type { DuprTournamentState } from '@/app/lib/tournament_mode/duprTournament';

export function formatDuprPhaseLabel(state: DuprTournamentState | null): string {
  if (!state) return 'DUPR Tournament';
  if (state.phase === 'COMPLETED') return 'DUPR Completed';
  if (state.phase === 'ROUND_ROBIN') return `DUPR Round Robin ${state.currentRoundNumber + 1}`;

  const knockoutRoundIndex = Math.max(0, state.currentRoundNumber - state.roundRobinRounds);
  const knockoutRoundCount = Math.max(1, state.rounds.length - state.roundRobinRounds);
  const knockoutLabels =
    knockoutRoundCount === 3
      ? ['Quarterfinal', 'Semifinal', 'Final']
      : knockoutRoundCount === 2
        ? ['Semifinal', 'Final']
        : Array.from({ length: knockoutRoundCount }, (_, index) => `Round ${index + 1}`);
  const label = knockoutLabels[knockoutRoundIndex] ?? `Round ${knockoutRoundIndex + 1}`;
  return `DUPR Knockout ${label}`;
}
