import { createClient } from '@supabase/supabase-js'

// The "!" tells TypeScript: "I promise these variables exist in .env.local"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)