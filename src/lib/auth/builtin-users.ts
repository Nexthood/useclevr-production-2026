export const DEMO_PASS = "12345678" as const

export const OFFICIAL_SUPERADMIN_EMAIL = "superadmin@useclevr.com"
export const OFFICIAL_SUPERADMIN_NAME = "Csaba Sztoika"

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
  email: OFFICIAL_SUPERADMIN_EMAIL,
  name: OFFICIAL_SUPERADMIN_NAME,
  password: DEMO_PASS,
  role: "superadmin",
} as const

export const BUILTIN_USERS = [BUILTIN_BASE_USER, BUILTIN_DEMO_USER, BUILTIN_SUPER_ADMIN_USER] as const

export type BuiltinUserRole = (typeof BUILTIN_USERS)[number]["role"] | "admin" | "user"

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

export function isOfficialSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === OFFICIAL_SUPERADMIN_EMAIL
}

export function isSuperadmin(user?: {
  id?: string | null
  email?: string | null
  role?: string | null
} | null): boolean {
  if (!user) return false
  return (
    user.role === "superadmin" ||
    isSuperAdminUserId(user.id) ||
    isOfficialSuperAdminEmail(user.email)
  )
}

export function isSuperAdminAccess(userId?: string | null, email?: string | null): boolean {
  return isSuperadmin({ id: userId, email })
}
