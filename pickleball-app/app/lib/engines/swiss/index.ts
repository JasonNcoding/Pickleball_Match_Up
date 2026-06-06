export { generateSwissPairings } from './pairing';
export type { SwissPairingInput } from './pairing';
// Swiss standings use the same tiebreaker logic as Round Robin (USA Pickleball rules).
export { calculateRoundRobinStandings as calculateSwissStandings } from '@/app/lib/engines/round-robin/standings';
export type { RRStandingsEntry as SwissStandingsEntry } from '@/app/lib/engines/round-robin/standings';
