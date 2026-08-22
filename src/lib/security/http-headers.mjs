const REQUIRED_SECURITY_HEADERS = [
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["X-XSS-Protection", "1; mode=block"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
];

const PAYMENT_FORM_ORIGINS = [
  "https://checkout.stripe.com",
  "https://connect.squareup.com",
  "https://connect.squareupsandbox.com",
];

const DEV_CONNECT_ORIGINS = [
  "http://localhost:*",
  "http://127.0.0.1:*",
  "ws://localhost:*",
  "ws://127.0.0.1:*",
];

/**
 * @typedef {object} ContentSecurityPolicyOptions
 * @property {string=} nonce
 * @property {string=} pathname
 * @property {boolean=} isProduction
 */

/**
 * @typedef {object} RuntimeSecurityHeaderOptions
 * @property {string=} csp
 * @property {boolean=} isProduction
 * @property {boolean=} isHttps
 */

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return "";

  try {
    const withProtocol = value.startsWith("http") ? value : `https://${value}`;
    return new URL(withProtocol).origin;
  } catch {
    return "";
  }
}

function storageImageOrigins() {
  const origins = [
    normalizeOrigin(process.env.R2_PUBLIC_URL),
    process.env.AWS_S3_BUCKET && process.env.AWS_REGION
      ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
      : "",
  ];

  return unique(origins);
}

export function getNextConfigSecurityHeaders() {
  return REQUIRED_SECURITY_HEADERS.map(([key, value]) => ({ key, value }));
}

export function isHttpsRequest(request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedProtocol = request.headers.get("x-forwarded-protocol");
  const forwardedSsl = request.headers.get("x-forwarded-ssl");

  return request.nextUrl.protocol === "https:" ||
    forwardedProto === "https" ||
    forwardedProtocol === "https" ||
    forwardedSsl === "on";
}

/**
 * @param {ContentSecurityPolicyOptions} options
 */
export function buildContentSecurityPolicy({
  nonce,
  pathname = "",
  isProduction = process.env.NODE_ENV === "production",
} = {}) {
  const nonceSource = nonce ? `'nonce-${nonce}'` : "";
  const styleSources = pathname.startsWith("/admin")
    ? ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
    : ["'self'", nonceSource, "https://fonts.googleapis.com"];
  const connectSources = isProduction
    ? ["'self'"]
    : ["'self'", ...DEV_CONNECT_ORIGINS];

  const directives = [
    ["default-src", ["'self'"]],
    ["script-src", unique(["'self'", nonceSource, ...(isProduction ? [] : ["'unsafe-eval'"])])],
    ["style-src", unique(styleSources)],
    ["img-src", unique(["'self'", "data:", "blob:", ...storageImageOrigins()])],
    ["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
    ["connect-src", unique(connectSources)],
    ["frame-src", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", unique(["'self'", ...PAYMENT_FORM_ORIGINS])],
    ["manifest-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  return directives
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

/**
 * @param {Headers} headers
 * @param {RuntimeSecurityHeaderOptions} options
 */
export function applyRuntimeSecurityHeaders(headers, {
  csp,
  isProduction = process.env.NODE_ENV === "production",
  isHttps = false,
} = {}) {
  for (const [key, value] of REQUIRED_SECURITY_HEADERS) {
    headers.set(key, value);
  }

  if (csp) {
    headers.set("Content-Security-Policy", csp);
  }

  if (isProduction && isHttps) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

export const SECURITY_HEADER_ORIGINS = {
  formAction: PAYMENT_FORM_ORIGINS,
  developmentConnect: DEV_CONNECT_ORIGINS,
};
