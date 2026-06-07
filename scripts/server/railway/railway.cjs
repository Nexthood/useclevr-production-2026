#!/usr/bin/env node
/**
 * Railway CLI replacement using GraphQL API directly.
 * Avoids Rust binary bugs in non-TTY environments.
 * Supports: login, list, link, status, whoami
 * Falls through to native binary for unsupported commands.
 */
const { execFileSync } = require("child_process");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs");
const { resolve } = require("path");

// Load .env from project root
const dotenv = resolve(__dirname, "../../../.env");
if (existsSync(dotenv)) {
  const lines = readFileSync(dotenv, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if ((key === "RAILWAY_API_TOKEN" || key === "RAILWAY_TOKEN") && !process.env[key]) {
      process.env[key] = val;
    }
  }
}
const { env, exit } = require("process");

const API = "https://api.railway.app/graphql/v2";

const RAILWAY_DIR = resolve(".railway");
const PROJECT_FILE = resolve(RAILWAY_DIR, "project.json");

function getToken() {
  return env.RAILWAY_API_TOKEN || env.RAILWAY_TOKEN;
}

async function gql(query, variables = {}) {
  const token = getToken();
  if (!token) {
    console.error("No token found. Set RAILWAY_API_TOKEN in .env");
    exit(1);
  }
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    for (const e of data.errors) {
      console.error("API error:", e.message);
    }
    exit(1);
  }
  return data.data;
}

function requireToken() {
  const token = getToken();
  if (!token) {
    console.error(
      "❌ No Railway token found.\n" + "Set RAILWAY_API_TOKEN in .env or run: pnpm railway:login",
    );
    exit(1);
  }
}

function readProjectLink() {
  if (!existsSync(PROJECT_FILE)) return null;
  try {
    return JSON.parse(readFileSync(PROJECT_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeProjectLink(data) {
  if (!existsSync(RAILWAY_DIR)) mkdirSync(RAILWAY_DIR, { recursive: true });
  writeFileSync(PROJECT_FILE, JSON.stringify(data, null, 2) + "\n");
}

function getLinkedProjectId() {
  return readProjectLink()?.projectId || null;
}

function requireLinkedProjectId() {
  const projectId = getLinkedProjectId();
  if (!projectId) {
    console.error("No project linked. Run: pnpm railway:link");
    exit(1);
  }
  return projectId;
}

function parseJsonFlag(args) {
  return args.includes("--json");
}

function print(data, asJson = false) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(data);
}

async function cmdLogin() {
  requireToken();
  const { me } = await gql(`{ me { id name email } }`);
  console.log(`✅ Authenticated as ${me.name} <${me.email}> (${me.id})`);
}

async function cmdWhoami() {
  const link = readProjectLink();
  if (link) {
    console.log(`Project: ${link.name} (${link.id})`);
    if (link.environmentName) console.log(`Environment: ${link.environmentName}`);
  }
  const token = getToken();
  if (!token) {
    console.log("No token set");
    return;
  }
  try {
    const { me } = await gql(`{ me { id name email } }`);
    console.log(`User: ${me.name} <${me.email}>`);
  } catch {
    console.log("Token: (set but cannot verify)");
  }
}

async function cmdList() {
  requireToken();
  try {
    const { me } = await gql(
      `{ me { id name email projects { edges { node { id name description } } } } }`,
    );
    const projects = me.projects?.edges?.map((e) => e.node) || [];
    if (projects.length === 0) {
      console.log("No projects found. Create one at https://railway.app/new");
      return;
    }
    for (const p of projects) {
      console.log(`${p.id}  ${p.name}${p.description ? " — " + p.description : ""}`);
    }
  } catch {
    // Maybe a project-scoped token without me access
    const { projectToken } = await gql(`{ projectToken { id projectId project { id name } } }`);
    if (projectToken?.project) {
      console.log(`${projectToken.project.id}  ${projectToken.project.name}`);
    }
  }
}

async function cmdLink() {
  requireToken();
  let projects;
  try {
    const { me } = await gql(
      `{ me { id email projects { edges { node { id name description } } } } }`,
    );
    projects = me.projects?.edges?.map((e) => e.node) || [];
  } catch {
    // project-scoped token
    const { projectToken } = await gql(`{ projectToken { id projectId project { id name } } }`);
    if (projectToken?.project) {
      writeProjectLink({
        projectId: projectToken.project.id,
        name: projectToken.project.name,
      });
      console.log(`✅ Linked to ${projectToken.project.name} (${projectToken.project.id})`);
      return;
    }
    console.error("No projects accessible with this token");
    exit(1);
  }

  if (projects.length === 0) {
    console.error("No projects found. Create one at https://railway.app/new");
    exit(1);
  }

  // If only one project, link directly
  if (projects.length === 1) {
    const p = projects[0];
    writeProjectLink({ projectId: p.id, name: p.name });
    console.log(`✅ Linked to ${p.name} (${p.id})`);
    return;
  }

  // Multiple projects — let user pick
  console.log("Select a project:");
  projects.forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.name}${p.description ? " — " + p.description : ""}`),
  );

  // Accept index from args or prompt
  const idxArg = env.RAILWAY_LINK_INDEX;
  const idx = idxArg ? parseInt(idxArg, 10) - 1 : 0;
  const p = projects[idx];
  if (!p) {
    console.error(`Invalid selection`);
    exit(1);
  }
  writeProjectLink({ projectId: p.id, name: p.name });
  console.log(`✅ Linked to ${p.name} (${p.id})`);
}

async function cmdStatus() {
  const link = readProjectLink();
  if (link) {
    console.log(`Project: ${link.name}`);
    console.log(`ID:      ${link.projectId}`);
    if (link.environmentName) console.log(`Env:     ${link.environmentName}`);

    // Try to get live status from API
    try {
      const { project } = await gql(`{ project(id: "${link.projectId}") { id name description } }`);
      if (project) {
        console.log(`Status:  ✅ Connected (${project.name})`);
      }
    } catch {
      console.log("Status:  ⚠️  Cannot verify (offline or token expired)");
    }
  } else {
    console.log("No project linked. Run: pnpm railway:link");
  }
}

async function cmdInspect(args) {
  requireToken();
  const projectId = requireLinkedProjectId();
  const asJson = parseJsonFlag(args);

  const query = `
    query InspectProject($id: String!) {
      project(id: $id) {
        id
        name
        description
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
        services {
          edges {
            node {
              id
              name
              serviceInstances {
                edges {
                  node {
                    id
                    environmentId
                    serviceId
                    domains {
                      customDomains {
                        id
                        domain
                      }
                      serviceDomains {
                        id
                        domain
                      }
                    }
                    latestDeployment {
                      id
                      status
                      createdAt
                      staticUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const { project } = await gql(query, { id: projectId });
  if (!project) {
    console.error("Linked Railway project could not be loaded.");
    exit(1);
  }

  const environments =
    project.environments?.edges?.map(({ node }) => ({
      id: node.id,
      name: node.name,
    })) || [];

  const services =
    project.services?.edges?.map(({ node }) => ({
      id: node.id,
      name: node.name,
      instances:
        node.serviceInstances?.edges?.map(({ node: instance }) => ({
          id: instance.id,
          environmentId: instance.environmentId,
          serviceId: instance.serviceId,
          customDomains: instance.domains?.customDomains || [],
          generatedDomains: instance.domains?.serviceDomains || [],
          latestDeployment: instance.latestDeployment || null,
        })) || [],
    })) || [];

  const summary = {
    project: {
      id: project.id,
      name: project.name,
      description: project.description || "",
    },
    linked: readProjectLink(),
    environments,
    services,
  };

  if (asJson) {
    print(summary, true);
    return;
  }

  console.log(`Project: ${summary.project.name} (${summary.project.id})`);
  if (summary.linked?.environmentName) {
    console.log(`Linked environment: ${summary.linked.environmentName} (${summary.linked.environmentId || "unknown"})`);
  }
  if (environments.length) {
    console.log("Environments:");
    for (const environment of environments) {
      console.log(`  - ${environment.name} (${environment.id})`);
    }
  }
  if (services.length) {
    console.log("Services:");
    for (const service of services) {
      console.log(`  - ${service.name} (${service.id})`);
      for (const instance of service.instances) {
        console.log(`      instance ${instance.id} env=${instance.environmentId}`);
        for (const domain of instance.customDomains) {
          console.log(`        custom ${domain.domain}`);
        }
        for (const domain of instance.generatedDomains) {
          console.log(`        generated ${domain.domain}`);
        }
        if (instance.latestDeployment) {
          console.log(
            `        latest ${instance.latestDeployment.status} ${instance.latestDeployment.id} ${instance.latestDeployment.createdAt}`,
          );
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case "login":
      return cmdLogin();
    case "whoami":
      return cmdWhoami();
    case "list":
    case "ls":
      return cmdList();
    case "link":
      return cmdLink();
    case "status":
      return cmdStatus();
    case "inspect":
      return cmdInspect(args.slice(1));
    case "help":
    case "--help":
    case "-h":
      console.log(`Railway CLI wrapper (GQL)
Usage: pnpm railway <command>

Commands:
  login      Verify token & show user info
  whoami     Show current user/project
  list|ls    List projects
  link       Link current directory to a project
  status     Show linked project status
  inspect    Show linked project environments, services, domains, and latest deployments
  logs       (falls through to native railway)
  deploy     (falls through to native railway)

Unlisted commands fall through to the native railway binary.`);
      return;
    default:
      // Fall through to native railway binary
      fallthrough(args);
  }
}

function fallthrough(args) {
  const localBin = resolve(__dirname, "../../../node_modules/@railway/cli/bin/railway");
  const globalBin = resolve(
    env.HOME || "/home/csaba",
    ".local/share/pnpm/global/v11/11fb4-19e83ceb034/node_modules/@railway/cli/bin/railway",
  );
  const bin = existsSync(localBin) ? localBin : globalBin;

  try {
    execFileSync(bin, args, { stdio: "inherit" });
  } catch {
    exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  exit(1);
});
