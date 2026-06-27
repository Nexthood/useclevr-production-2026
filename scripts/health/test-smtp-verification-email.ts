import { sendVerificationEmail } from "../../src/lib/auth/verification-email";

type SmtpMode = {
  port: string;
  secure: string;
};

function readArg(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return undefined;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const to = readArg("--to") || process.env.SMTP_TEST_TO;
  if (!to) {
    throw new Error("Set SMTP_TEST_TO or pass --to recipient@example.com.");
  }

  const modes = hasArg("--matrix")
    ? [
        { port: "465", secure: "true" },
        { port: "587", secure: "false" },
      ]
    : [
        {
          port: readArg("--port") || process.env.SMTP_PORT || "465",
          secure: readArg("--secure") || process.env.SMTP_SECURE || "true",
        },
      ];

  for (const mode of modes) {
    await sendTestEmail(to, mode);
  }
}

async function sendTestEmail(to: string, mode: SmtpMode) {
  process.env.SMTP_PORT = mode.port;
  process.env.SMTP_SECURE = mode.secure;

  console.log("[Email] Sending SMTP verification test email", {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    to,
  });

  await sendVerificationEmail(to, "123456");

  console.log("[Email] SMTP verification test email sent", {
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    to,
  });
}

main().catch((error) => {
  console.error("[Email] SMTP verification test failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
