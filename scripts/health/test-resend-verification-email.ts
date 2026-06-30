import { sendVerificationEmail } from "../../src/lib/auth/verification-email";

function readArg(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return undefined;
}

async function main() {
  const to = readArg("--to") || process.env.RESEND_TEST_TO || process.env.ADMIN_AUTH_BYPASS_EMAIL;
  if (!to) {
    throw new Error("Set RESEND_TEST_TO or pass --to recipient@example.com.");
  }

  console.warn("[Email] Sending Resend verification test email", {
    RESEND_API_KEY_SET: Boolean(process.env.RESEND_API_KEY),
    EMAIL_FROM: process.env.EMAIL_FROM,
    to,
  });

  await sendVerificationEmail(to, "123456");

  console.warn("[Email] Resend verification test email sent", {
    EMAIL_FROM: process.env.EMAIL_FROM,
    to,
  });
}

main().catch((error) => {
  console.error("[Email] Resend verification test failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
