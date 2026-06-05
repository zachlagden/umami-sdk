import { defineConfig } from 'tsup';
import { readFile, writeFile } from 'node:fs/promises';

const outExtension = ({ format }: { format: string }) => ({
  js: format === 'cjs' ? '.cjs' : '.js',
});

const clientFiles = ['dist/react.js', 'dist/react.cjs', 'dist/next.js', 'dist/next.cjs'];

async function prependUseClient() {
  for (const file of clientFiles) {
    const content = await readFile(file, 'utf8');
    if (!content.startsWith("'use client'")) {
      await writeFile(file, `'use client';\n${content}`);
    }
  }
}

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      node: 'src/node/index.ts',
      vue: 'src/vue/index.ts',
      svelte: 'src/svelte/index.ts',
      solid: 'src/solid/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    minify: true,
    treeshake: true,
    outExtension,
  },
  {
    entry: { react: 'src/react/index.tsx', next: 'src/next/index.tsx' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    minify: true,
    treeshake: true,
    outExtension,
    onSuccess: prependUseClient,
  },
]);
