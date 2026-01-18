import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  shims: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Bundle all local code, but keep node_modules external
  noExternal: [],
  // Preserve directory structure for debugging
  splitting: false,
});
