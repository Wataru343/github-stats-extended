import { setTimeout as delay } from "node:timers/promises";

import { chromium, errors } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { ContributionTotals } from "../packages/core/src/fetchers/types.js";

const FIRST_YEAR = 2016;
const TIMEOUT = 30_000;
const CATEGORIES = {
  Commits: "totalCommits",
  "Code review": "totalReviews",
  "Pull requests": "totalPRs",
  Issues: "totalIssues",
} as const;
type Percentages = Record<keyof typeof CATEGORIES, number>;

export interface ProfileSnapshot {
  url: string;
  heading: string | null;
  from: string | null;
  to: string | null;
  percentages: string | null;
}

export interface YearContributions {
  year: number;
  url: string;
  percentages: Percentages;
  totals: ContributionTotals;
}

function emptyTotals(): ContributionTotals {
  return {
    totalContributions: 0,
    totalCommits: 0,
    totalReviews: 0,
    totalPRs: 0,
    totalIssues: 0,
  };
}

export function profileYearUrl(username: string, year: number): string {
  if (!/^(?=.{1,39}$)[a-z\d](?:[a-z\d]|-(?=[a-z\d]))*$/i.test(username)) {
    throw new Error("Invalid GitHub username.");
  }
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > 9999) {
    throw new Error("Invalid contribution year.");
  }
  return `https://github.com/${username}?tab=overview&from=${year}-01-01&to=${year}-12-31`;
}

/** Parse only a complete year, never interpreting missing content as zero. */
export function parseProfileYear(
  snapshot: ProfileSnapshot,
  username: string,
  year: number,
): YearContributions {
  const url = profileYearUrl(username, year);
  if (
    snapshot.url.toLowerCase() !== url.toLowerCase() ||
    snapshot.from !== `${year}-01-01 00:00:00 UTC` ||
    snapshot.to !== `${year}-12-31 23:59:59 UTC`
  ) {
    throw new Error(`Profile period or URL does not match ${year}.`);
  }
  const heading = snapshot.heading?.trim().replace(/\s+/g, " ");
  const match =
    /^(\d+|[1-9]\d{0,2}(?:,\d{3})+) contributions? in (\d{4})$/.exec(
      heading ?? "",
    );
  if (!match || Number(match[2]) !== year) {
    throw new Error(`Missing or invalid contribution total for ${year}.`);
  }
  const total = Number(match[1]?.replaceAll(",", ""));
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error(`Invalid contribution total for ${year}.`);
  }

  // GitHub omits the entire activity graph for an empty year (e.g. 2017).
  let raw: unknown = {
    Commits: 0,
    "Code review": 0,
    "Pull requests": 0,
    Issues: 0,
  };
  if (snapshot.percentages !== null) {
    raw = JSON.parse(snapshot.percentages) as unknown;
  } else if (total > 0) {
    throw new Error(`Missing activity percentages for ${year}.`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`Invalid activity percentages for ${year}.`);
  }
  const percentages: Percentages = {
    Commits: 0,
    "Code review": 0,
    "Pull requests": 0,
    Issues: 0,
  };
  const totals = { ...emptyTotals(), totalContributions: total };
  for (const label of Object.keys(CATEGORIES) as Array<keyof Percentages>) {
    const percent = (raw as Record<string, unknown>)[label];
    if (
      typeof percent !== "number" ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100
    ) {
      throw new Error(`Missing or invalid percentage for ${label} in ${year}.`);
    }
    percentages[label] = percent;
    totals[CATEGORIES[label]] = Math.floor((total * percent) / 100);
  }
  return { year, url, percentages, totals };
}

export function sumContributions(
  years: Array<YearContributions>,
): ContributionTotals {
  const totals = emptyTotals();
  for (const year of years) {
    for (const key of Object.keys(totals) as Array<keyof ContributionTotals>) {
      totals[key] += year.totals[key];
      if (!Number.isSafeInteger(totals[key])) {
        throw new Error(`Contribution total is too large: ${key}.`);
      }
    }
  }
  return totals;
}

class TransientProfileError extends Error {}

/** Wait for GitHub's asynchronously loaded contribution section, within one deadline. */
export async function readProfileYear(
  page: Page,
  username: string,
  year: number,
): Promise<YearContributions> {
  const url = profileYearUrl(username, year);
  const deadline = Date.now() + TIMEOUT;
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT,
  });
  if (!response) {
    throw new TransientProfileError("No response from GitHub.");
  }
  if (response.status() === 429 || response.status() >= 500) {
    throw new TransientProfileError(
      `GitHub returned HTTP ${response.status()}.`,
    );
  }
  if (!response.ok()) {
    throw new Error(`GitHub returned HTTP ${response.status()}.`);
  }
  await page.waitForFunction(
    () => {
      const heading = document.querySelector(
        "#js-contribution-activity-description",
      )?.textContent;
      const calendar = document.querySelector(".js-calendar-graph");
      return (
        calendar &&
        heading &&
        (/^\s*0\s+contributions?\b/.test(heading) ||
          document.querySelector(
            ".js-activity-overview-graph-container[data-percentages]",
          ))
      );
    },
    undefined,
    { timeout: Math.max(1, deadline - Date.now()) },
  );
  const snapshot = await page.evaluate((): ProfileSnapshot => {
    const calendar = document.querySelector(".js-calendar-graph");
    return {
      url: location.href,
      heading:
        document.querySelector("#js-contribution-activity-description")
          ?.textContent ?? null,
      from: calendar?.getAttribute("data-from") ?? null,
      to: calendar?.getAttribute("data-to") ?? null,
      percentages:
        document
          .querySelector(".js-activity-overview-graph-container")
          ?.getAttribute("data-percentages") ?? null,
    };
  });
  return parseProfileYear(snapshot, username, year);
}

export async function collectProfileContributions(
  username: string,
  options: {
    executablePath?: string;
    onYear?: (year: YearContributions) => void;
  } = {},
): Promise<{ years: Array<YearContributions>; totals: ContributionTotals }> {
  const lastYear = new Date().getUTCFullYear();
  // Validate input before launching a browser.
  profileYearUrl(username, lastYear);
  const browser = await chromium.launch({
    headless: true,
    ...(options.executablePath
      ? { executablePath: options.executablePath }
      : {}),
  });
  try {
    const page = await browser.newPage({ locale: "en-US", timezoneId: "UTC" });
    const years: Array<YearContributions> = [];
    for (let year = FIRST_YEAR; year <= lastYear; year++) {
      const url = profileYearUrl(username, year);
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await readProfileYear(page, username, year);
          years.push(result);
          options.onYear?.(result);
          break;
        } catch (error) {
          const transient =
            error instanceof TransientProfileError ||
            error instanceof errors.TimeoutError ||
            (error instanceof Error &&
              /page\.goto: net::ERR_/.test(error.message));
          if (!transient || attempt >= 2) {
            throw new Error(
              `Could not collect ${year} (${url}): ${error instanceof Error ? error.message : String(error)}`,
              { cause: error },
            );
          }
          await delay(1000 * (attempt + 1));
        }
      }
    }
    return { years, totals: sumContributions(years) };
  } finally {
    await browser.close();
  }
}
