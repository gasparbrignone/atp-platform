// @ts-check
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';

export default [
  {
    // cloudflare/: proyecto propio del Worker de check-in, con su propio
    // package.json/tsconfig/toolchain separado (ver
    // cloudflare/checkin-worker/) — no es parte del sitio Astro.
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'cloudflare/**'],
  },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs['flat/recommended'],
];
