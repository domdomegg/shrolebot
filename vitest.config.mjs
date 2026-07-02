import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    globalSetup: './test/globalSetup.mjs',
    setupFiles: ['./test/environmentVariables.js']
  }
})
