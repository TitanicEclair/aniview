# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-10

### Added

- `Aniview` — core animated component with spatial and event-driven keyframes
- `AniviewProvider` — context provider with gesture handling and spring physics
- `AniviewConfig` — 2D grid layout engine with page mapping, overlaps, and adjacency graphs
- `AniviewPanel` / `PanelFrame` — pre-styled panel components
- `useAniview` — hook to access Aniview context (dimensions, events, config)
- `useAniviewLock` — hook for directional gesture locking
- Smart color interpolation (transparent-aware, no gray artifacts)
- Pre-computed animation grid (zero runtime frame searches)
- Worklet-optimized rendering (UI thread only)
- Full TypeScript type definitions
