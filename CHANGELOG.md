# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-09

### Added

- Core animation baking, color interpolation, gesture, and style helpers split into focused modules under `src/core/`.
- Regression tests for frame baking, color interpolation, lock masks, math helpers, and snapshots.
- Local development guide for testing Aniview from a consumer React Native app with Metro module de-duplication.

### Changed

- Refreshed README, Getting Started, Core Concepts, API Reference, Performance, Testing, Gesture Control, Reporting Issues, and Docusaurus docs to match the current public API.
- Updated development dependencies for the current React Native/Reanimated test setup.
- Improved snapshot test setup for the current React test renderer behavior.
- Clarified `persistent` component mounting versus `eventPersistent` event-frame weighting.

### Fixed

- Corrected directional lock-mask handling so `AniviewLock.mask({ left, right, up, down })` matches provider gesture behavior.
- Removed stale Docusaurus/template documentation language and broken documentation links.

## [1.0.0] - 2026-02-10

### Added

- `Aniview` — core animated component with spatial and event-driven keyframes
- `AniviewProvider` — context provider with gesture handling and spring physics
- `AniviewConfig` — 2D grid layout engine with page mapping, overlaps, and adjacency graphs
- `useAniview` — hook to access Aniview context (dimensions, events, config)
- `useAniviewLock` — hook for directional gesture locking
- Smart color interpolation (transparent-aware, no gray artifacts)
- Pre-computed animation grid (zero runtime frame searches)
- Worklet-optimized rendering (UI thread only)
- Full TypeScript type definitions
