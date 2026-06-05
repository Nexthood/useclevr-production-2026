#!/usr/bin/env node
import { execFileSync } from "node:child_process";

import { resolveRepoPath } from "./lib/app-config.js";

execFileSync("node", [resolveRepoPath("scripts", "docs", "check-docs.cjs")], { stdio: "inherit" });
