import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildClevrSyncGoogleRedirect,
  resolveClevrSyncBrowserOrigin,
  resolveClevrSyncGoogleRedirectUri,
} from "../../src/services/clevrsync/oauth-redirect";

const ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_APP_URL",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "GOOGLE_CLEVRSYNC_REDIRECT_URI",
  "PORT",
] as const;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALLBACK_PATH = "/api/clevrsync/google/oauth/callback";
const UNSAFE_ORIGINS = [
  "http://0.0.0.0:8080",
  "https://0.0.0.0:8080",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function withEnv(overrides: Record<string, string | undefined>, run: () => void) {
  const env = process.env as Record<string, string | undefined>;
  const snapshot = new Map(ENV_KEYS.map((key) => [key, env[key]]));
  try {
    for (const key of ENV_KEYS) delete env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of snapshot) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

function buildAuthorizationUrl(state: string, redirectUri: string) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", "test-client");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url;
}

function assertNoInternalRedirect(...redirects: string[]) {
  for (const redirect of redirects) {
    const parsed = new URL(redirect);
    assert.equal(
      ["0.0.0.0", "localhost", "127.0.0.1", "::1"].includes(parsed.hostname),
      false,
      `deployed redirect must never use an internal host: ${redirect}`,
    );
  }
}

// Production with no public env configuration at all: Railway internal bind origin
// must never leak into the redirect_uri or the final browser redirect.
withEnv({ NODE_ENV: "production" }, () => {
  for (const internalOrigin of UNSAFE_ORIGINS) {
    const origin = resolveClevrSyncBrowserOrigin(internalOrigin);
    assert.equal(origin, "https://app.useclevr.com");

    const redirectUri = resolveClevrSyncGoogleRedirectUri(internalOrigin);
    assert.equal(redirectUri, "https://app.useclevr.com/api/clevrsync/google/oauth/callback");

    const authorizationUrl = buildAuthorizationUrl("state-token", redirectUri);
    const exchangeRedirectUri = resolveClevrSyncGoogleRedirectUri(internalOrigin);
    assert.equal(authorizationUrl.searchParams.get("redirect_uri"), exchangeRedirectUri);

    const successRedirect = buildClevrSyncGoogleRedirect({
      path: "/app/settings/data-connections",
      requestOrigin: internalOrigin,
    });
    successRedirect.searchParams.set("google", "connected");
    successRedirect.searchParams.set("connectorId", "conn_123");
    assert.equal(
      successRedirect.toString(),
      "https://app.useclevr.com/app/settings/data-connections?google=connected&connectorId=conn_123",
    );

    const errorRedirect = buildClevrSyncGoogleRedirect({
      path: "/app/settings/data-connections?google=error",
      requestOrigin: internalOrigin,
    });
    assert.equal(
      errorRedirect.toString(),
      "https://app.useclevr.com/app/settings/data-connections?google=error",
    );

    assertNoInternalRedirect(
      redirectUri,
      authorizationUrl.searchParams.get("redirect_uri") || "",
      successRedirect.toString(),
      errorRedirect.toString(),
    );
  }
});

// Production test deployment: canonical env configuration wins and resolves to test.useclevr.com.
withEnv(
  {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://test.useclevr.com",
    AUTH_URL: "https://test.useclevr.com",
    NEXTAUTH_URL: "https://test.useclevr.com",
  },
  () => {
    const origin = resolveClevrSyncBrowserOrigin("http://0.0.0.0:8080");
    assert.equal(origin, "https://test.useclevr.com");
    const redirectUri = resolveClevrSyncGoogleRedirectUri("http://0.0.0.0:8080");
    assert.equal(redirectUri, "https://test.useclevr.com/api/clevrsync/google/oauth/callback");
    assertNoInternalRedirect(redirectUri);
  },
);

// Production with an explicit safe configured redirect_uri: authorization and token
// exchange must both use the exact same environment-correct URI.
withEnv(
  {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://app.useclevr.com",
    GOOGLE_CLEVRSYNC_REDIRECT_URI: "https://app.useclevr.com/api/clevrsync/google/oauth/callback",
  },
  () => {
    const authorizationUri = resolveClevrSyncGoogleRedirectUri("http://0.0.0.0:8080");
    const exchangeUri = resolveClevrSyncGoogleRedirectUri("https://app.useclevr.com");
    assert.equal(authorizationUri, exchangeUri);
    assert.equal(
      authorizationUri,
      "https://app.useclevr.com/api/clevrsync/google/oauth/callback",
    );
  },
);

// Production with an unsafe configured redirect_uri: the internal value is ignored
// and the safe public-origin fallback is used instead.
withEnv(
  {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://app.useclevr.com",
  },
  () => {
    for (const unsafe of [
      "http://0.0.0.0:8080/api/clevrsync/google/oauth/callback",
      "http://localhost:3000/api/clevrsync/google/oauth/callback",
      "https://10.1.2.3/api/clevrsync/google/oauth/callback",
    ]) {
      process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI = unsafe;
      assert.equal(
        resolveClevrSyncGoogleRedirectUri("http://0.0.0.0:8080"),
        "https://app.useclevr.com/api/clevrsync/google/oauth/callback",
      );
      assertNoInternalRedirect(resolveClevrSyncGoogleRedirectUri("http://0.0.0.0:8080"));
    }
    delete process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI;
  },
);

// Local development: request origin localhost keeps working and 0.0.0.0 dev origins
// convert to localhost before anything is sent to the browser.
withEnv({ NODE_ENV: "development" }, () => {
  assert.equal(
    resolveClevrSyncBrowserOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
  assert.equal(
    resolveClevrSyncGoogleRedirectUri("http://localhost:3000"),
    "http://localhost:3000/api/clevrsync/google/oauth/callback",
  );
  assert.equal(resolveClevrSyncBrowserOrigin("http://0.0.0.0:3000"), "http://localhost:3000");
  assert.equal(
    resolveClevrSyncBrowserOrigin(""),
    `http://localhost:${process.env.PORT || "3000"}`,
  );

  process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI =
    "http://localhost:3000/api/clevrsync/google/oauth/callback";
  assert.equal(
    resolveClevrSyncGoogleRedirectUri("http://localhost:3000"),
    "http://localhost:3000/api/clevrsync/google/oauth/callback",
  );
  delete process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI;
});

// Success and error callback redirects resolve through the same safe public-origin
// helper in both route files, and no route derives browser URLs from the raw
// request origin anymore.
for (const [route, name] of [
  [
    "src/app/api/clevrsync/google/oauth/start/route.ts",
    "ClevrSync Google OAuth start route",
  ],
  [
    "src/app/api/clevrsync/google/oauth/callback/route.ts",
    "ClevrSync Google OAuth callback route",
  ],
] as const) {
  const source = readFileSync(route, "utf8");
  assert.match(
    source,
    /resolveClevrSyncBrowserOrigin/,
    `${name} must use the shared safe public-origin resolver`,
  );
  const strippedSource = source
    .replaceAll("resolveClevrSyncBrowserOrigin(request.nextUrl.origin)", "")
    .replaceAll("resolveClevrSyncGoogleRedirectUri(request.nextUrl.origin)", "");
  assert.doesNotMatch(
    strippedSource,
    /nextUrl\.origin/,
    `${name} must only pass the raw request origin into the safe resolver`,
  );
  assert.doesNotMatch(
    source,
    /, request\.url\)/,
    `${name} must not build browser URLs from request.url`,
  );
}

const callbackSource = readFileSync(
  "src/app/api/clevrsync/google/oauth/callback/route.ts",
  "utf8",
);
assert.match(
  callbackSource,
  /resolveClevrSyncGoogleRedirectUri/,
  "callback route must resolve the token-exchange redirect_uri through the shared resolver",
);
assert.match(
  callbackSource,
  /verifyGoogleOAuthState/,
  "callback route must keep OAuth state validation",
);
assert.match(
  callbackSource,
  /encryptClevrSyncToken/,
  "callback route must keep token encryption",
);
const startSource = readFileSync("src/app/api/clevrsync/google/oauth/start/route.ts", "utf8");
assert.match(
  startSource,
  /createGoogleOAuthState/,
  "start route must keep signed state generation",
);
assert.match(
  startSource,
  /resolveClevrSyncGoogleRedirectUri/,
  "start route must resolve the authorization redirect_uri through the shared resolver",
);

console.log("ClevrSync Google OAuth redirect origin checks passed.");
