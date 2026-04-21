# Plan: Statistics Page for nf-neuro Documentation

**TL;DR:** Add a "Statistics" top-level sidebar topic. A single page fetches all 21 CSVs (7 repos × 3 files) in one `Promise.all` on load, shows summary cards + Chart.js charts, switches repos from cache on dropdown change, and stays in sync with Tailwind light/dark mode changes.

---

## Phase 1 — Dependency

1. Add `chart.js` via `pnpm add chart.js`.

---

## Phase 2 — Page & Sidebar (parallel with each other, depend on step 1 being planned)

2. Create `src/content/docs/statistics.mdx` — Starlight frontmatter (`title`, `description`, `tableOfContents: false`), imports and renders `<RepositoryStats />`.

3. Update `astro.config.mjs` — append to `starlightSidebarTopics`:
   `{ label: 'Statistics', link: 'statistics', icon: 'star', items: [] }`

---

## Phase 3 — Component (depends on step 1)

4. Create `src/components/RepositoryStats.astro`:

   **Server-rendered skeleton (build time):**
   - `<select>` dropdown pre-populated with all 7 repos (`nf-neuro/MultiQC_neuroimaging`, `nf-neuro/modules`, `nf-neuro/nf-bids`, `nf-neuro/tutorial`, `scilus/sf-mouse`, `scilus/sf-pediatric`, `scilus/sf-tractomics`)
   - 4 summary cards with unique `id`s (stars, forks, views total, clones total)
   - 4 `<canvas>` elements: `stars-chart`, `forks-chart`, `views-chart`, `clones-chart`
   - A loading overlay shown by default; hidden on data ready
   - Tailwind utility classes for layout/theming

   **Client `<script>` (browser-bundled), in order:**
   - `import { Chart } from 'chart.js/auto'`
   - `REPOS` array + raw URL builder pointing to `nf-neuro/repositories-statistics` on `nf-neuro-repositories-stats` branch
   - **`DOMContentLoaded`:** fire `Promise.all` of 21 `fetch()` → `.text()` calls; inline CSV parser (split lines, map to objects); populate `Map<"org/repo", {stars, forks, viewsClones}>`
   - Hide overlay; call `renderRepo(firstRepo)` to init charts
   - Dropdown `change` → `renderRepo(value)` (no fetch)
   - On fetch error: replace overlay with error message

   **`renderRepo(key)` function:**
   - Compute summary values: last row `stars_cumulative`, last row `forks_cumulative`, sum of `views_total`, sum of `clones_total` — update DOM cards
   - For each of the 4 charts: if no data rows → hide canvas + show "No data available" placeholder; else show canvas + call `chart.data.labels`, `chart.data.datasets[0].data`, `chart.update()`

   **`getChartColors()` helper:**
   - Reads Tailwind CSS custom properties at call time via `getComputedStyle(document.documentElement)` (e.g. `--sl-color-accent`, `--sl-color-text`, `--sl-color-hairline`) so charts use the active theme's palette

   **`MutationObserver` on `<html>`** watching for `data-theme` attribute changes:
   - On change: call `getChartColors()`, update `chart.options.scales.*.ticks/grid` color + `chart.data.datasets[0].borderColor/backgroundColor`, call `chart.update('none')` for all 4 charts — no full re-render needed

   **Chart types:**
   - Stars + Forks: `type: 'line'`, y = cumulative value
   - Views + Clones: `type: 'bar'`, y = daily total

---

## Relevant files

- `astro.config.mjs` — add Statistics topic
- `src/components/PipelineCardClient.astro` — reference pattern for skeleton + client `<script>` hydration
- `src/components/RepositoryStats.astro` — **create**
- `src/content/docs/statistics.mdx` — **create**

---

## Verification

1. `pnpm dev` → navigate to `/statistics`; confirm loading state then charts + cards populate.
2. Change dropdown through all 7 repos; confirm no new network requests in DevTools.
3. Toggle dark/light mode (Starlight theme button); confirm chart colors update without page reload.
4. Repo with sparse data (≤1 row) shows "No data available" per chart.
5. `pnpm build` — no TypeScript or link-validation errors; "Statistics" topic appears in sidebar.

---

## Decisions

- Client-side-only data fetching — always fresh on load/refresh, no build-time pre-fetch.
- No PapaParse — inline CSV parser is sufficient.
- Summary cards show *total* views/clones (sum of all rows), not unique.
- Scope excludes snapshot data (top paths / referrers).
- `chart.js/auto` import used to avoid manual registration of Chart.js components.

---

## Data Source

- Repo: `https://github.com/nf-neuro/repositories-statistics`
- Branch: `nf-neuro-repositories-stats`
- Raw URL base: `https://raw.githubusercontent.com/nf-neuro/repositories-statistics/nf-neuro-repositories-stats/`
- Files per repo: `{org}/{repo}/ghrs-data/stargazers.csv`, `forks.csv`, `views_clones_aggregate.csv`

### CSV Schemas

**stargazers.csv:** `time_iso8601`, `stars_cumulative`

**forks.csv:** `time_iso8601`, `forks_cumulative`

**views_clones_aggregate.csv:** `time_iso8601`, `clones_total`, `clones_unique`, `views_total`, `views_unique`

### Repositories tracked

| Org | Repos |
|---|---|
| `nf-neuro` | `MultiQC_neuroimaging`, `modules`, `nf-bids`, `tutorial` |
| `scilus` | `sf-mouse`, `sf-pediatric`, `sf-tractomics` |
