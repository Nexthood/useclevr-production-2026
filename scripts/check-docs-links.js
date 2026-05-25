#!/usr/bin/env node
import { execFileSync } from "node:child_process";

execFileSync("node", ["./scripts/docs/check-docs.cjs"], { stdio: "inherit" });
