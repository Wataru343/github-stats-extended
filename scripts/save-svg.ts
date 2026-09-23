import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { ApiResult } from "../packages/core/src/api/api-result.js";

/** Commit a successful render atomically, preserving the previous SVG on failure. */
export async function saveSvg(
  output: string,
  result: ApiResult,
): Promise<void> {
  if (
    result.status !== "success" ||
    !/<svg\b/.test(result.content) ||
    !/<\/svg>\s*$/.test(result.content)
  ) {
    throw new Error(
      `Could not render SVG (${result.status})${result.error ? `: ${result.error.message}` : "."}`,
    );
  }
  const target = resolve(output);
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, ".card-svg-"));
  try {
    const file = join(temporary, "card.svg");
    await writeFile(file, result.content, "utf8");
    await rename(file, target);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
