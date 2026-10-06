const Z_INDEX_DEVTOOLS = 99_999;

const EVENT_COLUMNS = "84px 150px 52px 96px 96px 52px 36px minmax(0, 1fr) 10px";

const NARROW_EVENT_COLUMNS = "82px 140px 96px minmax(0, 1fr) 10px";

/** Scoped by the shadow root, so selectors stay short and host styles never leak in: `all: initial` stops what the host would pass down by inheritance, and it is first so the rest of the rule wins. */
export const styles = `
:host {
  all: initial; display: block; direction: ltr;
  --bg: #0d1218; --raised: #141b24; --hover: #1a232f; --border: #253040; --text: #e6ecf3; --muted: #8794a8;
  --accent: #38bdf8; --accent-text: #8bd8fb; --ok: #3fd99a; --warn: #f0b653; --error: #ff7d8c; --well: #090d12;
  --font: 12px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; --mono: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  color-scheme: dark; color: var(--text); font: var(--font); text-align: left;
}
@media (prefers-color-scheme: light) {
  :host {
    --bg: #ffffff; --raised: #f5f7fa; --hover: #eceff4; --border: #dde3ec; --text: #1a2230; --muted: #5d6a7e;
    --accent: #0369a1; --accent-text: #075985; --ok: #15803d; --warn: #b45309; --error: #c81e1e; --well: #f3f5f9; color-scheme: light;
  }
}
*, *::before, *::after { box-sizing: border-box; }
button, input { font: inherit; color: inherit; letter-spacing: normal; }
button { cursor: pointer; border: 1px solid var(--border); border-radius: 8px; background: var(--raised); padding: 5px 11px; transition: background 120ms, border-color 120ms; }
button:hover:not(:disabled) { background: var(--hover); }
button:disabled { cursor: not-allowed; opacity: 0.5; }
:is(button, input, [tabindex]):focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
p, h3, dl, dd, ul { margin: 0; padding: 0; }
code, pre { font: var(--mono); background: none; padding: 0; }
.muted { color: var(--muted); }
.brand-icon { flex-shrink: 0; color: var(--accent); }
.dot { display: inline-block; flex-shrink: 0; width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.dot:is([data-state="running"], [data-state="ready"], [data-state="supported"], [data-state="known"], [data-state="succeeded"]) { background: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 18%, transparent); }
.dot[data-state="available"] { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.dot:is([data-state="pending"], [data-state="reading"], [data-state="deprecated"], [data-state="inconclusive"], [data-state="degraded"], [data-state="checking"]) { background: var(--warn); animation: pulse 1.2s ease-in-out infinite; }
.dot:is([data-state="failure"], [data-state="unsupported"], [data-state="failed"]) { background: var(--error); box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 25%, transparent); }
@keyframes pulse { 50% { opacity: 0.35; } }
.launcher { position: fixed; z-index: ${Z_INDEX_DEVTOOLS}; right: 20px; bottom: 20px; display: inline-flex; align-items: center; gap: 10px; border-radius: 999px; padding: 9px 15px 9px 12px; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(10px); box-shadow: 0 12px 32px -12px #000c, inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent); font-weight: 500; transition: transform 120ms, background 120ms; }
.launcher:hover { transform: translateY(-1px); }
.panel { container-type: inline-size; position: fixed; z-index: ${Z_INDEX_DEVTOOLS}; left: 16px; right: 16px; bottom: 16px; max-height: calc(100dvh - 24px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(16px); box-shadow: 0 28px 80px -24px #000d; }
.panel[data-position="right"] { top: 16px; left: auto; max-width: calc(100vw - 24px); padding-left: 8px; }
.resize { flex-shrink: 0; height: 8px; cursor: row-resize; touch-action: none; background: var(--raised); border-bottom: 1px solid var(--border); }
.resize::after { content: ""; display: block; width: 40px; height: 3px; margin: 2px auto 0; border-radius: 2px; background: var(--border); }
.resize[data-position="right"] { position: absolute; top: 0; bottom: 0; left: 0; width: 8px; height: auto; cursor: col-resize; border-bottom: 0; border-right: 1px solid var(--border); }
.resize[data-position="right"]::after { width: 3px; height: 40px; margin: 0; position: absolute; top: 50%; left: 2px; transform: translateY(-50%); }
.resize:hover::after, .resize:focus-visible::after { background: var(--accent); }
.header { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; min-height: 42px; padding: 4px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
.status { display: inline-flex; align-items: center; gap: 7px; padding: 2px 9px 2px 8px; border: 1px solid var(--border); border-radius: 999px; font: var(--mono); white-space: nowrap; }
.status:is([data-state="running"], [data-state="ready"], [data-state="supported"], [data-state="known"], [data-state="succeeded"]) { border-color: color-mix(in srgb, var(--ok) 40%, transparent); color: var(--ok); }
.status[data-state="available"] { border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent-text); }
.status:is([data-state="pending"], [data-state="reading"], [data-state="deprecated"], [data-state="inconclusive"], [data-state="degraded"], [data-state="checking"]) { border-color: color-mix(in srgb, var(--warn) 40%, transparent); color: var(--warn); }
.status:is([data-state="unsupported"], [data-state="failed"]) { border-color: color-mix(in srgb, var(--error) 40%, transparent); color: var(--error); }
.counters { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--muted); font: var(--mono); }
.counters [data-alert="true"] { color: var(--error); }
.check { border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent-text); }
.capture { display: flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer; }
.capture input { margin: 0; width: 13px; height: 13px; accent-color: var(--accent); }
.icon-button { display: inline-flex; padding: 5px; border: 0; background: transparent; color: var(--muted); }
.icon-button:hover { color: var(--text); background: var(--hover); }
.body { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px minmax(0, 1fr); }
.rows { display: block; overflow: auto; padding: 8px; border-right: 1px solid var(--border); }
.row { display: flex; flex-direction: column; align-items: stretch; gap: 3px; width: 100%; margin: 0 0 2px; padding: 7px 10px; border-color: transparent; background: transparent; text-align: left; }
.row[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent-text); }
.row-name { display: flex; align-items: center; gap: 9px; overflow-wrap: anywhere; font: var(--mono); }
.row-status { margin-left: auto; color: var(--muted); }
.row small { color: var(--muted); font-size: 10px; }
.row small[data-check="failed"] { color: var(--error); }
.row-empty { padding: 4px 10px 6px; color: var(--muted); font-size: 11px; font-style: italic; }
.main { min-height: 0; display: flex; flex-direction: column; }
.detail { flex-shrink: 0; max-height: 50%; overflow: auto; border-bottom: 1px solid var(--border); background: var(--raised); }
.detail-header { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 8px 14px 4px; }
.detail-name { color: var(--accent-text); overflow-wrap: anywhere; }
.detail-close { margin-left: auto; }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px 18px; padding: 8px 14px 12px; }
.section { min-width: 0; }
.section h3 { padding-bottom: 4px; color: var(--muted); font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
.fields { display: grid; gap: 2px; }
.field { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; }
.field dt { color: var(--muted); }
.field dd { margin: 0; overflow-wrap: anywhere; }
.field [data-freshness="expired"] { color: var(--warn); }
.list { display: grid; gap: 4px; margin-top: 6px; list-style: none; }
.list li { display: flex; flex-direction: column; }
.list small, .fact small { color: var(--muted); overflow-wrap: anywhere; }
.fact { display: flex; flex-direction: column; gap: 3px; padding: 4px 0; border-top: 1px solid var(--border); }
.fact-head { display: flex; align-items: center; gap: 8px; padding-bottom: 4px; }
.raw { margin: 0; padding: 6px 8px; max-height: 120px; overflow: auto; border-radius: 6px; background: var(--well); }
.timeline { container-type: inline-size; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 12px 6px; }
.toolbar input[type="search"] { flex: 1; min-width: 160px; height: 30px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: var(--bg); }
.toolbar input::placeholder { color: var(--muted); }
.toolbar button[aria-pressed="true"] { border-color: var(--warn); color: var(--warn); }
.total { color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; border-bottom: 1px solid var(--border); }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px 2px 8px; border-radius: 999px; background: transparent; font: var(--mono); }
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
.chip[data-failure="true"]::before { background: var(--error); }
.chip[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent-text); }
.count { margin-left: auto; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--text) 8%, transparent); font-size: 10px; font-variant-numeric: tabular-nums; }
.events { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.event-head { display: grid; grid-template-columns: ${EVENT_COLUMNS}; gap: 12px; padding: 5px 14px; position: sticky; top: 0; z-index: 1; border-bottom: 1px solid var(--border); background: var(--bg); color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
.event { border-bottom: 1px solid var(--border); }
.event-summary { display: grid; grid-template-columns: ${EVENT_COLUMNS}; gap: 12px; align-items: center; width: 100%; padding: 7px 14px; border: 0; border-radius: 0; background: transparent; text-align: left; font: var(--mono); }
.event-summary > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.event time { color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.event-type { color: var(--accent-text); }
.event-reason { color: var(--muted); }
.event[data-failure="true"] { box-shadow: inset 2px 0 0 var(--error); }
.event[data-failure="true"] :is(.event-type, .event-reason) { color: var(--error); }
.expand { color: var(--muted); transition: transform 120ms; }
.event-summary[aria-expanded="true"] .expand { transform: rotate(180deg); }
.context { position: relative; background: var(--well); }
.context pre { margin: 0; padding: 12px 80px 12px 20px; overflow: auto; max-height: 260px; color: var(--text); line-height: 1.6; }
.copy { position: absolute; top: 8px; right: 12px; padding: 3px 10px; font-size: 11px; }
.empty { margin: auto; padding: 30px; max-width: 420px; text-align: center; color: var(--muted); }
.empty strong { display: block; margin-bottom: 8px; font-weight: 500; color: var(--text); }
.empty button { margin-top: 14px; }
/* Only the fixed panel box follows the viewport. Everything inside follows the panel width, and the rows follow the timeline's own. */
@media (max-width: 650px) {
  .panel { left: 6px; right: 6px; bottom: 6px; max-height: calc(100dvh - 12px); }
}
@container (min-width: 1000px) {
  .main { flex-direction: row; }
  .detail { flex: 0 0 48%; max-height: none; border-bottom: 0; border-right: 1px solid var(--border); }
}
@container (max-width: 650px) {
  .header { gap: 8px; padding: 4px 10px; }
  .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(96px, 28%) minmax(0, 1fr); }
  .rows { border-right: 0; border-bottom: 1px solid var(--border); }
}
@container (max-width: 420px) {
  .counters { display: none; }
}
/* No room for every column of a row at this width. The rest is in the expanded row. */
@container (max-width: 760px) {
  .event-head, .event-summary { grid-template-columns: ${NARROW_EVENT_COLUMNS}; gap: 6px; padding-inline: 9px; }
  .event-head > :is(:nth-child(3), :nth-child(5), :nth-child(6), :nth-child(7)),
  .event-summary > :is(:nth-child(3), :nth-child(5), :nth-child(6), :nth-child(7)) { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
