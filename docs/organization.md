# Project Organization - VibePalette

The VibePalette project has been organized for better maintainability and clarity.

## Directory Structure

```text
VibePalette/
├── archives/          # Older version ZIPs (v1.1.0, v1.2.0)
├── docs/              # Project documentation, research, and progress logs
│   ├── findings.md    # Technical discoveries and research
│   ├── progress.md    # Session development log
│   └── task_plan.md   # Current and future task planning
├── icons/             # Chrome Extension icons and source assets
├── lib/               # Third-party libraries (e.g., Color Thief)
├── tests/             # Automated test suites (Vitest/JSDOM)
├── background.js      # Chrome Extension background worker
├── manifest.json      # Chrome Extension manifest
├── popup.html         # Extension popup interface
├── popup.js           # Main extension logic
├── style.css          # Extension styling
├── package.json       # Node.js dependencies and scripts
├── vitest.config.js   # Testing configuration
└── README.md          # Project overview
```

## Recent Cleanup Actions

- Created `archives/`, `docs/`, and `tests/` directories.
- Moved planning files into `docs/`.
- Moved test files into `tests/`.
- Moved versioned ZIP files into `archives/`.
- Relocated and consolidated icons.
- Updated `package.json` to reflect the new test structure.

## How to Maintain

- Keep the root directory clean; only core extension files should reside there.
- All research and logs should go into `docs/`.
- New tests should follow the naming convention `[name].test.js` in `tests/`.
