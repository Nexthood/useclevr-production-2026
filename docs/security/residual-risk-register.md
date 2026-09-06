# Residual Risk Register

Approved temporary residual risks that remain after dependency hardening.
These entries are specific advisory decisions and do not weaken the audit gate globally.

## Approval

- **Decision**: Keep the Payload package family aligned at stable `3.88.0`.
- **Rationale**: npm does not publish stable `payload@3.88.1` or matching `@payloadcms/*@3.88.1` packages. Payload `4.0.0-canary` is a breaking, non-stable major upgrade and is not approved for this security patch.
- **Review trigger**: Re-evaluate when Payload publishes a stable `3.x` release that clears `GHSA-jg8r-5jh2-v2xj` or when a separate approved Payload major-upgrade task is scheduled.

## Approved Residual Advisories

### 1. payload GHSA-jg8r-5jh2-v2xj

- **Advisory**: [GHSA-jg8r-5jh2-v2xj](https://github.com/advisories/GHSA-jg8r-5jh2-v2xj)
- **Vulnerable package/version**: `payload@3.88.0`
- **Vulnerable range**: `<=3.88.0`
- **Patched version required**: `>=3.88.1`
- **Dependency path**: direct root `payload` dependency and aligned `@payloadcms/*@3.88.0` peer dependency family
- **Production exposure**: Low. The advisory concerns Payload default account-unlock access. UseClevr exposes Payload administration only to authenticated CMS users, keeps media mutation access superadmin-gated when durable storage is configured, and disables MCP access to the `cms-users`, `media`, and `support-issues` Payload collections.
- **Existing mitigations**:
  - Payload admin routes require authentication.
  - UseClevr CMS user and operational collection access controls are defined in application code rather than relying on anonymous default access.
  - The Payload MCP plugin exposes only approved public-content collections and disables sensitive collections.
- **Reason deferred**: No stable patched `3.88.1` package exists on npm. Payload `4.0.0-canary` is not a safe compatible remediation path for this patch.
- **Temporary status**: Remove this entry when a stable patched Payload `3.x` release is available and passes Payload, upload, MCP, and app validation.

## Resolved Payload Transitive Advisories

Upgrading the complete Payload family from `3.85.1` to `3.88.0` removes the previously approved `undici` and `image-size` residual findings from the installed graph.

### image-size reachability assessment

- **Current package status**: `image-size` is not installed after the Payload `3.88.0` upgrade. Payload now uses `image-dimensions`.
- **Reachability**: Not reachable in the current dependency graph because no installed package resolves to `image-size`.
- **Accepted standard upload types**: Standard dataset uploads accept `.csv`, `.xlsx`, and `.xls` files after filename, MIME, size, and parser-structure validation.
- **Accepted accountancy upload types**: Accountancy receipt uploads accept `.pdf`, `.jpg`, `.jpeg`, `.png`, and `.webp`; they do not accept `.icns`, `.jxl`, `.heif`, or `.heic`.
- **Payload media path**: Payload media upload accepts `image/*`, but create, update, and delete access require `isCmsSuperAdmin` when durable storage is configured and are disabled when durable storage is unavailable.
- **Existing mitigation**: The attacker-controlled business-data upload paths reject ICNS, JXL, and HEIF/HEIC extensions before parser-heavy processing.
- **Residual entry**: None. The vulnerable `image-size@2.0.2` package is eliminated from the installed graph instead of allowlisted.

## Non-Payload Known Deferred HIGH

### 2. d3-color GHSA-36jr-mh4h-2g58

- **Advisory**: [GHSA-36jr-mh4h-2g58](https://github.com/advisories/GHSA-36jr-mh4h-2g58)
- **Vulnerable package/version**: `d3-color@2.0.0`
- **Vulnerable range**: `>=1.0.2 <3.1.0`
- **Patched version required**: `>=3.1.0`
- **Dependency path**: `react-simple-maps@3.0.0 > d3-zoom@2.0.0 > d3-interpolate@2.0.1 > d3-color@2.0.0`
- **Production exposure**: Low. ReDoS in color string parsing requires user-controlled input reaching D3 color parsing. UseClevr uses this path indirectly through map visualization libraries with application-controlled color configuration.
- **Existing mitigations**:
  - User datasets provide map data values, not arbitrary D3 color parser strings.
  - The vulnerable package is not used by upload, authentication, billing, Payload, or AI request routing.
- **Reason deferred**: `d3-interpolate@2.0.1` and `d3-transition@2.0.0` declare `d3-color` ranges `1 - 2`, so overriding to `3.1.0` would cross the parent packages' supported major range.
- **Temporary status**: Remove this entry through a separate approved D3/react-simple-maps upgrade or replacement task.

## CI Allowlist

The CI pipeline uses `scripts/security/audit-allowlist.cjs` to enforce that:

- The approved residual advisories above do not fail CI.
- Any new Critical or High advisory fails CI immediately.
- Unknown vulnerabilities are never suppressed.

Approved residual advisory IDs:

- `GHSA-jg8r-5jh2-v2xj`
- `GHSA-36jr-mh4h-2g58`
