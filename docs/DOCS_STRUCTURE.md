# Documentation Structure

Use this map to choose the right document location. The goal is one clear home per audience and purpose.

## Top-Level Areas

| Area | Audience | Use |
| --- | --- | --- |
| [User_Guides](User_Guides/README.md) | End users | Product workflows, user-facing explanations, and help guidance. |
| [Developer_Guides](Developer_Guides/README.md) | Developers and coding agents | Setup, architecture, deployment, workflow, validation, and implementation guides. |
| [AI-interaction](AI-interaction/README.md) | Users, developers, and AI agents | AI collaboration rules, prompt library, learning traces, and instruction governance. |
| [Sales](Sales/README.md) | Sales, marketing, and project stakeholders | Sales project documents, project-management artefacts, marketing plan, risks, issues, and lessons. |

## Placement Rules

- Put user-facing how-to content in `docs/User_Guides/`.
- Put implementation, deployment, GitHub, package, TODO, and validation guidance in `docs/Developer_Guides/`.
- Put AI prompt patterns, trace-learning rules, and durable AI instruction maintenance in `docs/AI-interaction/`.
- Put sales material, project brief, business case, stage plan, risk register, issue register, lessons log, stakeholder communications, and marketing plan in `docs/Sales/`.
- Put active implementation tasks in `.TODO/todo-next.md`.
- Put migration prompts and deferred implementation plans in `.TODO/` when they are not permanent docs.

## Naming Rules

- Use lowercase folder names only when creating new AI-interaction subfolders.
- Keep existing `Developer_Guides` and `User_Guides` names until a deliberate full migration is scheduled.
- Avoid duplicate folders that differ only by case or pluralisation.
- Use README files as folder indexes.
- Keep filenames descriptive and stable.

## Current Known Boundaries

- `docs/AI-interaction/sales/` contains AI collaboration guidance for sales work.
- `docs/Sales/` contains actual sales and project documents.
- `docs/AI-interaction/prompt-library/` contains reusable prompts.
- `.TODO/todo-migration-payplod.md` contains the future Payload migration prompt and task plan.

## Future Cleanup Candidates

- Move `Developer_Guides` to `developer-guides` only if all links and automation are updated in one controlled pass.
- Move `User_Guides` to `user-guides` only if all links and automation are updated in one controlled pass.
- Split `Developer_Guides` into setup, deployment, workflow, product-implementation, and validation subfolders only when the flat list becomes hard to maintain.
