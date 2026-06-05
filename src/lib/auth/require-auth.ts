import { auth } from "@/lib/auth/auth"
import type { Session } from "next-auth"
import { type Result, success, failure } from "@/lib/result"

export class AuthenticationError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message)
    this.name = "AuthenticationError"
  }
}

/**
 * Checks for an active authenticated session and throws an AuthenticationError
 * if the user is not signed in.
 * Suitable for Server Actions or server side route files where throwing is preferred.
 */
export async function requireAuth(): Promise<Session & { user: { id: string } }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new AuthenticationError("Unauthorized")
  }
  return session as Session & { user: { id: string } }
}

/**
 * Checks for an active authenticated session and returns a Result.
 * Suitable for API routes or functions that prefer functional error returns.
 */
export async function requireAuthResult(): Promise<Result<Session & { user: { id: string } }, string>> {
  const session = await auth()
  if (!session?.user?.id) {
    return failure("Unauthorized")
  }
  return success(session as Session & { user: { id: string } })
}
