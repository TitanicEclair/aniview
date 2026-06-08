# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-09

### Added

- `parentGestureRef` in context — child gesture coexistence with Aniview page swiping via `simultaneousWithExternalGesture`.
- `currentPageSV` in context — UI-thread page awareness for worklet-driven page indicators.
- `BakedLane` and `BakedResult` types exported for consumers.
- `IAniviewConfig` extended with `layout`, `registerLayout`, `getLayout` methods.
- `LOCAL_DEV.md` — guide for testing Aniview from a consumer app with Metro module de-duplication.
- Regression tests for frame baking (12) and color interpolation (68), totaling 129 tests (up from 50).

### Changed

- **Aniview.tsx refactored from 994 to 207 lines** — color, bake, style, and gesture logic extracted to focused `src/core/` modules (`AniviewColor`, `AniviewBake`, `AniviewStyle`, `AniviewGesture`, `AniviewStyleUtils`).
- `simultaneousHandlers` typed as `RefObject<GestureType> | RefObject<GestureType>[]` (was `any`).
- `AniviewLock.mask()` and `useAniviewLock` helpers are now worklet-safe.
- Deduplicated hex/hsl color parser into shared `parseColorToChannels()`.
- `BakedLane.persistent` renamed to `eventPersistent` for clarity.
- Dev dependencies bumped to latest: RNGH 3.0, Reanimated 4.4, Worklets 0.9.

### Fixed

- Removed most `config as any` casts (7→2, only intentional private methods remain).
- `prepare` script handles missing Reanimated gracefully.
- Homepage documentation links fixed on Docusaurus site.

## [1.0.1] - 2026-02-22

### Changed

- Documentation refreshed across Getting Started, Core Concepts, API Reference, and Docusaurus site.
- Snapshot test setup improved for current React test renderer.

### Fixed

- Directional lock-mask corrected to match provider gesture behavior.

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
