import assert from "node:assert/strict";

import {
  BUILTIN_BASE_USER,
  BUILTIN_DEMO_USER,
  BUILTIN_SUPER_ADMIN_USER,
  canUseBuiltinDirectCredentials,
  findBuiltinUserByCredentials,
} from "../../src/lib/auth/builtin-users";

async function main() {
  const superadmin = findBuiltinUserByCredentials(
    BUILTIN_SUPER_ADMIN_USER.email,
    BUILTIN_SUPER_ADMIN_USER.password,
  );
  const demo = findBuiltinUserByCredentials(BUILTIN_DEMO_USER.email, BUILTIN_DEMO_USER.password);
  const base = findBuiltinUserByCredentials(BUILTIN_BASE_USER.email, BUILTIN_BASE_USER.password);

  assert.equal(superadmin?.role, "superadmin");
  assert.equal(canUseBuiltinDirectCredentials(superadmin), false);
  assert.equal(canUseBuiltinDirectCredentials(demo), true);
  assert.equal(canUseBuiltinDirectCredentials(base), true);

  console.log("Built-in direct credential policy checks passed.");
}

main().catch((error) => {
  console.error("Built-in superadmin login preflight checks failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
