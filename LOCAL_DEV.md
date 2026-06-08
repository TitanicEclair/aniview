# Local Development

When developing Aniview alongside a consumer app, use a `file:` dependency
to link the local copy. This requires a Metro config in the consumer app
to prevent duplicate native module instances.

## Consumer App Setup

**1. Link to local Aniview** in the consumer app `package.json`:

```json
"aniview": "file:../aniview"
```

**2. Create `metro.config.js`** in the consumer app root:

```js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const exampleNM = path.resolve(__dirname, 'node_modules');

config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, '../aniview'),
];

config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /aniview[\\/]node_modules[\\/].*/,
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  aniview: path.resolve(__dirname, '../aniview'),
  'react': exampleNM + '/react',
  'react-native': exampleNM + '/react-native',
  'react-native-reanimated': exampleNM + '/react-native-reanimated',
  'react-native-worklets': exampleNM + '/react-native-worklets',
  'react-native-gesture-handler': exampleNM + '/react-native-gesture-handler',
};

module.exports = config;
```

**3. Run `npm install`** in the consumer app.

## Why This Is Needed

Without the Metro config, `file:../aniview` exposes Aniview's `node_modules/`
to Metro. Since Aniview has its own development copies of `react-native-reanimated` and
`react-native-worklets`, Metro bundles two instances — causing runtime errors:

- `TypeError: property is not writable`
- `Another instance of Reanimated was detected`
- `Mismatch between JavaScript code version and Worklets Babel plugin version`

The `blockList` prevents Metro from crawling aniview's `node_modules`, and
`extraNodeModules` ensures all imports resolve to the consumer app's copies.

## Reverting for Production

Before publishing the consumer app, change its `package.json` back to the npm package:

```json
"aniview": "^1.0.1"
```

And remove `metro.config.js` (or keep it — it's harmless with the npm version).
