import { expect, test } from "@playwright/test";

import { profileYearUrl, readProfileYear } from "./profile-contributions.ts";

const graph = `<div class="js-activity-overview-graph-container" data-percentages='{"Commits":94,"Pull requests":3,"Issues":3,"Code review":0}'></div>`;
function calendar(year: number, total: number): string {
  return `<h2 id="js-contribution-activity-description">${total} contributions in ${year}</h2>
    <div class="js-calendar-graph" data-from="${year}-01-01 00:00:00 UTC" data-to="${year}-12-31 23:59:59 UTC"></div>`;
}

test("waits for the asynchronously loaded activity overview and extracts its DOM data", async ({
  page,
}) => {
  await page.route(profileYearUrl("Wataru343", 2018), (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `${calendar(2018, 38)}<script>setTimeout(() => document.body.insertAdjacentHTML("beforeend", ${JSON.stringify(graph)}), 100)</script>`,
    }),
  );
  const result = await readProfileYear(page, "Wataru343", 2018);
  expect(result.totals).toEqual({
    totalContributions: 38,
    totalCommits: 35,
    totalReviews: 0,
    totalPRs: 1,
    totalIssues: 1,
  });
});

test("accepts an empty year with no graph", async ({ page }) => {
  await page.route(profileYearUrl("Wataru343", 2017), (route) =>
    route.fulfill({
      contentType: "text/html",
      body: calendar(2017, 0),
    }),
  );
  expect(
    (await readProfileYear(page, "Wataru343", 2017)).totals.totalContributions,
  ).toBe(0);
});

test("rejects a response containing a different year", async ({ page }) => {
  await page.route(profileYearUrl("Wataru343", 2024), (route) =>
    route.fulfill({
      contentType: "text/html",
      body: calendar(2023, 38) + graph,
    }),
  );
  await expect(readProfileYear(page, "Wataru343", 2024)).rejects.toThrow(
    "period",
  );
});

test("reports a missing profile rather than reading the error page as zero", async ({
  page,
}) => {
  await page.route(profileYearUrl("Wataru343", 2024), (route) =>
    route.fulfill({ status: 404, body: "Not found" }),
  );
  await expect(readProfileYear(page, "Wataru343", 2024)).rejects.toThrow(
    "HTTP 404",
  );
});
