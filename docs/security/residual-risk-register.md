# Residual Risk Register

Approved temporary residual risks that remain after dependency hardening.
These advisories are blocked from remediation by the current dependency owner's
exact version pins and must not be suppressed globally.

## Approval

- **Decision**: Keep Payload family at `3.85.1`
- **Rationale**: Payload `3.88.0` caused confirmed production HTTP 500 regression on `test.useclevr.com`. Forcing untested transitive dependency overrides is not approved.
- **Review trigger**: Re-evaluate when Payload publishes a `3.85.x` or `3.88.x` release that updates `undici` and `image-size` within declared compatible ranges.

## Approved Residual Advisories

### 1. undici GHSA-vmh5-mc38-953g

- **Advisory**: [GHSA-vmh5-mc38-953g](https://github.com/advisories/GHSA-vmh5-mc38-953g)
- **Vulnerable package/version**: `undici@7.24.4`
- **Vulnerable range**: `>=7.23.0 <7.28.0`
- **Patched version required**: `>=7.28.0`
- **Payload dependency path**: `payload@3.85.1 > undici`
- **Production exposure**: Low. `undici` is used internally by Payload for HTTP operations. The application does not expose SOCKS5 proxy functionality or direct `undici` client APIs to end users.
- **Existing mitigations**:
  - Payload runs server-side only; client bundles do not include `undici`.
  - No user-controlled proxy configuration is accepted by the application.
  - TLS termination is handled by Railway/Vercel edge infrastructure.
- **Reason deferred**: `payload@3.85.1` declares `undici` as exact version `7.24.4`. The required patch (`>=7.28.0`) is outside the declared range. `payload@3.85.2` updates to `7.28.0`, but Payload `3.88.0` caused production regression. No compatible owner patch exists within the approved `3.85.1` baseline.
- **Future remediation trigger**: Payload releases `3.85.3+` or `3.88.x` with `undici >=7.29.0` and passes production regression testing.

### 2. undici GHSA-vxpw-j846-p89q

- **Advisory**: [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q)
- **Vulnerable package/version**: `undici@7.24.4`
- **Vulnerable range**: `>=7.0.0 <7.28.0`
- **Patched version required**: `>=7.28.0`
- **Payload dependency path**: `payload@3.85.1 > undici`
- **Production exposure**: Low. WebSocket client fragment count bypass requires direct `undici` WebSocket client usage, which the application does not expose.
- **Existing mitigations**:
  - Server-side only dependency.
  - No WebSocket client APIs exposed to users.
- **Reason deferred**: Same as GHSA-vmh5-mc38-953g. Exact pin in `payload@3.85.1` prevents safe override.
- **Future remediation trigger**: Same as GHSA-vmh5-mc38-953g.

### 3. undici GHSA-hm92-r4w5-c3mj

- **Advisory**: [GHSA-hm92-r4w5-c3mj](https://github.com/advisories/GHSA-hm92-r4w5-c3mj)
- **Vulnerable package/version**: `undici@7.24.4`
- **Vulnerable range**: `>=7.23.0 <7.28.0`
- **Patched version required**: `>=7.28.0`
- **Payload dependency path**: `payload@3.85.1 > undici`
- **Production exposure**: Low. Cross-origin request routing via SOCKS5 proxy pool reuse requires proxy agent configuration not present in the application.
- **Existing mitigations**:
  - No SOCKS5 proxy configuration in application code.
  - Server-side only dependency.
- **Reason deferred**: Same as GHSA-vmh5-mc38-953g.
- **Future remediation trigger**: Same as GHSA-vmh5-mc38-953g.

### 4. undici GHSA-4cwx-7wf7-3272

- **Advisory**: [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272)
- **Vulnerable package/version**: `undici@7.24.4`
- **Vulnerable range**: `>=7.0.0 <7.29.0`
- **Patched version required**: `>=7.29.0`
- **Payload dependency path**: `payload@3.85.1 > undici`
- **Production exposure**: Low. Cross-user information disclosure via degenerate private cache directives requires specific cache header handling not used by the application's request patterns.
- **Existing mitigations**:
  - Application does not rely on `undici` private cache directives.
  - Server-side only dependency.
- **Reason deferred**: Same as GHSA-vmh5-mc38-953g. Required patch is `>=7.29.0`, further beyond the exact pin.
- **Future remediation trigger**: Same as GHSA-vmh5-mc38-953g.

### 5. image-size GHSA-w3rx-r6r6-pgpr

- **Advisory**: [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)
- **Vulnerable package/version**: `image-size@2.0.2`
- **Vulnerable range**: `<=2.0.2`
- **Patched version required**: `>=2.0.3`
- **Payload dependency path**: `payload@3.85.1 > image-size`
- **Production exposure**: Low. ICNS parser infinite loop requires uploading malicious ICNS image files through Payload media handling. The application does not accept ICNS uploads from untrusted users in normal operation.
- **Existing mitigations**:
  - Media uploads are authenticated and owner-restricted.
  - ICNS format is not a supported user upload format.
  - Payload media processing runs server-side with file size limits.
- **Reason deferred**: `payload@3.85.1` declares `image-size` as exact version `2.0.2`. No `3.85.x` release updates `image-size` to `2.0.3`.
- **Future remediation trigger**: Payload releases `3.85.3+` or `3.88.x` with `image-size >=2.0.3` and passes production regression testing.

### 6. image-size GHSA-5p2g-fcmc-qvqq

- **Advisory**: [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
- **Advisory**: [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
- **Vulnerable package/version**: `image-size@2.0.2`
- **Vulnerable range**: `<=2.0.2`
- **Patched version required**: `>=2.0.3`
- **Payload dependency path**: `payload@3.85.1 > image-size`
- **Production exposure**: Low. JXL and HEIF parser infinite loops require uploading malicious JXL/HEIF files. These formats are not accepted by the application's upload validation.
- **Existing mitigations**:
  - Upload validation rejects unsupported formats.
  - Authenticated owner-only media uploads.
  - Server-side processing with memory/time limits.
- **Reason deferred**: Same as GHSA-w3rx-r6r6-pgpr. Exact pin prevents safe override.
- **Future remediation trigger**: Same as GHSA-w3rx-r6r6-pgpr.

## Non-Payload Known Deferred HIGH

### 7. d3-color GHSA-36jr-mh4h-2g58

- **Advisory**: [GHSA-36jr-mh4h-2g58](https://github.com/advisories/GHSA-36jr-mh4h-2g58)
- **Vulnerable package/version**: `d3-color@1.0.2` (via `react-simple-maps` / `d3-scale`)
- **Vulnerable range**: `>=1.0.2 <3.1.0`
- **Patched version required**: `>=3.1.0`
- **Production exposure**: Low. ReDoS in color string parsing requires user-controlled input reaching `d3-color` regex. The application uses `d3-color` indirectly through visualization libraries with static configuration.
- **Existing mitigations**:
  - No user-controlled color strings are parsed through `d3-color`.
  - Visualization inputs are sanitized dataset values, not regex-driven color parsers.
- **Reason deferred**: Out of scope per security directive. `react-simple-maps` / `d3` ecosystem is excluded from current remediation scope.
- **Future remediation trigger**: Separate approved task for `d3` ecosystem upgrade.

## CI Allowlist

The CI pipeline uses `scripts/security/audit-allowlist.cjs` to enforce that:
- The 6 approved Payload residual advisories above do not fail CI.
- Any NEW Critical or High advisory fails CI immediately.
- Unknown vulnerabilities are never suppressed.

Approved residual advisory IDs:
- `GHSA-vmh5-mc38-953g`
- `GHSA-vxpw-j846-p89q`
- `GHSA-hm92-r4w5-c3mj`
- `GHSA-4cwx-7wf7-3272`
- `GHSA-w3rx-r6r6-pgpr`
- `GHSA-5p2g-fcmc-qvqq`
- `GHSA-36jr-mh4h-2g58`
