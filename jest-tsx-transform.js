/**
 * Custom Jest transform using tsx (esbuild-based TypeScript compiler).
 * This avoids needing ts-jest or babel presets as separate dependencies.
 */
const { execSync } = require('child_process');
const crypto = require('crypto');

module.exports = {
  process(sourceText, sourcePath) {
    // Strip 'worklet' directives which are not needed in Node
    const cleaned = sourceText.replace(/'worklet';/g, '// worklet (stripped for testing)');
    
    // Use esbuild (via tsx's bundled esbuild) to strip types
    let esbuild;
    try {
      esbuild = require('esbuild');
    } catch {
      // tsx bundles esbuild internally — resolve through tsx
      const tsxPath = require.resolve('tsx');
      const esbuildPath = require('path').join(
        require('path').dirname(tsxPath),
        '..', 'node_modules', 'esbuild'
      );
      esbuild = require(esbuildPath);
    }

    const result = esbuild.transformSync(cleaned, {
      loader: sourcePath.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'cjs',
      target: 'node18',
      sourcemap: 'inline',
      sourcefile: sourcePath,
    });

    return { code: result.code, map: null };
  },
  getCacheKey(sourceText, sourcePath) {
    return crypto
      .createHash('md5')
      .update(sourceText)
      .update(sourcePath)
      .digest('hex');
  },
};
