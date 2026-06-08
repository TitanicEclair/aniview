---
id: documentation-maintenance
slug: /documentation-maintenance
title: Documentation Maintenance
---

# Documentation Maintenance

This page defines how Aniview documentation should stay useful and accurate as the library changes. It is intended for maintainers and contributors, not as an introduction for package users.

## Structure

Aniview documentation is organized by reader intent:

| Type | Reader question | Aniview pages |
| --- | --- | --- |
| Getting started | How do I get a working setup quickly? | Getting Started |
| Task guides | How do I solve a specific problem? | Advanced Patterns, Examples, Gesture Control, Testing |
| API details | What exactly is available? | API Reference |
| Concept guides | How does this system work? | Core Concepts, Performance Guide |

Avoid mixing these purposes. API Reference should be terse and complete. Core Concepts can explain tradeoffs. Getting Started should keep moving and avoid implementation detail.

## Accuracy Rules

- Public API documentation must match `src/index.ts` exports.
- Prop tables must match the interfaces in `src/aniviewProvider.tsx`, `src/Aniview.tsx`, `src/useAniviewContext.tsx`, and `src/useAniviewLock.tsx`.
- Installation instructions must match `package.json` peer dependencies unless a specific React Native or Expo version requires an extra package.
- Examples must import every symbol they use.
- Do not link to example files unless they exist in the repository.
- When a behavior is implementation-specific, name it that way. Do not present internal caches, worklet details, or performance claims as a stable public contract.

## Update Checklist

When changing Aniview behavior, update docs in the same PR:

- [ ] README still has a runnable minimal example.
- [ ] Getting Started still matches the current install and provider setup.
- [ ] API Reference includes any new props, hook return values, or exported types.
- [ ] Core Concepts still describes the current architecture accurately.
- [ ] Gesture Control matches the current lock/toggle behavior.
- [ ] `docs/` and `website/docs/` are synced.
- [ ] `npm test` and `npm run build` pass.
