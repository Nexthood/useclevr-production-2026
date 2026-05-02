export const BUILTIN_DEMO_USER = {
  id: "demo-user-id",
  email: "demo@useclever.app",
  name: "Demo User",
  password: "demo",
  role: "demo",
} as const

export const BUILTIN_SUPER_ADMIN_USER = {
  id: "super-admin-user-id",
  email: "superadmin@useclever.app",
  name: "Super Admin",
  password: "superadmin",
  role: "superadmin",
} as const

export const BUILTIN_USERS = [BUILTIN_DEMO_USER, BUILTIN_SUPER_ADMIN_USER] as const

export type BuiltinUserRole = (typeof BUILTIN_USERS)[number]["role"] | "user"

export function findBuiltinUserByCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  return BUILTIN_USERS.find(
    (user) => user.email === normalizedEmail && user.password === password,
  )
}

export function isBuiltinUserId(userId?: string | null) {
  return BUILTIN_USERS.some((user) => user.id === userId)
}

export function isSuperAdminUserId(userId?: string | null) {
  return userId === BUILTIN_SUPER_ADMIN_USER.id
}
