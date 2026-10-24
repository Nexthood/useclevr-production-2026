import { runWorkflowSafetyTests } from "./test-release-safety.mjs";

runWorkflowSafetyTests().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Workflow safety test failed");
  process.exitCode = 1;
});
