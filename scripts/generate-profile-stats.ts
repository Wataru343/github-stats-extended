import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import type { ApiResult } from "../packages/core/src/api/api-result.js";

import { collectProfileContributions } from "./profile-contributions.ts";

/** Commit a successful render atomically, preserving the previous SVG on failure. */
export async function saveStatsSvg(
  output: string,
  result: ApiResult,
): Promise<void> {
  if (
    result.status !== "success" ||
    !/<svg\b/.test(result.content) ||
    !/<\/svg>\s*$/.test(result.content)
  ) {
    throw new Error(
      `Could not render stats SVG (${result.status})${result.error ? `: ${result.error.message}` : "."}`,
    );
  }
  const target = resolve(output);
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, ".profile-stats-"));
  try {
    const file = join(temporary, "stats.svg");
    await writeFile(file, result.content, "utf8");
    await rename(file, target);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      username: { type: "string", default: "Wataru343" },
      output: { type: "string", default: "output/stats.svg" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: pnpm generate:profile-stats [--username Wataru343] [--output output/stats.svg]\nRequires GITHUB_TOKEN or PAT_* for API metadata. Install Chromium with pnpm exec playwright install chromium.",
    );
    return;
  }
  // Import the built core: its ESM imports use .js extensions.
  const { api, getConfig } = await import("../packages/core/build/index.js");
  const token = process.env["GITHUB_TOKEN"] || null;
  if (!token && !getConfig().pats.some((pat) => pat.value)) {
    throw new Error("Set GITHUB_TOKEN or PAT_* to fetch card metadata.");
  }
  const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];
  const { totals } = await collectProfileContributions(values.username, {
    ...(executablePath ? { executablePath } : {}),
    onYear: ({ year, percentages, totals: annual }) => {
      console.log(JSON.stringify({ year, percentages, ...annual }));
    },
  });
  console.log(
    JSON.stringify({
      period: `2016-${new Date().getUTCFullYear()}`,
      countsAreEstimates: true,
      ...totals,
    }),
  );

  const result = await api(
    {
      username: values.username,
      theme: "dark",
      show_icons: "true",
      include_all_commits: "true",
      show: "reviews",
    },
    token,
    totals,
  );
  await saveStatsSvg(values.output, result);
  console.log(`Saved ${resolve(values.output)}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
