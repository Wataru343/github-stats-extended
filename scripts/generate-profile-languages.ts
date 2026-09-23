import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { saveSvg } from "./save-svg.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      username: { type: "string", default: "Wataru343" },
      output: { type: "string", default: "output/top-langs.svg" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: pnpm generate:profile-languages [--username Wataru343] [--output output/top-langs.svg]\nRequires GITHUB_TOKEN or PAT_* for language data.",
    );
    return;
  }
  // Import the built core: its ESM imports use .js extensions.
  const { topLangs, getConfig } =
    await import("../packages/core/build/index.js");
  const token = process.env["GITHUB_TOKEN"] || null;
  if (!token && !getConfig().pats.some((pat) => pat.value)) {
    throw new Error("Set GITHUB_TOKEN or PAT_* to fetch language data.");
  }
  const result = await topLangs(
    {
      username: values.username,
      show_icons: "true",
      theme: "dark",
      layout: "compact",
      langs_count: "8",
    },
    token,
  );
  await saveSvg(values.output, result);
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
