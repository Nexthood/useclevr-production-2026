#!/usr/bin/env node
import { execFileSync } from "node:child_process";

execFileSync("pnpm", ["outdated"], { stdio: "inherit" });
