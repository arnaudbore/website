import { Chart } from 'chart.js/auto';

// ── Constants ────────────────────────────────────────────────────────────────

const REPOS: { org: string; repo: string }[] = JSON.parse(
    document.getElementById('repos-data')!.textContent!,
);

const RAW_BASE =
    'https://raw.githubusercontent.com/nf-neuro/repositories-statistics/nf-neuro-repositories-stats';

function rawUrl(org: string, repo: string, file: string): string {
    return `${RAW_BASE}/${org}/${repo}/ghrs-data/${file}`;
}

// ── CSV parser ───────────────────────────────────────────────────────────────

interface Row {
    [key: string]: string;
}

function parseCsv(text: string): Row[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

// ── Data store ───────────────────────────────────────────────────────────────

interface RepoData {
    stars: Row[];
    forks: Row[];
    viewsClones: Row[];
}

const dataCache = new Map<string, RepoData>();

// ── Chart instances ──────────────────────────────────────────────────────────

let starsChart: Chart | null = null;
let forksChart: Chart | null = null;
let viewsChart: Chart | null = null;
let clonesChart: Chart | null = null;

// ── Theme helpers ────────────────────────────────────────────────────────────

function getChartColors() {
    const style = getComputedStyle(document.documentElement);

    // Resolve --sl-color-accent to a browser-computed rgb() string so we can
    // build a valid rgba() for the fill. Appending a hex alpha to oklch/hsl
    // values produces an invalid color that Chart.js renders as black.
    const accentRgb = (() => {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;visibility:hidden;color:var(--sl-color-accent-low)';
        document.body.appendChild(el);
        const computed = getComputedStyle(el).color; // always "rgb(r, g, b)"
        document.body.removeChild(el);
        const m = computed.match(/\d+/g);
        return m && m.length >= 3 ? `${m[0]}, ${m[1]}, ${m[2]}` : '99, 102, 241';
    })();

    return {
        accent: style.getPropertyValue('--sl-color-accent').trim() || '#1e1e2e',
        text: style.getPropertyValue('--sl-color-text').trim() || '#1e1e2e',
        hairline: style.getPropertyValue('--sl-color-hairline').trim() || '#e5e7eb',
        accentLow: style.getPropertyValue('--sl-color-accent-low').trim() || '#1e1e2e',
    };
}

// ── Chart factory ────────────────────────────────────────────────────────────

function createLineChart(canvasId: string, label: string): Chart {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const colors = getChartColors();
    return new Chart(canvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label,
                    data: [],
                    borderColor: colors.accent,
                    backgroundColor: colors.accentLow,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: { color: colors.text, maxTicksLimit: 8, maxRotation: 30 },
                    grid: { color: colors.hairline },
                },
                y: {
                    ticks: { color: colors.text },
                    grid: { color: colors.hairline },
                },
            },
        },
    });
}

function createBarChart(canvasId: string, label: string): Chart {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const colors = getChartColors();
    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label,
                    data: [],
                    backgroundColor: colors.accentLow,
                    borderColor: colors.accent,
                    borderWidth: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: { color: colors.text, maxTicksLimit: 8, maxRotation: 30 },
                    grid: { color: colors.hairline },
                },
                y: {
                    ticks: { color: colors.text },
                    grid: { color: colors.hairline },
                },
            },
        },
    });
}

// ── Date helpers ────────────────────────────────────────────────────────────

function rowDate(row: Row): string {
    return row.time_iso8601?.slice(0, 10) ?? '';
}

function filterByDate(rows: Row[], start: string, end: string): Row[] {
    return rows.filter((r) => {
        const d = rowDate(r);
        return (!start || d >= start) && (!end || d <= end);
    });
}

/** Returns the earliest and latest date across all three CSV arrays for a repo. */
function getRepoBounds(key: string): { min: string; max: string } {
    const data = dataCache.get(key);
    if (!data) return { min: '', max: '' };
    const allDates = [
        ...data.stars.map(rowDate),
        ...data.forks.map(rowDate),
        ...data.viewsClones.map(rowDate),
    ].filter(Boolean);
    if (allDates.length === 0) return { min: '', max: '' };
    allDates.sort();
    return { min: allDates[0], max: allDates[allDates.length - 1] };
}

// ── Render helpers ───────────────────────────────────────────────────────────

function setNoData(chartId: string, noData: boolean) {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement;
    const noDataEl = document.getElementById(`${chartId.replace('-chart', '')}-no-data`);
    if (canvas) canvas.style.display = noData ? 'none' : 'block';
    if (noDataEl) noDataEl.style.display = noData ? 'flex' : 'none';
}

function renderRepo(key: string, resetDates = false) {
    const data = dataCache.get(key);
    if (!data) return;

    const dateStart = document.getElementById('date-start') as HTMLInputElement;
    const dateEnd = document.getElementById('date-end') as HTMLInputElement;

    // Set or reset date bounds from this repo's data
    const bounds = getRepoBounds(key);
    dateStart.min = bounds.min;
    dateStart.max = bounds.max;
    dateEnd.min = bounds.min;
    dateEnd.max = bounds.max;
    if (resetDates) {
        dateStart.value = bounds.min;
        dateEnd.value = bounds.max;
    }

    const start = dateStart.value;
    const end = dateEnd.value;

    const stars = filterByDate(data.stars, start, end);
    const forks = filterByDate(data.forks, start, end);
    const viewsClones = filterByDate(data.viewsClones, start, end);

    // Summary cards
    const lastStar = stars.length > 0 ? stars[stars.length - 1] : null;
    const lastFork = forks.length > 0 ? forks[forks.length - 1] : null;
    const totalViews = viewsClones.reduce((s, r) => s + (parseInt(r.views_total) || 0), 0);
    const totalClones = viewsClones.reduce((s, r) => s + (parseInt(r.clones_total) || 0), 0);

    (document.getElementById('card-stars') as HTMLElement).textContent =
        lastStar ? (parseInt(lastStar.stars_cumulative) || 0).toLocaleString() : '0';
    (document.getElementById('card-forks') as HTMLElement).textContent =
        lastFork ? (parseInt(lastFork.forks_cumulative) || 0).toLocaleString() : '0';
    (document.getElementById('card-views') as HTMLElement).textContent = totalViews.toLocaleString();
    (document.getElementById('card-clones') as HTMLElement).textContent = totalClones.toLocaleString();

    // Stars chart
    if (stars.length <= 1) {
        setNoData('stars-chart', true);
    } else {
        setNoData('stars-chart', false);
        starsChart!.data.labels = stars.map(rowDate);
        starsChart!.data.datasets[0].data = stars.map((r) => parseInt(r.stars_cumulative) || 0);
        starsChart!.update();
    }

    // Forks chart
    if (forks.length <= 1) {
        setNoData('forks-chart', true);
    } else {
        setNoData('forks-chart', false);
        forksChart!.data.labels = forks.map(rowDate);
        forksChart!.data.datasets[0].data = forks.map((r) => parseInt(r.forks_cumulative) || 0);
        forksChart!.update();
    }

    // Views chart
    if (viewsClones.length <= 1) {
        setNoData('views-chart', true);
    } else {
        setNoData('views-chart', false);
        viewsChart!.data.labels = viewsClones.map(rowDate);
        viewsChart!.data.datasets[0].data = viewsClones.map((r) => parseInt(r.views_total) || 0);
        viewsChart!.update();
    }

    // Clones chart
    if (viewsClones.length <= 1) {
        setNoData('clones-chart', true);
    } else {
        setNoData('clones-chart', false);
        clonesChart!.data.labels = viewsClones.map(rowDate);
        clonesChart!.data.datasets[0].data = viewsClones.map((r) => parseInt(r.clones_total) || 0);
        clonesChart!.update();
    }
}

// ── Theme change observer ────────────────────────────────────────────────────

function applyThemeToCharts() {
    const colors = getChartColors();
    const charts = [starsChart, forksChart, viewsChart, clonesChart];
    for (const chart of charts) {
        if (!chart) continue;
        const ds = chart.data.datasets[0] as any;
        ds.borderColor = colors.accent;
        ds.backgroundColor = colors.accentLow;
        for (const scale of Object.values(chart.options.scales ?? {})) {
            const s = scale as any;
            if (s.ticks) s.ticks.color = colors.text;
            if (s.grid) s.grid.color = colors.hairline;
        }
        chart.update('none');
    }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const overlay = document.getElementById('stats-overlay')!;
    const overlayMsg = document.getElementById('stats-overlay-message')!;
    const content = document.getElementById('stats-content')!;
    const select = document.getElementById('repo-select') as HTMLSelectElement;

    // Init charts (hidden initially, revealed in renderRepo)
    starsChart = createLineChart('stars-chart', 'Stars');
    forksChart = createLineChart('forks-chart', 'Forks');
    viewsChart = createBarChart('views-chart', 'Views');
    clonesChart = createBarChart('clones-chart', 'Clones');

    // Fetch all CSVs in parallel
    try {
        const fetches = REPOS.flatMap(({ org, repo }) => [
            fetch(rawUrl(org, repo, 'stargazers.csv')).then((r) => r.text()),
            fetch(rawUrl(org, repo, 'forks.csv')).then((r) => r.text()),
            fetch(rawUrl(org, repo, 'views_clones_aggregate.csv')).then((r) => r.text()),
        ]);

        const results = await Promise.all(fetches);

        REPOS.forEach(({ org, repo }, i) => {
            const key = `${org}/${repo}`;
            dataCache.set(key, {
                stars: parseCsv(results[i * 3]),
                forks: parseCsv(results[i * 3 + 1]),
                viewsClones: parseCsv(results[i * 3 + 2]),
            });
        });

        overlay.style.display = 'none';
        content.classList.remove('hidden');

        const dateRangeControls = document.getElementById('date-range-controls')!;
        dateRangeControls.classList.remove('hidden');
        dateRangeControls.classList.add('flex');

        const dateStart = document.getElementById('date-start') as HTMLInputElement;
        const dateEnd = document.getElementById('date-end') as HTMLInputElement;

        const firstKey = `${REPOS[0].org}/${REPOS[0].repo}`;
        renderRepo(firstKey, true);

        select.addEventListener('change', () => {
            renderRepo(select.value, true);
        });

        dateStart.addEventListener('change', () => {
            if (!dateStart.value) {
                dateStart.value = dateStart.min;
            }
            if (dateEnd.value && dateStart.value > dateEnd.value) {
                dateStart.value = dateEnd.value;
            }
            dateEnd.min = dateStart.value;
            renderRepo(select.value);
        });

        dateEnd.addEventListener('change', () => {
            if (!dateEnd.value) {
                dateEnd.value = dateEnd.max;
            }
            if (dateStart.value && dateEnd.value < dateStart.value) {
                dateEnd.value = dateStart.value;
            }
            dateStart.max = dateEnd.value;
            renderRepo(select.value);
        });
    } catch (err) {
        overlayMsg.textContent = 'Failed to load statistics. Please try again later.';
        overlayMsg.classList.remove('animate-pulse');
        console.error('Statistics fetch error:', err);
    }

    // Watch for theme changes
    new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.attributeName === 'data-theme') {
                applyThemeToCharts();
            }
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
});
