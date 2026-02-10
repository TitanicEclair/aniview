/**
 * Jest configuration for Aniview unit tests.
 *
 * Test groups can be toggled via environment flags:
 *   ANIVIEW_TEST_MATH=1     — AniviewMath pure functions
 *   ANIVIEW_TEST_LOCK=1     — AniviewLock bitmask logic
 *   ANIVIEW_TEST_CONFIG=1   — AniviewConfig class methods
 *   ANIVIEW_TEST_ALL=1      — Run everything (default when no flags set)
 *
 * Usage:
 *   npm test                                        # runs all tests
 *   $env:ANIVIEW_TEST_MATH="1"; npm test            # PowerShell: math only
 *   npx jest --testPathPattern=AniviewMath           # jest CLI filter
 */

const groups = {
  math:   process.env.ANIVIEW_TEST_MATH   === '1',
  lock:   process.env.ANIVIEW_TEST_LOCK   === '1',
  config: process.env.ANIVIEW_TEST_CONFIG === '1',
};

const anyFlagSet = Object.values(groups).some(Boolean);
const runAll = process.env.ANIVIEW_TEST_ALL === '1' || !anyFlagSet;

// Exclude disabled test groups via testPathIgnorePatterns
const ignoredPatterns = ['/node_modules/'];
if (!runAll && !groups.math)   ignoredPatterns.push('AniviewMath\\.test');
if (!runAll && !groups.lock)   ignoredPatterns.push('AniviewLock\\.test');
if (!runAll && !groups.config) ignoredPatterns.push('aniviewConfig\\.test');

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ignoredPatterns,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    // Use tsx (esbuild-based) which is already installed in the monorepo
    '^.+\\.tsx?$': ['<rootDir>/jest-tsx-transform.js'],
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
    '^react-native-gesture-handler$': '<rootDir>/__mocks__/react-native-gesture-handler.js',
  },
};
