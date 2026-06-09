# AI Development Tools Installation Guide

This document describes the installation and configuration of three free AI development tools:
- Kodu AI (MCP-native coding assistant)
- Continue.dev (open-source AI coding assistant)
- Zed (AI-powered editor)

## Installation Summary

| Tool | Installation Path | Version | Status |
|------|-------------------|---------|--------|
| Kodu AI | `~/.local/share/pnpm/bin/kodu` | 2.1.3 | ✅ Installed |
| Continue.dev | `~/.vscode/extensions/continue.continue-1.2.22/` | 1.2.22 | ✅ Installed |
| Zed | `~/.local/zed/` | v1.5.4 | ✅ Installed |

## 1. Kodu AI

**Installation Method:** `pnpm add -g kodu`

**Version:** 2.1.3

**Capabilities:**
- Code review automation
- Context preparation for LLMs
- Commit message drafting
- Comment removal

**Usage:**
```bash
kodu pack          # Collect project context into a single file
kodu init          # Initialize kodu configuration
kodu clean         # Remove comments from code
```

**MCP Server (T-Kodu):**
- Binary: `~/.local/share/pnpm/bin/tkodu-local`
- Command: `tkodu-local init` then `tkodu-local start`
- Config: `~/.continue/config.ts`

## 2. Continue.dev

**Installation Method:** VSIX from GitHub releases

**Version:** 1.2.22

**Configuration Files:**
- `~/.continue/config.yaml` - Main configuration with model providers
- `~/.continue/.continuerc.json` - Continue-specific settings

**Configured Models:**
- Ollama (local): `phi3:mini`
- Gemini: `gemini-2.0-flash-exp`, `gemini-1.5-flash`

**VS Code Integration:**
- Extension auto-activates on restart
- Use `Ctrl+L` to select code for context
- Use `Ctrl+I` for edit mode

## 3. Zed Editor

**Installation Method:** Manual tarball extraction to `~/.local/zed`

**Version:** v1.5.4

**Configuration File:**
- `~/.config/zed/settings.json`

**Features Enabled:**
- Edit prediction
- Inline completion
- Ollama model integration

**Launch:**
```bash
zed /path/to/project    # Open project in Zed
zed --help              # Show CLI help
```

## Model Credentials

**Available Models:**
- Local Ollama: `phi3:mini` (2.2 GB, already downloaded)
- Cloud Gemini API: Key configured in project `.env.local`

**VS Code MCP Configuration:**
- File: `~/.config/Code/User/mcp.json`
- Registered servers: Neon, T-Kodu

**To Start Using:**
1. Restart VS Code to activate Continue extension and MCP servers
2. Run `ollama serve` for local model access
3. Launch Zed with `zed /home/csaba/Documents/Useclever-2026`