# Contributing to Aniview

Thanks for helping improve Aniview. This project is a React Native library, so useful contributions usually fall into one of four categories: runtime behavior, gesture coordination, animation/style baking, and documentation accuracy.

## Before You Start

- Check existing issues and pull requests before opening a duplicate.
- Keep changes focused. A small fix with tests is easier to review than a broad refactor.
- Update documentation when public behavior, props, exports, installation steps, or examples change.
- Do not include dependency lockfile churn unless the dependency change is intentional.

## Development Setup

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- A React Native development environment if you are testing inside an app

### Install

```bash
git clone https://github.com/TitanicEclair/aniview.git
cd aniview
npm install
```

### Local Consumer App Testing

When testing Aniview from another React Native app, use the local development guide:

```text
LOCAL_DEV.md
```

That guide explains how to use a `file:` dependency without bundling duplicate copies of React Native, Reanimated, Gesture Handler, or Worklets.

## Project Structure

```text
aniview/
├── src/
│   ├── Aniview.tsx              # Main animated view
│   ├── aniviewProvider.tsx      # Provider, camera, gestures, context
│   ├── aniviewConfig.tsx        # Page layout and navigation config
│   ├── useAniview.tsx           # Context/component hook
│   ├── useAniviewLock.tsx       # Gesture lock helper
│   ├── useAniviewContext.tsx    # Public types and context
│   └── core/                    # Baking, style, color, gesture, math logic
├── src/__tests__/               # Jest tests
├── __mocks__/                   # Jest mocks for native dependencies
├── docs/                        # Markdown documentation
├── website/                     # Docusaurus documentation site
├── README.md
├── CHANGELOG.md
└── LOCAL_DEV.md
```

## Commands

```bash
npm test          # Run Jest
npm run build     # Build distributable TypeScript output
npm run lint      # Type-check without emitting files
```

For the Docusaurus site:

```bash
cd website
npm install
npm run build
```

## Pull Requests

1. Create your branch from the current development branch.
2. Make the smallest change that solves the problem.
3. Add or update tests for behavior changes.
4. Update docs for public API or behavior changes.
5. Run `npm test`, `npm run build`, and `npm run lint`.
6. If docs changed, run `npm run build` inside `website/`.
7. Open a pull request with a clear summary and verification steps.

## Testing Guidance

Aniview uses Jest with manual mocks for native React Native dependencies:

- `__mocks__/react-native.js`
- `__mocks__/react-native-reanimated.js`
- `__mocks__/react-native-gesture-handler.js`

Test observable behavior, not private implementation details. Prefer tests around:

- page offset and layout calculations
- frame baking output for spatial and event frames
- color interpolation behavior
- lock-mask behavior
- snapshot stability for the rendered animated layout

If a change affects native gesture behavior, also verify it in a real React Native app.

## Documentation Standards

Documentation should be accurate, runnable, and package-oriented.

- Installation instructions must match `package.json` peer dependencies.
- Examples must import every symbol they use.
- Public API docs must match `src/index.ts` exports and the public TypeScript interfaces.
- `docs/` and `website/docs/` should stay in sync.
- Keep maintainer-only process details out of the first user-facing docs path.
- Do not document internal caches, private helpers, or performance behavior as stable public contracts.

When changing public behavior, check at least:

- `README.md`
- `docs/01-getting-started.md`
- `docs/03-api-reference.md`
- `docs/08-gesture-control.md` if gestures or locks changed
- `CHANGELOG.md`
- matching files under `website/docs/`

## Coding Standards

Use TypeScript types for public and shared functions. Avoid broad `any` unless the value crosses a React Native/Reanimated boundary where the exact type is not practical.

Prefer small, focused helpers in `src/core/` for logic that can be tested without rendering React components.

Comments should explain why a non-obvious implementation exists. Avoid comments that restate the line below them.

## Performance Considerations

Aniview is designed around precomputed animation data and Reanimated worklets. Performance-sensitive changes should avoid:

- repeated frame searches on every render
- unnecessary style parsing in animated worklets
- extra React re-renders during camera movement
- preventable remounting of persistent animated surfaces

If a change affects baking, interpolation, gestures, or virtualization, include a short note in the PR explaining the performance impact.

## Commit Messages

Use clear conventional-style prefixes where they fit:

```text
feat: add event frame behavior
fix: correct directional lock mask
docs: update gesture guide
test: cover transparent color interpolation
refactor: split style baking helpers
chore: update build configuration
```

## Release Process

Maintainers handle releases.

1. Update `CHANGELOG.md`.
2. Bump `package.json` and `package-lock.json`.
3. Run `npm test`, `npm run build`, and `npm run lint`.
4. Build the website if documentation changed.
5. Create a git tag, for example `v1.0.2`.
6. Publish to npm.
7. Create or update the GitHub release notes.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
