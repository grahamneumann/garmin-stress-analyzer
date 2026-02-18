import { parseCSV } from './csv';
import { renderChart, destroyChart } from './chart';
import {
  getAllSeries,
  addSeries,
  removeSeries as removeSeriesFromStorage,
  updateSeries,
  getActiveSeriesId,
  setActiveSeriesId,
  deduplicateSeriesName,
  getWaypoints,
  addWaypoint,
  removeWaypoint,
  updateWaypoint,
  clearAll,
} from './storage';
import {
  buildSegments,
  computeSegmentStats,
  computeWaypointComparison,
} from './stats';
import {
  renderSegmentCards,
  renderComparisonPanel,
  renderWaypointList,
  renderSeriesList,
} from './ui';
import type { Series, Waypoint } from './types';
import './style.css';

// ── Default series colors (cycled on upload) ─────────────────────

const SERIES_PALETTE = ['#7ed87e', '#f0c050', '#6ab8d4', '#b8a0d8', '#f08068'];

function nextSeriesColor(): string {
  const series = getAllSeries();
  const usedColors = new Set(series.map(s => s.color));
  for (const c of SERIES_PALETTE) {
    if (!usedColors.has(c)) return c;
  }
  return SERIES_PALETTE[series.length % SERIES_PALETTE.length];
}

// ── DOM references ───────────────────────────────────────────────

const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
const uploadBtn = document.getElementById('btn-upload') as HTMLButtonElement;
const clearBtn = document.getElementById('btn-clear') as HTMLButtonElement;
const chartCanvas = document.getElementById('stress-chart') as HTMLCanvasElement;
const seriesContainer = document.getElementById('series-list') as HTMLElement;
const segmentContainer = document.getElementById('segment-cards') as HTMLElement;
const waypointContainer = document.getElementById('waypoint-list') as HTMLElement;
const comparisonContainer = document.getElementById('comparison-panel') as HTMLElement;
const addWaypointBtn = document.getElementById('btn-add-waypoint') as HTMLButtonElement;
const wpDateInput = document.getElementById('wp-date') as HTMLInputElement;
const wpLabelInput = document.getElementById('wp-label') as HTMLInputElement;
const wpColorInput = document.getElementById('wp-color') as HTMLInputElement;
const dataStatus = document.getElementById('data-status') as HTMLElement;
const comparisonTitle = document.getElementById('comparison-title') as HTMLElement;

// ── State ────────────────────────────────────────────────────────

let selectedWaypointId: string | null = null;

// ── Render everything ────────────────────────────────────────────

function refresh(): void {
  const seriesList = getAllSeries();
  const activeId = getActiveSeriesId();
  const waypoints = getWaypoints();
  const activeSeries = seriesList.find(s => s.id === activeId) ?? null;

  // Status
  const totalDays = seriesList.reduce((sum, s) => sum + s.entries.length, 0);
  if (totalDays > 0) {
    dataStatus.textContent = `${seriesList.length} series, ${totalDays} total days`;
    dataStatus.className = 'data-status has-data';
  } else {
    dataStatus.textContent = 'No data loaded';
    dataStatus.className = 'data-status no-data';
  }

  // Series list
  renderSeriesList(seriesContainer, seriesList, activeId, {
    onRename: handleSeriesRename,
    onColorChange: handleSeriesColorChange,
    onSelect: handleSeriesSelect,
    onRemove: handleSeriesRemove,
  });

  // Chart
  if (activeSeries && activeSeries.entries.length > 0) {
    renderChart(chartCanvas, activeSeries, waypoints);
  } else {
    destroyChart();
  }

  // Segments & comparison use the active series
  if (activeSeries && activeSeries.entries.length > 0) {
    const segments = buildSegments(activeSeries.entries, waypoints);
    const segStats = segments.map(computeSegmentStats);
    renderSegmentCards(segmentContainer, segStats);
  } else {
    renderSegmentCards(segmentContainer, []);
  }

  // Waypoint list
  renderWaypointList(waypointContainer, waypoints, handleRemoveWaypoint, handleSelectWaypoint, handleWaypointColorChange);

  // Comparison
  if (selectedWaypointId && activeSeries) {
    const wp = waypoints.find(w => w.id === selectedWaypointId);
    if (wp) {
      comparisonTitle.textContent = `Comparing: ${wp.label} (${activeSeries.name})`;
      const comparison = computeWaypointComparison(activeSeries.entries, wp);
      renderComparisonPanel(comparisonContainer, comparison);
    } else {
      selectedWaypointId = null;
      comparisonTitle.textContent = 'Waypoint Comparison';
      renderComparisonPanel(comparisonContainer, null);
    }
  } else {
    comparisonTitle.textContent = 'Waypoint Comparison';
    renderComparisonPanel(comparisonContainer, null);
  }

  // Update waypoint date input range using all series dates
  const allDates = seriesList.flatMap(s => s.entries.map(e => e.date)).sort();
  if (allDates.length > 0) {
    wpDateInput.min = allDates[0];
    wpDateInput.max = allDates[allDates.length - 1];
  }
}

// ── CSV upload → create series ───────────────────────────────────

function handleCSVUpload(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result as string;
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      alert('No valid stress data found in the CSV. Expected format:\ndate,stress_score\n2024-01-01,42');
      return;
    }

    // Derive name from filename, deduplicate
    const baseName = file.name.replace(/\.\w+$/, '') || 'Data';
    const name = deduplicateSeriesName(baseName);

    const series: Series = {
      id: `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      color: nextSeriesColor(),
      entries: parsed.sort((a, b) => a.date.localeCompare(b.date)),
      visible: true,
    };

    addSeries(series);
    refresh();
  };
  reader.readAsText(file);
}

// ── Series handlers ──────────────────────────────────────────────

function handleSeriesRename(id: string, name: string): void {
  const seriesList = getAllSeries();
  const s = seriesList.find(s => s.id === id);
  if (s) {
    updateSeries({ ...s, name });
    refresh();
  }
}

function handleSeriesColorChange(id: string, color: string): void {
  const seriesList = getAllSeries();
  const s = seriesList.find(s => s.id === id);
  if (s) {
    updateSeries({ ...s, color });
    refresh();
  }
}

function handleSeriesSelect(id: string): void {
  setActiveSeriesId(id);
  refresh();
}

function handleSeriesRemove(id: string): void {
  if (!confirm('Remove this data series? This cannot be undone.')) return;
  removeSeriesFromStorage(id);
  refresh();
}

// ── Event handlers ───────────────────────────────────────────────

uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  handleCSVUpload(file);
  fileInput.value = '';
});

clearBtn.addEventListener('click', () => {
  if (confirm('Clear all data, series, and waypoints? This cannot be undone.')) {
    clearAll();
    selectedWaypointId = null;
    refresh();
  }
});

addWaypointBtn.addEventListener('click', () => {
  const date = wpDateInput.value;
  const label = wpLabelInput.value.trim();
  const color = wpColorInput.value;

  if (!date) {
    alert('Please select a date for the waypoint.');
    return;
  }
  if (!label) {
    alert('Please enter a label for the waypoint.');
    return;
  }

  const wp: Waypoint = {
    id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    label,
    color,
  };

  addWaypoint(wp);
  wpLabelInput.value = '';
  refresh();
});

function handleRemoveWaypoint(id: string): void {
  removeWaypoint(id);
  if (selectedWaypointId === id) selectedWaypointId = null;
  refresh();
}

function handleWaypointColorChange(id: string, color: string): void {
  const waypoints = getWaypoints();
  const wp = waypoints.find(w => w.id === id);
  if (wp) {
    updateWaypoint({ ...wp, color });
    refresh();
  }
}

function handleSelectWaypoint(id: string): void {
  selectedWaypointId = id;
  refresh();

  // Scroll to comparison panel
  comparisonContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Allow pressing Enter in the label field to add waypoint
wpLabelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addWaypointBtn.click();
  }
});

// ── Drag and drop support ────────────────────────────────────────

const dropZone = document.getElementById('drop-zone') as HTMLElement;

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null || !(e.relatedTarget instanceof Node) || !document.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const file = e.dataTransfer?.files[0];
  if (!file) return;
  handleCSVUpload(file);
});

// ── Init ─────────────────────────────────────────────────────────

refresh();

// ── Ambient audio ────────────────────────────────────────────────

const forestAudio = document.getElementById('forest-audio') as HTMLAudioElement;
const ambientBtn = document.getElementById('btn-ambient') as HTMLButtonElement;

const FADE_DURATION = 1500; // ms
const TARGET_VOLUME = 0.35;

function fadeAudio(audio: HTMLAudioElement, from: number, to: number, duration: number): Promise<void> {
  return new Promise(resolve => {
    const steps = 30;
    const stepTime = duration / steps;
    const delta = (to - from) / steps;
    let current = from;
    let step = 0;
    audio.volume = from;

    const interval = setInterval(() => {
      step++;
      current += delta;
      audio.volume = Math.max(0, Math.min(1, current));
      if (step >= steps) {
        clearInterval(interval);
        audio.volume = to;
        resolve();
      }
    }, stepTime);
  });
}

function setAmbientState(playing: boolean): void {
  if (playing) {
    ambientBtn.classList.add('playing');
    document.body.classList.add('ambient-playing');
  } else {
    ambientBtn.classList.remove('playing');
    document.body.classList.remove('ambient-playing');
  }
}

ambientBtn.addEventListener('click', async () => {
  if (forestAudio.paused) {
    forestAudio.volume = 0;
    await forestAudio.play();
    setAmbientState(true);
    fadeAudio(forestAudio, 0, TARGET_VOLUME, FADE_DURATION);
  } else {
    setAmbientState(false);
    await fadeAudio(forestAudio, forestAudio.volume, 0, FADE_DURATION);
    forestAudio.pause();
  }
});
