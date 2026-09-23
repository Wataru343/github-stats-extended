import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { saveStatsSvg } from "./generate-profile-stats.ts";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "profile-svg-test-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("SVG output", () => {
  it("saves a successful SVG and replaces an earlier file", async () => {
    const target = join(directory, "stats.svg");
    await writeFile(target, "previous SVG");
    const content =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>3.8k</text></svg>';
    await saveStatsSvg(target, { status: "success", content });
    expect(await readFile(target, "utf8")).toBe(content);
    expect(await readdir(directory)).toEqual(["stats.svg"]);
  });

  it("creates a requested output directory", async () => {
    const target = join(directory, "new", "stats.svg");
    await saveStatsSvg(target, { status: "success", content: "<svg></svg>" });
    expect(await readFile(target, "utf8")).toBe("<svg></svg>");
  });

  it.each(["error - temporary", "error - permanent"] as const)(
    "preserves the previous SVG on %s",
    async (status) => {
      const target = join(directory, "stats.svg");
      await writeFile(target, "previous SVG");
      await expect(
        saveStatsSvg(target, { status, content: "<svg>error card</svg>" }),
      ).rejects.toThrow("Could not render");
      expect(await readFile(target, "utf8")).toBe("previous SVG");
      expect(await readdir(directory)).toEqual(["stats.svg"]);
    },
  );

  it.each(["", "<html>Error</html>", "<svg>truncated"])(
    "rejects invalid output without creating a file",
    async (content) => {
      await expect(
        saveStatsSvg(join(directory, "stats.svg"), {
          status: "success",
          content,
        }),
      ).rejects.toThrow();
      expect(await readdir(directory)).toEqual([]);
    },
  );
});
