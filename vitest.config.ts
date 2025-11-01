import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/data/libs/whisper/**", // Exclude whisper native addon tests
    ],
  },
});
