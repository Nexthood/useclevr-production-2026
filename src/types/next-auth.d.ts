import type { BuiltinUserRole } from "@/lib/auth/builtin-users"
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: BuiltinUserRole
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: BuiltinUserRole
  }
}
