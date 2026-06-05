export type PasswordPolicyContext = {
  email?: string
  name?: string
}

export type PasswordPolicyCheck = {
  id: string
  label: string
  passed: boolean
}

export function getPasswordPolicyChecks(
  password: string,
  context: PasswordPolicyContext = {},
): PasswordPolicyCheck[] {
  const normalizedPassword = password.toLowerCase()
  const emailName = context.email?.split("@")[0]?.toLowerCase().trim() ?? ""
  const nameParts =
    context.name
      ?.toLowerCase()
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3) ?? []

  return [
    { id: "length", label: "At least 12 characters", passed: password.length >= 12 },
    { id: "upper", label: "Uppercase letter", passed: /[A-Z]/.test(password) },
    { id: "lower", label: "Lowercase letter", passed: /[a-z]/.test(password) },
    { id: "number", label: "Number", passed: /[0-9]/.test(password) },
    { id: "special", label: "Special character", passed: /[^A-Za-z0-9]/.test(password) },
    {
      id: "personal",
      label: "Does not include your name or email",
      passed:
        password.length === 0 ||
        ((!emailName || !normalizedPassword.includes(emailName)) &&
          !nameParts.some((part) => normalizedPassword.includes(part))),
    },
  ]
}

export function validatePasswordPolicy(
  password: string,
  context: PasswordPolicyContext = {},
) {
  const checks = getPasswordPolicyChecks(password, context)
  const failedChecks = checks.filter((check) => !check.passed)

  return {
    checks,
    failedChecks,
    passed: failedChecks.length === 0,
    message:
      failedChecks.length === 0
        ? ""
        : `Password needs: ${failedChecks.map((check) => check.label.toLowerCase()).join(", ")}.`,
  }
}
