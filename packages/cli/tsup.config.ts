import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/fcli': 'src/bin/fcli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  banner: {
    // Add shebang only to the CLI entry point
    js: '#!/usr/bin/env node\n',
  },
  // Externalize all node_modules — they'll be installed as dependencies
  external: [/^[^.\/]/],
});
