import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Für normale User-Operationen (Client Components, Server Actions)
export const createClient = () => {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Wird aufgerufen von Server Component - kann ignoriert werden
            // wenn du Middleware für Session Refresh hast
          }
        },
      },
    }
  )
}

// Für Admin-Operationen (optional - nur wenn Service Role Key vorhanden)
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // ACHTUNG: Muss in .env vorhanden sein!
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignorieren
          }
        },
      },
    }
  )
}
