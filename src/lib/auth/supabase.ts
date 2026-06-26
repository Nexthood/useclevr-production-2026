import { createClient } from "@supabase/supabase-js"

type SupabaseClientResult =
  | { client: ReturnType<typeof createClient>; error: null }
  | { client: null; error: string }

export function createSupabaseAuthClient(): SupabaseClientResult {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      client: null,
      error: "Email verification is not configured. Contact support before creating an account.",
    }
  }

  return {
    client: createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }),
    error: null,
  }
}
