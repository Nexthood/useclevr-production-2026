# Planning Mode Structure

This directory contains a planning mode structure for organizing work according to the specified requirements:

## Structure Overview

```
.planning-mode/
├── base-project-root/
│   ├── level-0/
│   │   ├── preparation/    # Work preparation (excludes AI instructions)
│   │   │   ├── branch-base-project-root/   # Phase 1 work on base project root structure
│   │   │   ├── branch-todo-model-root/     # Phase 1 work on todo management system
│   │   │   └── branch-dot-files-root/      # Phase 1 work on dotfiles and configuration
│   │   ├── docs/           # Documentation (handled last explicitly)
│   │   └── config/         # Level-specific configuration
│   ├── level-1/
│   │   ├── preparation/
│   │   ├── docs/
│   │   └── config/
│   └── level-2/
│       ├── preparation/
│       ├── docs/
│       └── config/
├── todo-model/
│   ├── root/               # Todo management root
│   └── branch/             # Todo management branch (model)
└── dot-files-root/
    ├── dotfiles/           # Dotfiles collection
    └── config/             # Dotfiles and config
```

## Principles Implemented

1. **Base Project Root with Levels**: The base-project-root contains levels (0, 1, 2) as preparation for branches
2. **Levels Leave Docs to the End**: Each level has docs explicitly separated and marked as handled last
3. **Levels Exclude AI Instructions**: Preparation phases do not include AI instructions (those would come later in the process)
4. **Todo Management Has Own Root/Branch**: Structured as root → branch (model)
5. **Dot-Files Root**: Dedicated structure for dotfiles and configuration
6. **Config for Each Level**: Each level has its own configuration directory
7. **Branch Phase 1 in Phase 0**: New branch work starts in phase 0 preparation folders with branch- prefix and -root suffix

## Usage

This structure is for planning purposes only and does not interfere with the actual project structure in the repository root. Use this to organize thoughts, phases, and preparation work before implementing changes in the actual codebase.

Each level's preparation directory should contain the work that needs to be done at that stage, explicitly deferring documentation to the docs directory and keeping AI instructions out of the preparation phase as requested.

Branch work for phase 1 begins in the level-0 preparation folder using the naming convention:
- branch-base-project-root
- branch-todo-model-root  
- branch-dot-files-root
