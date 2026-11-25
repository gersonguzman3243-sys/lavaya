import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { defineConfig } from "vitest/config";

process.env.LAVAYA_DATA_DIR ??= mkdtempSync(path.join(tmpdir(), "lavaya-test-"));

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
