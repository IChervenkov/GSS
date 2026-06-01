const path = require('path');
const { createRequire } = require('module');

const projectRoot = path.resolve(__dirname, '..', '..');
const rootRequire = createRequire(path.join(projectRoot, 'package.json'));

function resolveFromRoot(specifier) {
  if (path.isAbsolute(specifier)) return specifier;
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.resolve(projectRoot, specifier);
  }
  if (specifier.startsWith('src/') || specifier.startsWith('tests/')) {
    return path.resolve(projectRoot, specifier);
  }
  try {
    return rootRequire.resolve(specifier);
  } catch {
    return path.resolve(projectRoot, specifier);
  }
}

function withMockedModules(mocks, factory) {
  const originals = [];
  try {
    for (const [specifier, exportsValue] of Object.entries(mocks)) {
      const absolutePath = resolveFromRoot(specifier);
      const original = require.cache[absolutePath];
      originals.push({ absolutePath, original });
      require.cache[absolutePath] = {
        id: absolutePath,
        filename: absolutePath,
        loaded: true,
        exports: exportsValue,
      };
    }
    return factory();
  } finally {
    for (const { absolutePath, original } of originals.reverse()) {
      if (original) {
        require.cache[absolutePath] = original;
      } else {
        delete require.cache[absolutePath];
      }
    }
  }
}

function requireFresh(specifier, mocks = {}) {
  return withMockedModules(mocks, () => {
    const absolutePath = resolveFromRoot(specifier);
    delete require.cache[absolutePath];
    return require(absolutePath);
  });
}

module.exports = {
  requireFresh,
  withMockedModules,
  resolveFromRoot,
};
