'use server';
 
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { signOut } from '@/auth';
import postgres from 'postgres';
 
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
import { revalidatePath } from 'next/cache';


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
    return result[0]?.state || null;
  } catch (error) {
    console.error('SERVER_ACTION_FETCH_ERROR:', error);
    return null; 
  }
}

export async function clearTournament() {
  try {
    await sql`DELETE FROM tournament`;
    revalidatePath('/tournament/display');
    revalidatePath('/tournament/admin/dashboard');
    revalidatePath('/tournament/admin/setup');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear tournament:', error);
    return { success: false };
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