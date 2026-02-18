import type { SegmentStats, Series, Waypoint, WaypointComparison } from './types';

// ── Series callbacks ─────────────────────────────────────────────

export interface SeriesCallbacks {
  onRename: (id: string, name: string) => void;
  onColorChange: (id: string, color: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

// ── Series List ──────────────────────────────────────────────────

export function renderSeriesList(
  container: HTMLElement,
  seriesList: Series[],
  activeSeriesId: string | null,
  callbacks: SeriesCallbacks,
): void {
  container.innerHTML = '';

  if (seriesList.length === 0) {
    container.innerHTML = '<p class="empty-msg">Upload a CSV to add a data series</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'series-list';

  for (const s of seriesList) {
    const item = document.createElement('div');
    item.className = 'series-item' + (s.id === activeSeriesId ? ' active' : '');
    if (s.id === activeSeriesId) {
      item.style.borderColor = s.color;
    }
    item.innerHTML = `
      <input type="color" class="series-color-picker" value="${s.color}" title="Change color">
      <span class="series-name-wrap">
        <span class="series-name">${escapeHtml(s.name)}</span>
        <button class="series-edit-btn" title="Rename series">${pencilSvg}</button>
      </span>
      <span class="series-count">${s.entries.length}d</span>
      <button class="btn-remove series-remove" title="Remove series">&times;</button>
    `;

    // Click anywhere on the row (except buttons/inputs) to select this series
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input')) return;
      callbacks.onSelect(s.id);
    });

    const colorPicker = item.querySelector('.series-color-picker') as HTMLInputElement;
    const nameWrap = item.querySelector('.series-name-wrap') as HTMLSpanElement;
    const editBtn = item.querySelector('.series-edit-btn') as HTMLButtonElement;
    const removeBtn = item.querySelector('.series-remove') as HTMLButtonElement;

    colorPicker.addEventListener('input', () => callbacks.onColorChange(s.id, colorPicker.value));

    // Click pencil to edit the name inline
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'series-name-input';
      input.value = s.name;
      nameWrap.replaceWith(input);
      input.focus();
      input.select();

      const commit = () => {
        const newName = input.value.trim();
        if (newName && newName !== s.name) {
          callbacks.onRename(s.id, newName);
        } else {
          callbacks.onSelect(s.id); // re-render to restore the span
        }
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') input.blur();
        if (ke.key === 'Escape') {
          input.value = s.name;
          input.blur();
        }
      });
    });

    removeBtn.addEventListener('click', () => callbacks.onRemove(s.id));

    list.appendChild(item);
  }

  container.appendChild(list);
}

// ── Icons ─────────────────────────────────────────────────────────

const pencilSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

// ── Segment Cards ────────────────────────────────────────────────

export function renderSegmentCards(container: HTMLElement, segments: SegmentStats[]): void {
  container.innerHTML = '';

  if (segments.length === 0) {
    container.innerHTML = '<p class="empty-msg">Upload data to see segment statistics</p>';
    return;
  }

  for (const seg of segments) {
    const card = document.createElement('div');
    card.className = 'segment-card';

    const trendIcon = seg.trendDirection === 'rising' ? '&#9650;'
      : seg.trendDirection === 'falling' ? '&#9660;' : '&#9644;';
    const trendClass = seg.trendDirection === 'rising' ? 'trend-up'
      : seg.trendDirection === 'falling' ? 'trend-down' : 'trend-flat';

    card.innerHTML = `
      <h3 class="segment-title">${escapeHtml(seg.label)}</h3>
      <div class="segment-dates">${formatDate(seg.startDate)} &mdash; ${formatDate(seg.endDate)}</div>
      <div class="segment-days">${seg.count} days</div>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-label">Mean</span>
          <span class="stat-value">${seg.mean.toFixed(1)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Median</span>
          <span class="stat-value">${seg.median.toFixed(1)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Std Dev</span>
          <span class="stat-value">${seg.stdDev.toFixed(1)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Range</span>
          <span class="stat-value">${seg.min.toFixed(0)}&ndash;${seg.max.toFixed(0)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">P25/P75</span>
          <span class="stat-value">${seg.p25.toFixed(1)}/${seg.p75.toFixed(1)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">CV</span>
          <span class="stat-value">${seg.coefficientOfVariation.toFixed(1)}%</span>
        </div>
      </div>
      <div class="segment-trend ${trendClass}">
        <span class="trend-icon">${trendIcon}</span>
        <span class="trend-text">${seg.trendDirection} (${seg.trendSlope > 0 ? '+' : ''}${seg.trendSlope.toFixed(3)}/day)</span>
      </div>
    `;
    container.appendChild(card);
  }
}

// ── Waypoint Comparison Panel ────────────────────────────────────

export function renderComparisonPanel(
  container: HTMLElement,
  comparison: WaypointComparison | null,
): void {
  container.innerHTML = '';

  if (!comparison) {
    container.innerHTML = '<p class="empty-msg">Select a waypoint with sufficient data on both sides to see comparison</p>';
    return;
  }

  const c = comparison;
  const deltaSign = c.deltaMean > 0 ? '+' : '';
  const deltaClass = c.deltaMean < 0 ? 'delta-good' : c.deltaMean > 0 ? 'delta-bad' : 'delta-neutral';
  const pClass = c.tTestPValue < 0.05 ? 'sig-yes' : 'sig-no';

  container.innerHTML = `
    <div class="comparison-grid">
      <div class="comparison-side">
        <h4>Before</h4>
        <div class="comparison-label">${escapeHtml(c.before.label)}</div>
        <div class="comparison-dates">${formatDate(c.before.startDate)} &mdash; ${formatDate(c.before.endDate)}</div>
        <div class="comparison-stat-grid">
          <div class="stat-item"><span class="stat-label">Mean</span><span class="stat-value">${c.before.mean.toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">Median</span><span class="stat-value">${c.before.median.toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">Std Dev</span><span class="stat-value">${c.before.stdDev.toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">Range</span><span class="stat-value">${c.before.min.toFixed(0)}&ndash;${c.before.max.toFixed(0)}</span></div>
          <div class="stat-item"><span class="stat-label">Days</span><span class="stat-value">${c.before.count}</span></div>
        </div>
        ${renderMiniHistogram(c.before, 'before')}
      </div>
      <div class="comparison-side">
        <h4>After</h4>
        <div class="comparison-label">${escapeHtml(c.after.label)}</div>
        <div class="comparison-dates">${formatDate(c.after.startDate)} &mdash; ${formatDate(c.after.endDate)}</div>
        <div class="comparison-stat-grid">
          <div class="stat-item"><span class="stat-label">Mean</span><span class="stat-value">${c.after.mean.toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">Median</span><span class="stat-value">${c.after.median.toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">Std Dev</span><span class="stat-value">${c.after.stdDev.toFixed(1)}</span></div>
          <div class="stat-item"><span class="stat-label">Range</span><span class="stat-value">${c.after.min.toFixed(0)}&ndash;${c.after.max.toFixed(0)}</span></div>
          <div class="stat-item"><span class="stat-label">Days</span><span class="stat-value">${c.after.count}</span></div>
        </div>
        ${renderMiniHistogram(c.after, 'after')}
      </div>
    </div>
    <div class="comparison-summary">
      <div class="summary-stat ${deltaClass}">
        <span class="summary-label">Mean Change</span>
        <span class="summary-value">${deltaSign}${c.deltaMean.toFixed(1)} (${deltaSign}${c.percentChange.toFixed(1)}%)</span>
      </div>
      <div class="summary-stat ${pClass}">
        <span class="summary-label">p-value (Welch's t)</span>
        <span class="summary-value">${formatPValue(c.tTestPValue)} &mdash; ${c.significanceLabel}</span>
      </div>
      <div class="summary-stat">
        <span class="summary-label">Cohen's d</span>
        <span class="summary-value">${Math.abs(c.cohensD).toFixed(2)} &mdash; ${c.effectSizeLabel} effect</span>
      </div>
    </div>
  `;
}

function renderMiniHistogram(stats: SegmentStats, _id: string): string {
  // Percentile bar chart as a distribution visualization
  return `
    <div class="mini-distribution">
      <div class="dist-bar-row">
        <span class="dist-label">P25</span>
        <div class="dist-bar-track"><div class="dist-bar" style="width: ${stats.p25}%"></div></div>
        <span class="dist-val">${stats.p25.toFixed(0)}</span>
      </div>
      <div class="dist-bar-row">
        <span class="dist-label">P50</span>
        <div class="dist-bar-track"><div class="dist-bar dist-bar-med" style="width: ${stats.median}%"></div></div>
        <span class="dist-val">${stats.median.toFixed(0)}</span>
      </div>
      <div class="dist-bar-row">
        <span class="dist-label">P75</span>
        <div class="dist-bar-track"><div class="dist-bar" style="width: ${stats.p75}%"></div></div>
        <span class="dist-val">${stats.p75.toFixed(0)}</span>
      </div>
    </div>
  `;
}

// ── Waypoint List ────────────────────────────────────────────────

export function renderWaypointList(
  container: HTMLElement,
  waypoints: Waypoint[],
  onRemove: (id: string) => void,
  onSelect: (id: string) => void,
  onColorChange: (id: string, color: string) => void,
): void {
  container.innerHTML = '';

  if (waypoints.length === 0) {
    container.innerHTML = '<p class="empty-msg">No waypoints added yet</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'waypoint-list';

  for (const wp of waypoints) {
    const item = document.createElement('div');
    item.className = 'waypoint-item';
    item.innerHTML = `
      <input type="color" class="waypoint-color-picker" value="${wp.color || '#e8725a'}" title="Change color">
      <span class="waypoint-date">${formatDate(wp.date)}</span>
      <span class="waypoint-label">${escapeHtml(wp.label)}</span>
      <button class="btn-compare" data-id="${wp.id}" title="Compare before/after">Compare</button>
      <button class="btn-remove" data-id="${wp.id}" title="Remove waypoint">&times;</button>
    `;

    const colorPicker = item.querySelector('.waypoint-color-picker') as HTMLInputElement;
    const compareBtn = item.querySelector('.btn-compare') as HTMLButtonElement;
    const removeBtn = item.querySelector('.btn-remove') as HTMLButtonElement;

    colorPicker.addEventListener('input', () => onColorChange(wp.id, colorPicker.value));
    compareBtn.addEventListener('click', () => onSelect(wp.id));
    removeBtn.addEventListener('click', () => onRemove(wp.id));

    list.appendChild(item);
  }

  container.appendChild(list);
}

// ── Helpers ──────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPValue(p: number): string {
  if (p < 0.001) return 'p < 0.001';
  if (p < 0.01) return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(2)}`;
}
