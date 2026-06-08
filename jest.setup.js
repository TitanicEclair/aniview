
// This file is run before each test file.
// We use __mocks__ and moduleNameMapper for module mocking.
// Global polyfills can go here if needed.

// Silence console.log/warn/error if desired, or setup global variables.
global.__DEV__ = true;
global.IS_REACT_ACT_ENVIRONMENT = true;
