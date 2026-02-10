# Contributing to Aniview

First off, thank you for considering contributing to Aniview! It's people like you that make Aniview such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** - Descriptive and specific
- **Steps to reproduce** - Minimal reproducible example
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Environment** - OS, React Native version, Aniview version
- **Screenshots/Videos** - If applicable

**Example:**

```markdown
## Bug: Colors turn gray during fade-out

### Steps to Reproduce

1. Create Aniview with backgroundColor: 'white'
2. Add frame with page transition to transparent
3. Swipe to navigate
4. Observe gray flash during transition

### Expected

Clean fade from white to transparent

### Actual

Midpoint shows gray color

### Environment

- iOS 17
- React Native 0.73
- Aniview 2.0.1
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use case** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternatives considered** - Other approaches?
- **Examples** - Code samples if applicable

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following the coding standards
3. **Add tests** if you've added code
4. **Update documentation** if you've changed APIs
5. **Ensure tests pass** - Run `npm test`
6. **Run linter** - `npm run lint`
7. **Submit PR** with clear description

## Development Setup

### Prerequisites

- Node.js >= 18
- npm >= 9
- React Native development environment

### Installation

```bash
git clone https://github.com/TitanicEclair/aniview.git
cd aniview
npm install
```

### Project Structure

```
aniview/
├── src/
│   ├── Aniview.tsx           # Main component
│   ├── aniviewProvider.tsx   # Context provider
│   ├── aniviewConfig.tsx     # Configuration engine
│   ├── useAniview.tsx        # Hooks
│   └── core/
│       └── AniviewMath.ts    # Mathematical utilities
├── docs/                     # Documentation
├── examples/                 # Example apps
└── __tests__/               # Test suite
```

### Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
```

### Building

```bash
npm run build         # Compile TypeScript
npm run lint          # Check code style
npm run typecheck     # Type validation
```

## Coding Standards

### TypeScript Style

```typescript
// ✅ Good
interface AniviewFrame {
  page?: number | string;
  style?: ViewStyle;
}

function calculateOffset(pageId: number): { x: number; y: number } {
  // ...
}

// ❌ Bad
interface aniview_frame {
  // Use PascalCase
  page?: any; // Avoid 'any'
}

function calc_offset(p) {
  // Use camelCase, add types
  // ...
}
```

### Component Patterns

```tsx
// ✅ Good: Functional component with explicit types
interface MyComponentProps {
  pageId: number;
  onPress?: () => void;
}

export function MyComponent({ pageId, onPress }: MyComponentProps) {
  // ...
}

// ❌ Bad: Default export, implicit types
export default function MyComponent(props: any) {
  // ...
}
```

### Worklet Usage

```typescript
// ✅ Good: Explicit 'worklet' directive
const animatedStyle = useAnimatedStyle(() => {
  "worklet";
  return { opacity: value.value };
});

// ❌ Bad: Missing 'worklet'
const animatedStyle = useAnimatedStyle(() => {
  return { opacity: value.value };
});
```

### Comments

```typescript
// ✅ Good: Explain WHY, not WHAT
// Pre-compute lanes to avoid O(n) search on every frame
const lanes = buildLanes(grid);

// ❌ Bad: Redundant
// Build lanes
const lanes = buildLanes(grid);
```

## Documentation Standards

### JSDoc for Public APIs

````typescript
/**
 * Calculates the world coordinate offset for a given page.
 *
 * @param pageId - Numeric page ID or semantic string name
 * @param dims - Current viewport dimensions
 * @returns Object containing x and y offset in pixels
 *
 * @example
 * ```tsx
 * const offset = config.getPageOffset('HOME', dimensions);
 * // => { x: 0, y: 0 }
 * ```
 */
public getPageOffset(
  pageId: number | string,
  dims: Dimensions
): { x: number; y: number } {
  // ...
}
````

### Markdown Documentation

- Use **clear headings** (H1 for title, H2 for sections)
- Include **code examples** for every feature
- Provide **before/after** comparisons
- Add **visual diagrams** where helpful

## Testing Guidelines

### Test Coverage Requirements

- **Core logic**: 90%+ coverage
- **Components**: 80%+ coverage
- **Utilities**: 95%+ coverage

### Test Structure

```typescript
describe("AniviewConfig", () => {
  // Setup
  const dims = { width: 430, height: 932, offsetX: 0, offsetY: 0 };

  describe("getPageOffset", () => {
    it("should return origin for page 0", () => {
      const config = new AniviewConfig([[1]], 0);
      expect(config.getPageOffset(0, dims)).toEqual({ x: 0, y: 0 });
    });

    it("should calculate horizontal offset", () => {
      const config = new AniviewConfig([[1, 1]], 0);
      expect(config.getPageOffset(1, dims)).toEqual({ x: 430, y: 0 });
    });
  });
});
```

### Test Best Practices

- ✅ Test **behavior**, not implementation
- ✅ Use **descriptive test names**
- ✅ Keep tests **isolated** (no shared state)
- ✅ Mock **only** external dependencies
- ❌ Don't test **internal** implementation details

## Performance Considerations

### Benchmarking

If your change affects performance, include benchmarks:

```typescript
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  myOptimizedFunction();
}
const duration = performance.now() - start;
console.log(`Average: ${duration / 1000}ms`);
```

### Performance Checklist

- [ ] Avoid O(n²) or worse algorithms
- [ ] Minimize worklet allocations
- [ ] Pre-compute where possible
- [ ] Use `useMemo` for expensive calculations
- [ ] Profile with React DevTools before/after

## Git Commit Messages

### Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code restructure (no feature/fix)
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

### Examples

```
feat(color): implement smart color interpolation

Prevents gray flash when transitioning from solid colors to transparent
by dynamically adjusting RGB channels while keeping alpha at 0.

Closes #42
```

```
fix(gesture): prevent diagonal navigation locks

When swiping slightly off-axis, the wrong axis could get locked.
Added minimum translation threshold before axis locking.

Fixes #67
```

## Release Process

Maintainers will handle releases. The process:

1. Update `CHANGELOG.md`
2. Bump version in `package.json`
3. Create git tag `vX.Y.Z`
4. Publish to npm
5. Create GitHub release

## Community

- **GitHub Discussions**: [Ask questions](https://github.com/TitanicEclair/aniview/discussions)
- **GitHub Issues**: [Report bugs](https://github.com/TitanicEclair/aniview/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Aniview! 🎉
