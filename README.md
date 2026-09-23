<div align="center">
  <img src="docs/appIcon.svg" width="100px" alt="GitHub Stats Extended Logo" />
  <h1>GitHub Stats Extended</h1>
  <p>Dynamically generate GitHub stats for your READMEs.</p>
<a href="https://github-stats-extended.vercel.app/api?username=anuraghazra">
  <picture>
    <source
      srcset="https://github-stats-extended.vercel.app/api?username=anuraghazra&theme=dark_github"
      media="(prefers-color-scheme: dark)"
    />
    <img src="https://github-stats-extended.vercel.app/api?username=anuraghazra&theme=light_github" />
  </picture>
</a>
</div>

GitHub-Stats-Extended is the [extended, actively maintained successor](https://github-stats-extended.vercel.app/frontend/docs/fork/) of [github-readme-stats](https://github.com/anuraghazra/github-readme-stats). It generates [various stats cards](#card-types) about your GitHub contributions, your top languages and more. You can [customize](#documentation) the cards via multiple parameters.

## Table of Contents

- [Quick Start](#quick-start)
- [Migration from github-readme-stats](#migration-from-github-readme-stats)
- [Card Types](#card-types)
- [Documentation](#documentation)
- [Acknowledgements](#acknowledgements)
- [Contributing](#contributing)

## Quick Start

Copy and paste this into your markdown, then change the `?username=` value to your GitHub username:

```md
[![Anurag's GitHub stats](https://github-stats-extended.vercel.app/api?username=anuraghazra)](https://github.com/stats-organization/github-stats-extended)
```

As a more comfortable alternative, use the [card wizard](https://github-stats-extended.vercel.app/frontend) to configure your card visually. Then copy the generated markdown into your [GitHub profile README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme#adding-a-profile-readme).

## Migration from github-readme-stats

To migrate from [github-readme-stats](https://github.com/anuraghazra/github-readme-stats) you only need to change the domain from `github-readme-stats.vercel.app` to `github-stats-extended.vercel.app`:

```diff
- https://github-readme-stats.vercel.app/api?username=octocat&theme=radical
+ https://github-stats-extended.vercel.app/api?username=octocat&theme=radical
```

GitHub-Stats-Extended aims to be fully compatible with github-readme-stats. For details see [Compatibility Notes](https://github-stats-extended.vercel.app/frontend/docs/fork/#compatibility-notes).

## Card Types

- Show your GitHub statistics:

  <picture>
    <source
      srcset="https://github-stats-extended.vercel.app/api?username=anuraghazra&theme=dark_github"
      media="(prefers-color-scheme: dark)"
    />
    <img src="https://github-stats-extended.vercel.app/api?username=anuraghazra&theme=light_github" alt="Anurag's GitHub stats" />
  </picture>

- ...your top languages...:

  <picture>
    <source
      srcset="https://github-stats-extended.vercel.app/api/top-langs/?username=anuraghazra&langs_count=4&theme=dark_github"
      media="(prefers-color-scheme: dark)"
    />
    <img src="https://github-stats-extended.vercel.app/api/top-langs/?username=anuraghazra&langs_count=4&theme=light_github" alt="Top Langs" />
  </picture>

- ...and development time:

  <a href="https://wakatime.com/@alan">
    <picture>
      <source
        srcset="https://github-stats-extended.vercel.app/api/wakatime?username=alan&langs_count=6&theme=dark_github"
        media="(prefers-color-scheme: dark)"
      />
      <img src="https://github-stats-extended.vercel.app/api/wakatime?username=alan&langs_count=6&theme=light_github" alt="Alan's WakaTime stats" />
    </picture>
  </a>

- Pin more than 6 repos in your GitHub profile:

  <a href="https://github.com/anuraghazra/github-readme-stats">
    <picture>
      <source
        srcset="https://github-stats-extended.vercel.app/api/pin/?username=anuraghazra&repo=github-readme-stats&theme=dark_github_repocard"
        media="(prefers-color-scheme: dark)"
      />
      <img src="https://github-stats-extended.vercel.app/api/pin/?username=anuraghazra&repo=github-readme-stats&theme=light_github_repocard" alt="Readme Card" />
    </picture>
  </a>

- Pin Gists in your GitHub profile:

  <a href="https://gist.github.com/Yizack/bbfce31e0217a3689c8d961a356cb10d">
    <picture>
      <source
        srcset="https://github-stats-extended.vercel.app/api/gist?id=bbfce31e0217a3689c8d961a356cb10d&theme=dark_github_repocard"
        media="(prefers-color-scheme: dark)"
      />
      <img src="https://github-stats-extended.vercel.app/api/gist?id=bbfce31e0217a3689c8d961a356cb10d&theme=light_github_repocard" alt="Gist Card" />
    </picture>
  </a>

- Customize all the cards:

  [![Anurag's GitHub stats](https://github-stats-extended.vercel.app/api/?username=anuraghazra&show_icons=true&theme=calm&rank_icon=github&include_all_commits=true&custom_title=Anurag's+Stats&disable_animations=true&number_format=long&show=prs_merged_percentage,prs_reviewed)](https://github-stats-extended.vercel.app/api/?username=anuraghazra&show_icons=true&theme=calm&rank_icon=github&include_all_commits=true&custom_title=Anurag's+Stats&disable_animations=true&number_format=long&show=prs_merged_percentage,prs_reviewed)

## Documentation

### Generate a stats SVG from your public profile

With Node.js 24 and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
# Set GITHUB_TOKEN (preferred) or PAT_1 in your environment.
pnpm generate:profile-stats --username Wataru343 --output output/stats.svg
```

This command builds the core package, opens a headless Chromium browser without
logging in, and visits each calendar year from 2016 through the current UTC year.
It reads the public profile's contribution total and activity percentages, then
calculates `Math.floor(yearTotal * percentage / 100)` for each category before
summing the years. A year explicitly showing zero contributions needs no activity
graph. Other missing or invalid data fails the command instead of counting as zero.

The result is the standard dark stats card with icons, all-time commits, code
reviews, and the usual rank display. The total contributions row remains hidden;
review estimates are also used in the rank calculation. Names, stars, contributed
repositories, and followers still come from the GitHub API using the token.
The language card is a separate feature.

`Wataru343` and `output/stats.svg` are the default arguments. The SVG is only
replaced after collection and rendering succeed; failures exit with a nonzero
status and preserve any existing output. Annual values and percentages are logged
to stdout. Generated files under `output/` are ignored by Git. The command does
not commit files or publish releases; CI/CD can consume the resulting SVG later.

If Chromium's system dependencies are missing, use
`pnpm exec playwright install --with-deps chromium`. To use an already installed
browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

`pnpm test --run` covers parsing, aggregation, retry behavior, rendering, and
output preservation. `pnpm test:profile-browser` checks asynchronous DOM loading
in a real headless browser with local fixtures; it does not contact GitHub.

These category counts are **estimates**, not exact private-repository counts.
Rounded percentages and per-year truncation can leave a difference from the total.
The public profile must expose private contributions and its activity overview;
the overview is limited by the viewer's repository access, so SSO-private category
totals cannot be guaranteed. See [GitHub's profile contributions documentation](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile#activity-overview).

The programmatic card API accepts an optional third argument of type
`ContributionTotals` (`totalContributions`, `totalCommits`, `totalReviews`,
`totalPRs`, `totalIssues`). With these totals, the core skips the corresponding
API counts and calculates rank from the supplied values. This requires
`include_all_commits=true`, with no `commits_year`, `repo`, or `owner` filter.
Calls without this argument retain their existing behavior. This is not an HTTP
query parameter.

The [card wizard](https://github-stats-extended.vercel.app/frontend) offers some essential customization options. For more advanced customization and other project info check out the [documentation](https://github-stats-extended.vercel.app/frontend/docs/cards/stats/).

## Acknowledgements

This project is based on [github-readme-stats](https://github.com/anuraghazra/github-readme-stats). The card wizard is based on [GitHub Trends](https://github.com/avgupta456/github-trends). Big thanks to [@anuraghazra](https://github.com/anuraghazra), [@avgupta456](https://github.com/avgupta456), [@rickstaa](https://github.com/rickstaa), [@qwerty541](https://github.com/qwerty541) and everyone else who worked on these projects! ❤️

## Contributing

Contributions are welcome!
