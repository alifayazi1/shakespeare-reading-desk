import { defineConfig } from 'astro/config';

// Allow bare .json endpoints in dev while keeping directory-style page links.
// 'always' requires a slash after .json in dev, unlike the built static files.
export default defineConfig({ output: 'static', trailingSlash: 'ignore' });
