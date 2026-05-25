# AI Interaction Guidelines

## P-1 Communication Patterns

### S-1 User Request Structure
- Prefers short, direct prompts
- Values minimal screen estate (concise output)
- Expects explicit git workflow requests (stage, push, PR)
- Prefers actionable output over explanations

### S-2 AI Interpretation Patterns
- Assumes context from file review before action
- Prefers inline editing over verbose explanations
- Validates changes with lint/type checks when possible

### S-3 Effective Workflow Pattern
1. User request
2. AI reviews relevant files
3. AI makes focused changes
4. AI runs validation
5. AI provides one-sentence summary

---

## P-2 GitHub Workflow Expectations

### S-1 Expected Flow
```text
git status --short --branch
Precommit gate runs (validation + build)
Commit changes
Push beta
Create PR main
Wait for auto-merge
Check dist branch workflow
Final status report
```

### S-2 Common Points of Confusion
- Precommit gate timing out on `prod:build`
- Dist branch publication timing
- Merge vs push behavior

---

## P-3 Development Communication Best Practices

### S-1 What User Wants to See
- Minimal output during processes
- Clear success/failure indicators
- One-sentence final summary

### S-2 What User Doesn't Want
- Verbose explanations
- Multiple confirmation prompts
- Uncertainty language ("should", "might")

---

## [suggestions]

### File Implementation Suggestions
T-278: Add common command patterns for git workflows
T-279: Include timeout handling patterns for long-running commands

### Tasks
T-280: Expand analysis to include file-based interaction patterns
T-281: Add template prompts for common development tasks