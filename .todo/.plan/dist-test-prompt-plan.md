# Dist-Test Branch Prompt Plan

This document outlines the prompt to be used for setting up and validating the `dist-test` branch deployment.

## Goal

To ensure a functional and reliable deployment to `test.useclevr.com` by leveraging a Railway link to the `dist-test` branch, and to ensure `dist-root` configurations are compatible with both `dist` and `dist-branch` deployment strategies.

## Prompt for Agent

```
Please assist in setting up and validating the `dist-test` branch for deployment to `test.useclevr.com`.

**Key Tasks:**

1.  **Railway Configuration:**
    *   Ensure the Railway project is linked correctly to the `dist-test` branch of the GitHub repository.
    *   Verify that the Railway deployment process correctly utilizes the `nixpacks.toml` and other configuration files within the `dist-root/server-config` directory for the `dist-test` branch.

2.  **`dist-root` Adjustment:**
    *   Analyze the existing `dist-root` structure and scripts (`scripts/package-dist/create-dist.cjs`, `dist-root/server-config/railway.json`, `dist-root/server-config/vercel.json`) to identify any necessary adjustments.
    *   The goal is to ensure these scripts and configurations can gracefully handle deployments to both a `dist` folder (for the primary deployment branch, e.g., `main`) and a `dist-test` branch, without conflicts or unintended side effects.
    *   Specifically, ensure the `create-dist.cjs` script correctly generates the `dist` output for the `dist-test` environment.

3.  **Environment Variables:**
    *   Confirm that all required environment variables for `test.useclevr.com` are correctly configured in Railway for the `dist-test` branch. This includes, but is not limited to, database connections, API keys, and any domain-specific settings.

4.  **Deployment Verification:**
    *   Once deployed, perform a comprehensive verification of `test.useclevr.com`.
    *   Check core functionalities: user authentication, data upload, AI analysis, dashboard display, and report generation.
    *   Monitor application logs in Railway for any errors or warnings specific to the `dist-test` deployment.

5.  **Reporting:**
    *   Provide a concise report on the success or failure of the `dist-test` deployment, including any issues encountered and their resolutions.
    *   Confirm that `test.useclevr.com` is fully operational and meets all specified project requirements for a test environment.

Please proceed by first outlining your plan of action to address these tasks.
```
