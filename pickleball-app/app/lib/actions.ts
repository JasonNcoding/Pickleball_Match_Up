'use server';
 
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { signOut } from '@/auth';
import postgres from 'postgres';
import type { Match, Round } from '@/app/lib/definitions';
 
const sql = postgres(process.env.POSTGRES_URL!, {
  ssl: 'require', 
  prepare: true, // Tells the DB to pre-compile the SQL logic
  idle_timeout: 20,
  max: 1});
import { revalidatePath } from 'next/cache';

interface TournamentStateSnapshot {
  mode?: string;
  tournamentType?: string;
  duprTeamMode?: 'manual' | 'random';
  duprKnockoutStage?: 'SEMIFINAL' | 'QUARTERFINAL';
  duprState?: unknown;
  duprInitialState?: unknown;
  duprDraftPlayers?: unknown;
  duprDraftSelection?: number | null;
  duprTeamsConfirmed?: boolean;
  duprUnassignedMatchIds?: unknown;
  duprUnassignedMatches?: unknown;
  duprScoreDrafts?: unknown;
  duprMatchLog?: unknown;
  courtTeamDrafts?: unknown;
  setupComplete?: boolean;
  tournamentFinished?: boolean;
  selectedCourts?: string[];
  courtOrder?: string[];
  players?: { id: string; name: string; rating: number }[];
  waitingPlayers?: string[];
  currentMatches?: Record<string, Match>;
  history?: Round[];
  bulkInput?: string;
}

export interface TournamentHistoryEntry {
  id: number;
  sessionSlug: string;
  archiveReason: string | null;
  archivedAt: string;
  tournamentType: string;
  roundsPlayed: number;
  playerCount: number;
  playerNames: string[];
  selectedCourts: string[];
  winnerNames: string[];
  rounds: {
    roundNumber: number;
    matches: {
      courtId: string;
      teamA: string[];
      teamB: string[];
      winner: 'A' | 'B' | null;
      score: string | null;
    }[];
  }[];
}

async function ensureTournamentHistoryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tournament_history (
      id BIGSERIAL PRIMARY KEY,
      session_slug TEXT NOT NULL DEFAULT 'main_session',
      archive_reason TEXT,
      state JSONB NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_tournament_history_archived_at
    ON tournament_history (archived_at DESC)
  `;
}

function normalizeTournamentState(raw: unknown): TournamentStateSnapshot | null {
  if (!raw) return null;

  if (typeof raw === 'object') {
    return raw as TournamentStateSnapshot;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as TournamentStateSnapshot;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

function inferTournamentType(state: TournamentStateSnapshot): string {
  const rawMode = (state as { mode?: unknown; tournamentType?: unknown }).tournamentType ??
    (state as { mode?: unknown; tournamentType?: unknown }).mode;

  if (typeof rawMode === 'string' && rawMode.trim().length > 0) {
    return rawMode;
  }
  return 'Rally To The Top';
}

function mapRoundMatches(matches: unknown): TournamentHistoryEntry['rounds'][number]['matches'] {
  if (!matches || typeof matches !== 'object') return [];

  return Object.entries(matches as Record<string, unknown>)
    .map(([courtId, value]) => {
      const match = value as {
        teamA?: unknown;
        teamB?: unknown;
        winner?: unknown;
        score?: unknown;
      };

      const winner: 'A' | 'B' | null =
        match.winner === 'A' || match.winner === 'B' ? match.winner : null;
      const score = typeof match.score === 'string' ? match.score : null;

      return {
        courtId,
        teamA: normalizeStringArray(match.teamA),
        teamB: normalizeStringArray(match.teamB),
        winner,
        score,
      };
    })
    .sort((a, b) => a.courtId.localeCompare(b.courtId, undefined, { numeric: true }));
}

function mapHistoryRounds(state: TournamentStateSnapshot): TournamentHistoryEntry['rounds'] {
  const duprRounds = (state.duprState as { rounds?: Round[] } | undefined)?.rounds;
  const rounds = Array.isArray(state.history) ? state.history : duprRounds;
  if (!Array.isArray(rounds)) return [];

  return rounds.map((round, index) => ({
    roundNumber: index + 1,
    matches: mapRoundMatches(round?.matches),
  }));
}

function getKingCourtWinners(state: TournamentStateSnapshot): string[] {
  const duprRounds = (state.duprState as { rounds?: Round[] } | undefined)?.rounds;
  if (Array.isArray(duprRounds) && duprRounds.length > 0) {
    const finalRound = duprRounds[duprRounds.length - 1];
    const finalMatch = finalRound ? Object.values(finalRound.matches)[0] : null;
    if (finalMatch?.winner) {
      const winnerIds = finalMatch.winner === 'A' ? finalMatch.teamA : finalMatch.teamB;
      if (winnerIds.length > 0) return winnerIds;
    }
  }

  const kingCourt = state.courtOrder?.[0];
  const rounds = state.history ?? [];
  const players = state.players ?? [];
  if (!kingCourt || rounds.length === 0) return [];

  const wins: Record<string, number> = {};
  players.forEach((player) => {
    wins[player.id] = 0;
  });

  rounds.forEach((round, index) => {
    if (index < 1) return;
    const match = round.matches[kingCourt];
    if (!match?.winner) return;

    const winnerIds = match.winner === 'A' ? match.teamA : match.teamB;
    winnerIds.forEach((id) => {
      wins[id] = (wins[id] || 0) + 1;
    });
  });

  const topScore = Math.max(0, ...Object.values(wins));
  if (topScore <= 0) return [];

  return Object.entries(wins)
    .filter(([, score]) => score === topScore)
    .map(([id]) => players.find((player) => player.id === id)?.name || id);
}

function toHistoryEntry(row: {
  id: number;
  session_slug: string;
  archive_reason: string | null;
  archived_at: Date | string;
  state: unknown;
}): TournamentHistoryEntry {
  const state = normalizeTournamentState(row.state) ?? {};
  return {
    id: row.id,
    sessionSlug: row.session_slug,
    archiveReason: row.archive_reason,
    archivedAt: new Date(row.archived_at).toISOString(),
    tournamentType: inferTournamentType(state),
    roundsPlayed: mapHistoryRounds(state).length,
    playerCount: state.players?.length ?? 0,
    playerNames: (state.players ?? []).map((player) => player.name || player.id),
    selectedCourts: state.selectedCourts ?? [],
    winnerNames: getKingCourtWinners(state),
    rounds: mapHistoryRounds(state),
  };
}

export async function saveTournamentState(state: any) {
  if (!state) return { error: 'No state provided' };
  
  try {
    // const stateString = JSON.stringify(state);
    await sql`
      INSERT INTO tournament (id, state, slug, created_at)
      VALUES ('1', ${state}, 'main_session', NOW())
      ON CONFLICT (id) 
      DO UPDATE SET 
        state = ${state}, 
        created_at = NOW();
    `;
    revalidatePath('/tournament/display');
    return { success: true };
  } catch (error) {
    console.error('SERVER_ACTION_SAVE_ERROR:', error);
    throw new Error('Failed to save to database');
  }
}

export async function getTournamentState() {
  try {
    const result = await sql`SELECT state FROM tournament`;
    return normalizeTournamentState(result[0]?.state) || null;
  } catch (error) {
    console.error('SERVER_ACTION_FETCH_ERROR:', error);
    return null; 
  }
}

export async function getTournamentHistory(limit = 30): Promise<TournamentHistoryEntry[]> {
  try {
    await ensureTournamentHistoryTable();
    const rows = await sql<{
      id: number;
      session_slug: string;
      archive_reason: string | null;
      archived_at: Date | string;
      state: unknown;
    }[]>`
      SELECT id, session_slug, archive_reason, archived_at, state
      FROM tournament_history
      ORDER BY archived_at DESC
      LIMIT ${Math.max(1, Math.min(limit, 200))}
    `;

    if (rows.length > 0) {
      return rows.map(toHistoryEntry);
    }

    // Fallback: show active session if no archived rows exist yet.
    const activeRows = await sql<{
      id: string;
      slug: string | null;
      created_at: Date | string;
      state: unknown;
    }[]>`
      SELECT id, slug, created_at, state
      FROM tournament
      WHERE id = '1'
      LIMIT 1
    `;

    const activeState = normalizeTournamentState(activeRows[0]?.state);
    if (!activeState) return [];

    return [
      toHistoryEntry({
        id: 0,
        session_slug: activeRows[0]?.slug || 'main_session',
        archive_reason: 'active-session',
        archived_at: activeRows[0]?.created_at || new Date().toISOString(),
        state: activeState,
      }),
    ];
  } catch (error) {
    console.error('SERVER_ACTION_HISTORY_FETCH_ERROR:', error);
    return [];
  }
}

export async function deleteTournamentHistoryEntry(id: number) {
  if (!Number.isFinite(id) || id <= 0) return { success: false };
  try {
    await ensureTournamentHistoryTable();
    await sql`DELETE FROM tournament_history WHERE id = ${id}`;
    revalidatePath('/tournament/admin/history');
    revalidatePath('/tournament/history');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete tournament history entry:', error);
    return { success: false };
  }
}

export async function clearTournament() {
  try {
    await sql`DELETE FROM tournament`;
    revalidatePath('/tournament/display');
    revalidatePath('/tournament/admin');
    revalidatePath('/tournament/admin/history');
    revalidatePath('/tournament/history');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear tournament:', error);
    return { success: false };
  }
}

export async function archiveAndClearTournament(reason = 'manual-reset') {
  try {
    await ensureTournamentHistoryTable();

    const activeSession = await sql<{
      id: string;
      slug: string | null;
      state: unknown;
    }[]>`
      SELECT id, slug, state
      FROM tournament
      WHERE id = '1'
      LIMIT 1
    `;

    let archived = false;
    let archiveId: number | null = null;

    const snapshot = normalizeTournamentState(activeSession[0]?.state);
    const shouldArchive = Boolean(
      snapshot &&
        (snapshot.setupComplete ||
          (snapshot.players?.length ?? 0) > 0 ||
          (snapshot.history?.length ?? 0) > 0),
    );

    if (snapshot && shouldArchive) {
      const snapshotJson = JSON.stringify(snapshot);
      const inserted = await sql`
        INSERT INTO tournament_history (session_slug, archive_reason, state)
        VALUES (${activeSession[0]?.slug || 'main_session'}, ${reason}, ${snapshotJson}::jsonb)
        RETURNING id
      `;
      archiveId = (inserted[0]?.id as number | undefined) ?? null;
      archived = true;
    }

    await sql`DELETE FROM tournament`;

    revalidatePath('/tournament/display');
    revalidatePath('/tournament/admin');
    revalidatePath('/tournament/admin/history');
    revalidatePath('/tournament/history');

    return { success: true, archived, archiveId };
  } catch (error) {
    console.error('Failed to archive and clear tournament:', error);
    return { success: false, archived: false, archiveId: null };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

export async function handleSignOut() {
  await signOut({ redirectTo: '/' });
}
