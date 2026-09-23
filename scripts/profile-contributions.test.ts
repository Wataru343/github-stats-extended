import { chromium, errors } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectProfileContributions,
  parseProfileYear,
  profileYearUrl,
  sumContributions,
} from "./profile-contributions.ts";
import type { ProfileSnapshot } from "./profile-contributions.ts";

function snapshot(
  year = 2024,
  overrides: Partial<ProfileSnapshot> = {},
): ProfileSnapshot {
  return {
    url: profileYearUrl("Wataru343", year),
    heading: `1,833\n contributions\n in ${year}`,
    from: `${year}-01-01 00:00:00 UTC`,
    to: `${year}-12-31 23:59:59 UTC`,
    percentages: '{"Commits":63,"Pull requests":21,"Code review":8,"Issues":8}',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("profile year parsing", () => {
  it("reads the observed 2024 values by category name, including leap-year boundaries", () => {
    const result = parseProfileYear(snapshot(), "Wataru343", 2024);
    expect(result.totals).toEqual({
      totalContributions: 1833,
      totalCommits: 1154,
      totalReviews: 146,
      totalPRs: 384,
      totalIssues: 146,
    });
    expect(result.percentages).toEqual({
      Commits: 63,
      "Code review": 8,
      "Pull requests": 21,
      Issues: 8,
    });
  });

  it("accepts a zero year without an activity graph", () => {
    expect(
      parseProfileYear(
        snapshot(2017, {
          heading: "0 contributions in 2017",
          percentages: null,
        }),
        "Wataru343",
        2017,
      ).totals,
    ).toEqual({
      totalContributions: 0,
      totalCommits: 0,
      totalReviews: 0,
      totalPRs: 0,
      totalIssues: 0,
    });
  });

  it("truncates each year before summing, without redistributing rounding losses", () => {
    const years = [2023, 2024].map((year) =>
      parseProfileYear(
        snapshot(year, {
          heading: `1 contribution in ${year}`,
          percentages:
            '{"Issues":0,"Code review":0,"Pull requests":50,"Commits":50}',
        }),
        "Wataru343",
        year,
      ),
    );
    expect(sumContributions(years)).toEqual({
      totalContributions: 2,
      totalCommits: 0,
      totalReviews: 0,
      totalPRs: 0,
      totalIssues: 0,
    });
  });

  it("keeps fractional percentages and does not require rounded percentages to total 100", () => {
    const result = parseProfileYear(
      snapshot(2024, {
        percentages:
          '{"Commits":62.5,"Code review":8,"Pull requests":21,"Issues":8}',
      }),
      "Wataru343",
      2024,
    );
    expect(result.totals.totalCommits).toBe(1145);
    expect(result.percentages.Commits).toBe(62.5);
  });

  it.each([
    { heading: null },
    { heading: "1,83 contributions in 2024" },
    { heading: "1833 contributions in the last year" },
    { heading: "1833 contributions in 2023" },
    { heading: "9007199254740992 contributions in 2024" },
    { from: "2023-01-01 00:00:00 UTC" },
    { to: "2024-12-30 23:59:59 UTC" },
    { url: "https://github.com/login" },
    { percentages: null },
    { percentages: "not json" },
    { percentages: "null" },
    { percentages: "[]" },
    { percentages: '{"Commits":100}' },
    {
      percentages:
        '{"Commits":101,"Code review":0,"Pull requests":0,"Issues":0}',
    },
    {
      percentages:
        '{"Commits":-1,"Code review":0,"Pull requests":0,"Issues":0}',
    },
    {
      percentages:
        '{"Commits":"63","Code review":8,"Pull requests":21,"Issues":8}',
    },
  ])("rejects incomplete or incorrect data: %j", (overrides) => {
    expect(() =>
      parseProfileYear(snapshot(2024, overrides), "Wataru343", 2024),
    ).toThrow();
  });

  it.each([
    "../login",
    "user?tab=repositories",
    "-user",
    "user--name",
    "user-",
    "",
  ])("rejects unsafe usernames: %s", (username) => {
    expect(() => profileYearUrl(username, 2024)).toThrow("username");
  });
});

function mockBrowser() {
  let year = 2016;
  const page = {
    goto: vi.fn(
      (url: string): Promise<{ ok: () => boolean; status: () => number }> => {
        year = Number(new URL(url).searchParams.get("from")?.slice(0, 4));
        return Promise.resolve({ ok: () => true, status: () => 200 });
      },
    ),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn(() =>
      Promise.resolve(
        snapshot(
          year,
          year === 2017
            ? { heading: "0 contributions in 2017", percentages: null }
            : {},
        ),
      ),
    ),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const launch = vi
    .spyOn(chromium, "launch")
    .mockResolvedValue(browser as unknown as Browser);
  return { page, browser, launch };
}

describe("profile collection", () => {
  it("visits every calendar year through the UTC year, including zero years, in a headless browser", async () => {
    vi.useFakeTimers();
    // Still 2025 in UTC; the machine's local timezone must not add 2026.
    vi.setSystemTime(new Date("2026-01-01T00:30:00+09:00"));
    const { page, browser, launch } = mockBrowser();
    const onYear = vi.fn();
    const result = await collectProfileContributions("Wataru343", { onYear });
    expect(result.years.map((item) => item.year)).toEqual([
      2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(page.goto.mock.calls.map(([url]) => url)).toEqual(
      result.years.map((item) => profileYearUrl("Wataru343", item.year)),
    );
    expect(launch).toHaveBeenCalledWith({ headless: true });
    expect(browser.newPage).toHaveBeenCalledWith({
      locale: "en-US",
      timezoneId: "UTC",
    });
    expect(onYear).toHaveBeenCalledTimes(10);
    expect(result.totals.totalCommits).toBe(10386);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("retries transient failures at most twice and always closes the browser", async () => {
    vi.useFakeTimers();
    const { page, browser } = mockBrowser();
    page.goto.mockRejectedValue(
      new errors.TimeoutError("navigation timed out"),
    );
    const promise = collectProfileContributions("Wataru343");
    const assertion = expect(promise).rejects.toThrow(
      /2016.*https:\/\/github.com\/Wataru343/,
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(page.goto).toHaveBeenCalledTimes(3);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("recovers after a transient HTTP error", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2016-12-31T12:00:00Z"));
    const { page } = mockBrowser();
    page.goto.mockResolvedValueOnce({ ok: () => false, status: () => 503 });
    const promise = collectProfileContributions("Wataru343");
    await vi.runAllTimersAsync();
    expect((await promise).years).toHaveLength(1);
    expect(page.goto).toHaveBeenCalledTimes(2);
  });

  it("fails on malformed content without returning a partial total", async () => {
    const { page, browser } = mockBrowser();
    page.evaluate
      .mockResolvedValueOnce(snapshot(2016))
      .mockResolvedValueOnce(snapshot(2017, { percentages: null }));
    await expect(collectProfileContributions("Wataru343")).rejects.toThrow(
      "2017",
    );
    expect(page.goto).toHaveBeenCalledTimes(2);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("does not retry a missing profile", async () => {
    const { page, browser } = mockBrowser();
    page.goto.mockResolvedValue({ ok: () => false, status: () => 404 });
    await expect(collectProfileContributions("Wataru343")).rejects.toThrow(
      "HTTP 404",
    );
    expect(page.goto).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("closes the browser if creating the page fails", async () => {
    const { browser } = mockBrowser();
    browser.newPage.mockRejectedValue(new Error("context failed"));
    await expect(collectProfileContributions("Wataru343")).rejects.toThrow(
      "context failed",
    );
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
