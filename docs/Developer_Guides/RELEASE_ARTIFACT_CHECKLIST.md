# Release Artifact Checklist

Use this checklist before attaching CI outputs to a GitHub Release.

## Include

- Source validation summary when it proves the release branch passed required checks.
- Generated deployment manifest when it identifies source commit, build time, runtime version, and health path.
- Security or audit reports only when they contain no secrets and are useful to operators.
- User-facing release notes copied from the changelog.

## Exclude

- Raw environment dumps, secrets, tokens, database URLs, and provider keys.
- Generated build folders, dependency caches, and local machine logs.
- Files from ignored generated output unless the release specifically documents deployment output.

## Decision Rule

Attach an artifact only when it helps a maintainer verify, deploy, or rollback the release.
