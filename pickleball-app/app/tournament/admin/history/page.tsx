import { deleteTournamentHistoryEntry, getTournamentHistory } from '@/app/lib/actions';
import HistoryClient from './history-client';

export default async function HistoryPage() {
  const sessions = await getTournamentHistory(50);

  async function onDelete(id: number) {
    'use server';
    return deleteTournamentHistoryEntry(id);
  }

  return <HistoryClient sessions={sessions} onDelete={onDelete} />;
}
