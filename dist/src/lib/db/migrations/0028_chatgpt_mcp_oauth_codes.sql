CREATE TABLE IF NOT EXISTS "ChatGptMcpOAuthCode" (
  "id" text PRIMARY KEY NOT NULL,
  "codeHash" varchar(255) NOT NULL,
  "userId" text NOT NULL,
  "clientId" text NOT NULL,
  "redirectUri" text NOT NULL,
  "resource" text NOT NULL,
  "scopes" text[] NOT NULL,
  "codeChallenge" text NOT NULL,
  "codeChallengeMethod" varchar(20) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatGptMcpOAuthCode_codeHash_key"
  ON "ChatGptMcpOAuthCode" ("codeHash");
CREATE INDEX IF NOT EXISTS "ChatGptMcpOAuthCode_userId_idx"
  ON "ChatGptMcpOAuthCode" ("userId");
CREATE INDEX IF NOT EXISTS "ChatGptMcpOAuthCode_expiresAt_idx"
  ON "ChatGptMcpOAuthCode" ("expiresAt");
