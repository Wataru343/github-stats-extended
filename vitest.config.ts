import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.ts"],
        },
      },
      "packages/core/vitest.config.ts",
      "apps/backend/vitest.config.ts",
      "apps/frontend/vitest.config.ts",
    ],
  },
});
