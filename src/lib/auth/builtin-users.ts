export const DEMO_PASS = "12345678" as const

export const BUILTIN_BASE_USER = {
  id: "base-user-id",
  email: "base@useclevr.app",
  name: "Base User",
  password: DEMO_PASS,
  role: "user",
} as const

export const BUILTIN_DEMO_USER = {
  id: "demo-user-id",
  email: "demo@useclevr.app",
  name: "Demo User",
  password: DEMO_PASS,
  role: "demo",
} as const

export const BUILTIN_SUPER_ADMIN_USER = {
  id: "super-admin-user-id",
  email: "superadmin@useclevr.app",
  name: "Super Admin",
  password: DEMO_PASS,
  role: "superadmin",
} as const

export const BUILTIN_USERS = [BUILTIN_BASE_USER, BUILTIN_DEMO_USER, BUILTIN_SUPER_ADMIN_USER] as const

export type BuiltinUserRole = (typeof BUILTIN_USERS)[number]["role"] | "user"

export function findBuiltinUserByCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  return BUILTIN_USERS.find(
    (user) => user.email === normalizedEmail && user.password === password,
  )
}

export function findBuiltinUserById(userId?: string | null) {
  return BUILTIN_USERS.find((user) => user.id === userId)
}

export function isBuiltinUserId(userId?: string | null) {
  return Boolean(findBuiltinUserById(userId))
}

export function isSuperAdminUserId(userId?: string | null) {
  return userId === BUILTIN_SUPER_ADMIN_USER.id
}
