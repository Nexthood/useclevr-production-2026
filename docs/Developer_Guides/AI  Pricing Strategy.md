# UseClevr AI Pricing and Usage Strategy

## Purpose

This is an internal implementation guide for the UseClevr app.

It defines how UseClevr should control Gemini API usage, protect margins, separate developer tools from production AI, and apply plan-based AI limits.

This document is not customer-facing documentation.

## Developer Tool Note

Antigravity and OpenCode are developer tools only.

They must not be used as production AI infrastructure.

The production UseClevr app must use its own Gemini API configuration with:

- request limits
- output token limits
- file size limits
- dataset summary caching
- usage logging
- plan-based AI quotas
- model routing

## Production Rule

Developer tools:

```txt
Antigravity + OpenCode
