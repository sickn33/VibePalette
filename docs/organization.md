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
├── fonts/             # Bundled UI/export fonts
├── icons/             # Chrome Extension icons and source assets
├── lib/               # Third-party libraries (e.g., Color Thief)
├── tests/             # Automated test suites and real-image fixtures
├── background.js      # Chrome Extension background worker
├── color-utils.js     # Color conversion, naming, extraction, and ranking
├── export.js          # PNG/CSS/JSON/share export helpers
├── manifest.json      # Chrome Extension manifest
├── popup.html         # Extension popup interface
├── popup.js           # Main extension logic
├── settings.js        # Settings and palette history persistence
├── style.css          # Extension styling
├── CHANGELOG.md       # Release notes
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
- Added v2.0.0 release documentation, real-image fixtures, and runtime helper modules.

## How to Maintain

- Keep the root directory clean; only core extension files should reside there.
- All research and logs should go into `docs/`.
- New tests should follow the naming convention `[name].test.js` in `tests/`.
- Do not commit local goal files, debug logs, or `.agent/` browser artifacts.
