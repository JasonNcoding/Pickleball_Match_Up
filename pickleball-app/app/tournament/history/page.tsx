import { redirect } from 'next/navigation';

export default function LegacyHistoryPage() {
  redirect('/tournament/admin/history');
}
