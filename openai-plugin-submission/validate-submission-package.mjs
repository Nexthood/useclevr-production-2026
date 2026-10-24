import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const errors = [];
const warnings = [];

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function requirePath(relativePath) {
  if (!existsSync(path.join(root, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const plugin = readJson("plugin.json");
const mcp = readJson("mcp.json");
const listing = readJson("listing-metadata.json");

for (const file of [
  "plugin.json",
  "mcp.json",
  "listing-metadata.json",
  "assets/logo.png",
  "assets/composer-icon.svg",
  "review/review-test-cases.md",
  "security/security-review-checklist.md",
  "submission-instructions.md",
]) {
  requirePath(file);
}

if (plugin) {
  if (plugin.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
    errors.push("plugin.json must use the Agent Plugins 1.0 schema URL.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plugin.name || "")) {
    errors.push("plugin.json name must be kebab-case.");
  }
  const openai = plugin.extensions?.["com.openai"];
  const iface = openai?.interface;
  if (!iface) errors.push("plugin.json missing extensions.com.openai.interface.");
  if (plugin.author?.name !== "Atlas Mega Ventures" || iface?.developerName !== "Atlas Mega Ventures" || listing?.developerName !== "Atlas Mega Ventures") {
    errors.push("Package author and listing publisher must consistently name Atlas Mega Ventures.");
  }
  if (plugin.name !== "useclevr" || iface?.displayName !== "UseClevr" || listing?.displayName !== "UseClevr") {
    errors.push("Package identifier must be useclevr and product display name must be UseClevr.");
  }
  for (const field of ["developerName", "category", "websiteURL", "privacyPolicyURL", "termsOfServiceURL", "supportURL", "logo", "composerIcon"]) {
    if (listing?.[field] !== iface?.[field]) errors.push(`Listing summary disagrees with interface.${field}.`);
  }
  for (const field of ["displayName", "shortDescription", "longDescription", "developerName", "websiteURL", "privacyPolicyURL", "termsOfServiceURL", "logo", "composerIcon"]) {
    if (!iface?.[field]) errors.push(`plugin.json missing interface.${field}.`);
  }
  for (const assetField of ["logo", "composerIcon"]) {
    const value = iface?.[assetField];
    if (typeof value === "string" && !value.startsWith("./")) {
      errors.push(`interface.${assetField} must be a ./ relative path.`);
    }
  }
  const positive = openai?.review?.test_cases?.positive;
  const negative = openai?.review?.test_cases?.negative;
  if (!Array.isArray(positive) || positive.length !== 5) errors.push("Initial MCP review requires exactly five positive test cases.");
  if (!Array.isArray(negative) || negative.length !== 3) errors.push("Initial MCP review requires exactly three negative test cases.");
  for (const [index, testCase] of (positive || []).entries()) {
    for (const field of ["description", "prompt", "tools_triggered", "expected_behavior"]) {
      if (!testCase[field]) errors.push(`Positive test case ${index + 1} missing ${field}.`);
    }
  }
  for (const [index, testCase] of (negative || []).entries()) {
    for (const field of ["description", "prompt", "expected_behavior"]) {
      if (!testCase[field]) errors.push(`Negative test case ${index + 1} missing ${field}.`);
    }
  }
  if (!openai?.review?.demo_recording_url) {
    warnings.push("Missing review.demo_recording_url. The ZIP is structurally valid, but final MCP review submission requires a real accessible demo recording URL.");
  } else {
    try {
      const demo = new URL(openai.review.demo_recording_url);
      if (demo.protocol !== "https:" || demo.username || demo.password) throw new Error("Invalid demo URL");
    } catch {
      errors.push("review.demo_recording_url must be an HTTPS URL without credentials.");
    }
  }
}

if (mcp) {
  if (mcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") {
    errors.push("mcp.json must use the Agent Plugins MCP 1.0 schema URL.");
  }
  const server = mcp.mcpServers?.useclevr;
  if (!server) errors.push("mcp.json missing mcpServers.useclevr.");
  if (server?.type !== "streamable-http") errors.push("mcpServers.useclevr.type must be streamable-http.");
  if (server?.url !== "https://app.useclevr.com/api/chatgpt/mcp") errors.push("mcpServers.useclevr.url must be the production ChatGPT MCP endpoint.");
  const auth = server?.extensions?.["com.openai"]?.auth;
  if (auth?.type !== "oauth") errors.push("mcpServers.useclevr auth.type must be oauth.");
  if (auth?.client?.mode !== "cimd") errors.push("mcpServers.useclevr auth.client.mode should be cimd for the existing implementation.");
  if (listing?.oauth?.clientMode !== auth?.client?.mode || listing?.oauth?.tokenEndpointAuthMethod !== "none" || listing?.mcpEndpoint !== server?.url) {
    errors.push("Listing OAuth summary must agree with the CIMD public-client MCP declaration.");
  }
  if (auth?.resource !== server?.url) errors.push("OAuth resource must match the MCP endpoint URL.");
  if (JSON.stringify(auth?.defaultScopes || []) !== JSON.stringify(["dataset:read", "dataset:write"])) {
    errors.push("OAuth defaultScopes should request dataset:read and dataset:write for the upload tool.");
  }
}

for (const file of ["plugin.json", "mcp.json", "listing-metadata.json"]) {
  const body = readFileSync(path.join(root, file), "utf8");
  if (/clientSecret|test_credentials|reviewer_instructions|password|private_key/i.test(body)) {
    errors.push(`${file} appears to contain a forbidden secret or reviewer credential field.`);
  }
}

if (errors.length) {
  console.error("Submission package validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Submission package JSON/path validation passed.");
console.log("Publisher identity verification, reviewer/demo access, and portal readiness require separate operator checks.");
for (const warning of warnings) console.warn(`Warning: ${warning}`);
