import { defineConfig } from 'tsup';

export default defineConfig(options => {
  return {
    entry: ['src/index.ts'],
    outDir: 'lib',
    target: 'node22',
    format: ['esm', 'cjs'],
    dts: true,
    shims: true,
    treeshake: true,
    sourcemap: !options.watch,
    minify: !options.watch,
    clean: true,
  };
});
