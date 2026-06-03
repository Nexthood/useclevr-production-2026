# Security Policy

## Supported Versions
Use this section to tell people which versions of your project are currently being supported with security updates.

| Version | Supported |
| ------- | --------- |
| 5.x     | ✅        |
| < 5.x   | ❌        |

## Reporting a Vulnerability
We take the security of UseClevr seriously. If you believe you have found a security vulnerability in this project, please report it as described.

**Do not report security vulnerabilities through public GitHub issues.**

Instead, report via email to the project maintainer. Expect response within 72 hours. If no response, follow up via another channel.

### What to include
- Issue type (e.g., exposed secret, SQL injection, authentication bypass)
- Clear description and reproduction steps
- Relevant logs or screenshots
- Affected version(s)
- Suggested fix (if any)

## Secret Handling

- Store credentials in local or hosting environment variables.
- Use placeholders in documentation, prompts, TODOs, traces, and examples.
- Run `pnpm lint:secrets` before pushing changes that touch docs, prompts, deployment notes, or credential setup.
- Rotate any credential that appears in committed text, logs, screenshots, or AI chat context.

## Safe Harbour
We will not initiate legal action against researchers who discover and report security vulnerabilities in good faith.
