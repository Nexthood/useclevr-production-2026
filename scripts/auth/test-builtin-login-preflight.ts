import assert from "node:assert/strict";

import { beginEmailPasswordLogin } from "../../src/app/actions/auth";
import { BUILTIN_SUPER_ADMIN_USER } from "../../src/lib/auth/builtin-users";

async function main() {
  const result = await beginEmailPasswordLogin(
    BUILTIN_SUPER_ADMIN_USER.email,
    BUILTIN_SUPER_ADMIN_USER.password,
  );

  assert.equal("success" in result ? result.success : false, true);
  assert.equal("builtInCredentials" in result ? result.builtInCredentials : false, true);
  assert.equal("email" in result ? result.email : "", BUILTIN_SUPER_ADMIN_USER.email);
  assert.equal("purpose" in result ? result.purpose : "", "login");

  const badPasswordResult = await beginEmailPasswordLogin(
    BUILTIN_SUPER_ADMIN_USER.email,
    "wrong-password",
  );
  assert.equal("error" in badPasswordResult, true);

  console.log("Built-in superadmin login preflight checks passed.");
}

main().catch((error) => {
  console.error("Built-in superadmin login preflight checks failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
