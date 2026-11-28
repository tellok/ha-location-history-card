const tag = "location-history-card";
const sampleColors = ["#007bc2", "#d45727", "#00866c", "#8856c9", "#b63477", "#657b16", "#a66a14", "#3e60bd"];
const speeds = [1, 5, 15, 60];
const defaultMovementThreshold = 50;
const maxMovementGap = 600;
const tickHours = [1 / 12, 1 / 6, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 24, 48, 72, 168, 336];
const visibilityEvent = `${tag}:visibility-changed`;
const compactTrailPoint = { radius: 2.5, stroke: 0.5 };
const markerLabelAttribute = "location_history_marker_label";
const nameSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : undefined;
const unspacedNameCharacter = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}]/u;
const panelSizing = new WeakMap();
const copy = {
  en: {
    title: "Location history", date: "Date", time: "Time", play: "Play", pause: "Pause",
    timeline: "Timeline", speed: "Playback speed", trails: "Show paths", fit: "Fit selected time range",
    refresh: "Reload history", loading: "Loading location history…", mapError: "The Home Assistant map could not load.",
    error: "Could not load location history.", noHistory: "No GPS history for the selected dates.",
    noPosition: "No recorded location at this time.", hidden: "Use an eye button to show a location.",
    config: "When provided, entities must be a list of person or device_tracker entities.",
    invalidTime: "This time does not exist on the selected date.",
    rangeStart: "Playback start", rangeEnd: "Playback end", resetRange: "Zoom out to the whole period",
    movement: "Recorded movement", noMovement: "No detected movement",
    thresholdError: "movement_threshold must be a positive number in meters.",
    noEntities: "No people or device trackers are available.",
    noGps: "No current GPS coordinates. Historical locations can still be shown.",
    trackers: "Additional device trackers", threshold: "Movement threshold (m)",
    peopleAuto: "People are added automatically. Remove anyone you want to exclude from this card.",
    visibility: "Visibility", show: "Show", hide: "Hide",
    manage: "Manage entities", people: "Observed people",
    excludedPeopleConfig: "excluded_people must be a list of person entities.",
  },
  zh: {
    title: "位置历史", date: "日期", time: "时间", play: "播放", pause: "暂停",
    timeline: "时间轴", speed: "播放速度", trails: "显示路径", fit: "聚焦选中时段",
    refresh: "重新读取历史", loading: "正在读取位置历史…", mapError: "无法加载 Home Assistant 地图。",
    error: "无法读取位置历史。", noHistory: "所选日期没有可用的 GPS 记录。",
    noPosition: "这个时间点还没有位置记录。", hidden: "点击眼睛按钮显示实体位置。",
    config: "entities 如有填写，必须是 person 或 device_tracker 实体列表。",
    invalidTime: "所选日期没有这个时间。",
    rangeStart: "回放起点", rangeEnd: "回放终点", resetRange: "缩小到整个时段",
    movement: "移动记录", noMovement: "未检测到移动",
    thresholdError: "movement_threshold 必须是以米为单位的正数。",
    noEntities: "没有可用的人员或设备追踪器。",
    noGps: "当前没有 GPS 坐标，仍可查看已有的历史位置。",
    trackers: "额外设备追踪器", threshold: "移动阈值（米）",
    peopleAuto: "人员会自动加入。可在这里移除这张卡片无需观测的人员。",
    visibility: "可见性", show: "显示", hide: "隐藏",
    manage: "管理实体", people: "观测人员",
    excludedPeopleConfig: "excluded_people 必须是 person 实体列表。",
  },
};

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host { display: block; width: 100%; min-width: 0; color: var(--primary-text-color); }
    :host([panel]) { height: 100%; min-height: 0; max-width: 100%; }
    ha-card { display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; height: 100%; }
    .map-area { position: relative; flex: 1; min-height: 0; background: var(--secondary-background-color); }
    :host(:not([panel])) .map-area { min-height: clamp(280px, 58dvh, 640px); }
    ha-map { position: absolute; inset: 0; width: 100%; height: 100%; }
    ha-map::part(marker) { line-height: 1; overflow-wrap: anywhere; }
    .message { z-index: 2; position: absolute; inset-inline-start: 12px; bottom: 32px;
      max-width: calc(100% - 24px); box-sizing: border-box; padding: 8px 12px;
      border: 1px solid var(--divider-color); border-radius: var(--ha-border-radius-md, 8px);
      box-shadow: var(--ha-box-shadow-s); background: var(--card-background-color); pointer-events: none; }
    .message[hidden] { display: none; }
    .controls { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px;
      padding: 10px clamp(12px, 2vw, 24px) 12px;
      border-top: 1px solid var(--divider-color); }
    .toolbar, .actions, .scale, .field, .playback-controls { display: flex; align-items: center; }
    .toolbar { gap: 8px 16px; flex-wrap: wrap; }
    .playback-controls { gap: 8px; }
    .actions { margin-inline-start: auto; gap: 2px; flex-wrap: wrap; max-width: 100%; }
    #manage-entities { margin-inline-end: 4px; }
    #manage-entities[hidden] { display: none; }
    .title { margin: 0; font-size: var(--ha-font-size-l, 16px); font-weight: var(--ha-font-weight-medium, 500); }
    .field { gap: 6px; font-size: var(--ha-font-size-s, 13px); color: var(--secondary-text-color); }
    .field ha-input { --ha-input-padding-bottom: 0px; }
    #date { inline-size: 9rem; }
    #date-field[hidden], #dates[hidden] { display: none; }
    #dates { flex: 1 1 100%; min-inline-size: 0; max-inline-size: 100%; }
    #speed-button { --ha-button-border-radius: var(--ha-border-radius-md); }
    #speed-button ha-icon { --mdc-icon-size: 16px; }
    button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
    .history-timeline { --label-width: clamp(108px, 16%, 175px); --trim-inset: 17px; min-width: 0;
      padding-top: 18px; touch-action: pan-y; }
    .timeline-plot { position: relative; isolation: isolate; }
    .timeline-reference { position: absolute; z-index: 1; inset-block: 0; inset-inline-end: var(--trim-inset);
      inset-inline-start: calc(var(--label-width) + var(--trim-inset)); pointer-events: none; }
    .tick-grid { position: absolute; inset: 0; }
    .time-tick { position: absolute; inset-block: 0; border-left: 1px solid
      color-mix(in srgb, var(--secondary-text-color) 24%, transparent); }
    .time-tick span { position: absolute; bottom: 100%; left: 0; transform: translateX(-50%); white-space: nowrap;
      padding-bottom: 2px; color: var(--secondary-text-color); font-size: var(--ha-font-size-xs, 12px);
      font-variant-numeric: tabular-nums; }
    .time-tick:first-child span { transform: none; }
    .movement { max-height: min(24dvh, 180px); overflow: auto; scrollbar-width: none; }
    .movement-row, .trim-row { display: grid; grid-template-columns: var(--label-width) minmax(0, 1fr); align-items: center; }
    .movement-row { min-height: 30px; }
    .movement-track, .trim, .scale { margin-inline: var(--trim-inset); direction: ltr; }
    .movement-track { position: relative; height: 8px; border-radius: 999px; background: var(--divider-color); }
    .movement-row[data-hidden] .movement-track { visibility: hidden; }
    .movement-track[title] { cursor: ew-resize; }
    .movement-segment { position: absolute; top: 0; bottom: 0; min-width: 2px;
      border-radius: inherit; background: var(--entity-color); }
    .trim { grid-column: 2; position: relative; height: 36px; margin-top: 3px; touch-action: none; cursor: crosshair;
      --trim-color: var(--warning-color, #f4b942); }
    .trim[aria-disabled="true"] { opacity: 0.5; cursor: default; }
    .trim::before { content: ""; position: absolute; inset: 5px 0; border-radius: 6px;
      background: var(--secondary-background-color); border: 1px solid var(--divider-color); }
    .selection { position: absolute; inset: 5px calc(100% - var(--clip-end)) 5px var(--clip-start);
      border-block: 2px solid var(--trim-color);
      background: color-mix(in srgb, var(--trim-color) 23%, var(--card-background-color)); pointer-events: none; }
    .trim-control { position: absolute; z-index: 2; padding: 0; border: 0; appearance: none; }
    .trim-handle { top: 3px; bottom: 3px; width: 16px; background: var(--trim-color); cursor: ew-resize; }
    #range-start { left: var(--clip-start); transform: translateX(-100%); border-radius: 6px 0 0 6px; }
    #range-end { left: var(--clip-end); border-radius: 0 6px 6px 0; }
    .trim-handle::before { content: ""; display: block; margin: auto; width: 3px; height: 12px;
      border-inline: 1px solid rgba(0, 0, 0, 0.6); }
    .playhead-guide { position: absolute; inset-block: 0; left: var(--playhead);
      width: 24px; transform: translateX(-50%); padding: 0; border: 0; background: transparent;
      pointer-events: auto; touch-action: none; cursor: ew-resize; }
    .playhead-guide::before { content: ""; position: absolute; inset-block: 0; left: 50%;
      width: 3px; transform: translateX(-50%); background: var(--primary-color);
      box-shadow: 0 0 0 1px var(--card-background-color); }
    .playhead-guide:focus-visible { outline: none; }
    .playhead-guide:focus-visible:not([data-pointer-focus])::after {
      content: ""; position: absolute; inset-block-start: 0; left: 50%;
      width: 9px; height: 9px; transform: translateX(-50%); border-radius: 50%;
      background: var(--primary-color); box-shadow: 0 0 0 1px var(--card-background-color);
    }
    .playhead-guide:disabled { opacity: 0.5; pointer-events: none; }
    .trim-control:focus-visible { z-index: 3; }
    .scale-row { padding-inline-start: var(--label-width); }
    .scale { justify-content: space-between; gap: 6px; color: var(--secondary-text-color);
      font-size: var(--ha-font-size-xs, 12px); font-variant-numeric: tabular-nums; }
    .scale > * { min-width: 0; overflow-wrap: anywhere; }
    output { color: var(--primary-text-color); font-weight: var(--ha-font-weight-medium, 500); }
    .visibility { display: flex; gap: 6px; align-items: center; min-width: 0; min-height: 30px;
      font: inherit; font-size: var(--ha-font-size-s, 13px); text-align: start; color: var(--primary-text-color);
      border: 0; padding: 0 4px; border-radius: 6px; background: transparent; cursor: pointer; }
    .visibility[aria-pressed="false"], .visibility .eye { color: var(--secondary-text-color); }
    .visibility[aria-pressed="true"] .eye { color: var(--primary-color); }
    .visibility:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
    .visibility ha-icon { --mdc-icon-size: 13px; flex-shrink: 0; }
    .visibility .tracker-warning { color: var(--warning-color); }
    .visibility .tracker-warning[hidden] { display: none; }
    .entity-color { flex: 0 0 8px; height: 8px; border-radius: 50%; background: var(--entity-color); }
    .movement-row[data-hidden] .entity-color { background: transparent; box-shadow: inset 0 0 0 1px var(--entity-color); }
    .entity-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trails { white-space: nowrap; }
    @media (max-width: 620px) {
      .toolbar { gap: 5px 9px; }
      .title { flex-basis: 100%; }
      .actions { margin-inline-start: 0; }
      .controls { gap: 4px; }
    }
    @media (max-height: 360px) {
      :host([panel]) .controls { min-height: 0; overflow: auto; overscroll-behavior: contain; }
    }
  </style>
  <ha-card>
    <div class="map-area">
      <div class="message" role="status" hidden></div>
    </div>
    <div class="controls">
      <div class="toolbar">
        <h2 class="title" hidden></h2>
        <ha-date-range-picker id="dates" hidden></ha-date-range-picker>
        <div class="field" id="date-field"><span id="date-label"></span><ha-input id="date" appearance="outlined" type="date"></ha-input></div>
        <div class="playback-controls">
          <ha-button id="play" appearance="accent" size="s"><ha-icon slot="start"></ha-icon><span></span></ha-button>
          <ha-dropdown id="speed" placement="bottom-start">
            <ha-button id="speed-button" slot="trigger" variant="neutral" appearance="outlined" size="s">
              <span></span><ha-icon slot="end" icon="mdi:chevron-down"></ha-icon>
            </ha-button>
            ${speeds.map((speed) => `<ha-dropdown-item value="${speed}">${speed}×</ha-dropdown-item>`).join("")}
          </ha-dropdown>
        </div>
        <ha-switch class="trails" id="trails"></ha-switch>
        <div class="actions">
          <ha-button id="manage-entities" appearance="outlined" variant="neutral" size="s" hidden>
            <ha-icon slot="start" icon="mdi:playlist-edit"></ha-icon><span></span>
          </ha-button>
          <ha-icon-button id="reset-range"><ha-icon icon="mdi:arrow-expand-horizontal"></ha-icon></ha-icon-button>
          <ha-icon-button id="refresh"><ha-icon icon="mdi:refresh"></ha-icon></ha-icon-button>
          <ha-icon-button id="fit"><ha-icon icon="mdi:image-filter-center-focus"></ha-icon></ha-icon-button>
        </div>
      </div>
      <div id="timeline-area" class="history-timeline">
        <div id="timeline-plot" class="timeline-plot" style="--playhead: 0%">
          <div id="movement" class="movement" role="group"></div>
          <div class="trim-row">
            <div id="trim" class="trim" style="--clip-start: 0%; --clip-end: 100%">
              <div class="selection"></div>
              <button id="range-start" class="trim-control trim-handle" type="button" role="slider" data-handle="start"></button>
              <button id="range-end" class="trim-control trim-handle" type="button" role="slider" data-handle="end"></button>
            </div>
          </div>
          <div class="timeline-reference">
            <div id="tick-grid" class="tick-grid" aria-hidden="true"></div>
            <button id="timeline" class="playhead-guide" type="button" role="slider" data-handle="cursor" disabled></button>
          </div>
        </div>
        <div class="scale-row">
          <div class="scale"><span id="start"></span><output for="timeline"></output><span id="end"></span></div>
        </div>
      </div>
    </div>
  </ha-card>`;

function createClock(zone, locale) {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const display = new Intl.DateTimeFormat(locale, {
    timeZone: zone, hour: "numeric", minute: "2-digit", second: "2-digit",
  });
  const tick = new Intl.DateTimeFormat(locale, {
    timeZone: zone, hour: "numeric", minute: "2-digit",
  });
  // Used when the window spans more than a day, so times say which day they are on.
  const displayDay = new Intl.DateTimeFormat(locale, {
    timeZone: zone, weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const tickDay = new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "short", day: "numeric" });
  const utcDate = (key) => Date.parse(`${key}T00:00:00Z`) / 1000;
  const dateAt = (second) => date.format(second * 1000);
  const timeAt = (second) => time.format(second * 1000);
  // Find the local day boundary on the UTC timeline, including 23- and 25-hour days.
  function midnight(key) {
    let low = utcDate(key) - 36 * 3600;
    let high = utcDate(key) + 36 * 3600;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (dateAt(mid) < key) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  return {
    dateAt, timeAt, display, tick, displayDay, tickDay,
    // The whole local day for a YYYY-MM-DD key, as [start, end) seconds.
    day(key) {
      const nextKey = new Date((utcDate(key) + 86400) * 1000).toISOString().slice(0, 10);
      return { start: midnight(key), end: midnight(nextKey) };
    },
    window({ start, end }, now) {
      return { start, end, last: Math.max(start, Math.min(end - 1, now)) };
    },
  };
}

function countThrough(samples, second, inclusive = true) {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const time = samples[mid].second;
    if (time < second || (inclusive && time === second)) low = mid + 1;
    else high = mid;
  }
  return low;
}

function trailSections(trail, first, elapsed, end) {
  if (trail.length < 2) return [];
  if (first === end) return [{ points: trail, faded: true }];

  const sections = [];
  if (first > 0) {
    // Share the first reached in-range sample to keep the boundary segment connected.
    sections.push({ points: trail.slice(0, first + (elapsed > first ? 1 : 0)), faded: true });
  }
  if (end < trail.length) {
    sections.push({ points: trail.slice(end - 1), faded: true });
  }
  if (elapsed - first > 1 || (elapsed > first && sections.length)) {
    sections.push({ points: trail.slice(first, elapsed), faded: false });
  }
  return sections;
}

const entityId = (entry) => typeof entry === "string" ? entry : entry?.entity;
const isPerson = (id) => typeof id === "string" && /^person\.[a-z0-9_]+$/.test(id);
const isTracker = (id) => typeof id === "string" && id.startsWith("device_tracker.");
const friendlyName = (attributes) => typeof attributes?.friendly_name === "string" ? attributes.friendly_name.trim() : "";
const entityName = (states, id, recordedName) => friendlyName(states?.[id]?.attributes) || recordedName || id;

function groupMarkersBy(markers, field) {
  const groups = new Map();
  for (const marker of markers) {
    const key = marker[field];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(marker);
  }
  return groups;
}

function nameInitials(name) {
  const normalized = name.normalize();
  const characters = nameSegmenter
    ? Array.from(nameSegmenter.segment(normalized), ({ segment }) => segment)
    : normalized.match(/\P{Mark}\p{Mark}*|\p{Mark}+/gu) ?? [];
  const initials = [];
  let atStart = true;
  for (let index = 0; index < characters.length; index++) {
    let character = characters[index];
    // Some segmenters return marks such as Burmese visarga as separate segments.
    while (/^\p{Mark}/u.test(characters[index + 1] ?? "")) {
      character += characters[++index];
    }
    if (/^\s/u.test(character)) {
      atStart = true;
      continue;
    }
    const individualPart = unspacedNameCharacter.test(character);
    if (atStart || individualPart) initials.push(character.toUpperCase());
    atStart = individualPart;
  }
  return initials;
}

function markerLabels(markers) {
  const textMarkers = markers.filter(({ picture }) => !picture).map(({ id, name }) => {
    const objectId = id.split(".")[1];
    const label = name === id ? objectId.replaceAll("_", " ").trim() || objectId : name;
    const givenName = name === id ? label : label.replace(/\s+\S+$/u, "");
    const initials = nameInitials(label);
    return { id, label, givenName, first: initials[0], initials: initials.join("") };
  });
  if (markers.length === 1) return new Map(textMarkers.map(({ id, label }) => [id, label]));

  const labels = new Map();
  for (const [first, group] of groupMarkersBy(textMarkers, "first")) {
    if (group.length === 1) {
      labels.set(group[0].id, first);
      continue;
    }
    const byCharacter = group.filter(({ label }) => unspacedNameCharacter.test(label));
    for (const [initials, matches] of groupMarkersBy(byCharacter, "initials")) {
      for (const { id, label } of matches) labels.set(id, matches.length === 1 ? initials : label);
    }
    const byWord = group.filter(({ label }) => !unspacedNameCharacter.test(label));
    for (const [givenName, matches] of groupMarkersBy(byWord, "givenName")) {
      for (const { id, label } of matches) labels.set(id, matches.length === 1 ? givenName : label);
    }
  }
  return labels;
}

function hasCoordinates(attributes) {
  const { latitude, longitude } = attributes ?? {};
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function hasLinkedGpsTracker(person, states) {
  const linked = person?.attributes.device_trackers;
  return Array.isArray(linked) && linked.some((id) => {
    if (!isTracker(id)) return false;
    const attributes = states[id]?.attributes;
    return attributes?.source_type === "gps" || hasCoordinates(attributes);
  });
}

function observedPeople(config, states) {
  const excluded = new Set(config.excluded_people ?? []);
  const people = [
    ...Object.keys(states ?? {}).filter(isPerson),
    ...(config.entities ?? []).map(entityId).filter(isPerson),
  ];
  return [...new Set(people)].filter((id) => !excluded.has(id)).sort();
}

function composedParent(node) {
  return node.assignedSlot ?? node.parentElement ?? node.getRootNode().host;
}

function editableCardPath(card) {
  const wrapper = card.parentElement;
  if (wrapper?.localName !== "hui-card") return undefined;
  let node = wrapper;
  while (node && node.localName !== "hui-view") {
    node = composedParent(node);
  }
  const lovelace = node?.lovelace;
  const index = node?.index;
  const view = lovelace?.config?.views?.[index];
  if (lovelace?.mode !== "storage" || !view || view.strategy || lovelace.rawConfig?.strategy) return undefined;

  // Resolve the wrapper by config identity, so identical-looking cards can be edited independently.
  const base = ["views", index];
  const directIndex = view.cards?.indexOf(wrapper.config) ?? -1;
  if (directIndex >= 0) return [...base, "cards", directIndex];
  for (const [sectionIndex, section] of (view.sections ?? []).entries()) {
    const cardIndex = section.cards?.indexOf(wrapper.config) ?? -1;
    if (cardIndex >= 0) return [...base, "sections", sectionIndex, "cards", cardIndex];
  }
  return undefined;
}

function fitPanelToViewport(card) {
  let view = composedParent(card);
  while (view && view.localName !== "hui-view-container") view = composedParent(view);
  if (!view || view.getRootNode().host?.hasAttribute("embedded")) return undefined;
  panelSizing.get(view)?.();

  const doc = card.ownerDocument;
  const win = doc.defaultView;
  const root = doc.documentElement;
  const viewport = win.visualViewport;
  const save = (element, name) => {
    const value = element.style.getPropertyValue(name);
    const priority = element.style.getPropertyPriority(name);
    return () => element.style.setProperty(name, value, priority);
  };
  const restoreView = ["min-block-size", "block-size", "max-inline-size"].map((name) => save(view, name));
  const restoreRoot = save(root, "max-block-size");
  let cappedRoot = false;
  let frame;
  const refresh = () => {
    if (frame !== undefined) return;
    frame = win.requestAnimationFrame(() => {
      frame = undefined;
      const bounds = view.getBoundingClientRect();
      if (!bounds.width) return;
      const zoom = view.currentCSSZoom || bounds.width / view.offsetWidth || 1;
      const { clientWidth, clientHeight } = root;
      // The visual viewport accounts for the mobile browser chrome without
      // resizing the dashboard into the magnified area during a pinch zoom.
      const useVisual = viewport?.scale === 1;
      const width = useVisual ? Math.min(clientWidth, viewport.width) : clientWidth;
      const height = useVisual ? Math.min(clientHeight, viewport.height) : clientHeight;
      const availableWidth = Math.max(0, Math.floor((width - bounds.left - win.scrollX) / zoom));
      const availableHeight = Math.max(0, Math.floor((height - bounds.top - win.scrollY) / zoom));
      if (!availableWidth || !availableHeight) return;
      // CSS zoom can enlarge HA's percentage-sized app shell as well as the view.
      const rootZoom = root.currentCSSZoom || Number.parseFloat(win.getComputedStyle(root).zoom) || 1;
      if (rootZoom > 1) {
        root.style.setProperty("max-block-size", `${Math.floor(height / rootZoom)}px`);
        cappedRoot = true;
      } else if (cappedRoot) {
        restoreRoot();
        cappedRoot = false;
      }
      view.style.setProperty("min-block-size", "0px");
      view.style.setProperty("block-size", `${availableHeight}px`);
      view.style.setProperty("max-inline-size", `min(100%, ${availableWidth}px)`);
    });
  };
  const observer = new ResizeObserver(refresh);
  observer.observe(view);
  observer.observe(root);
  win.addEventListener("resize", refresh);
  viewport?.addEventListener("resize", refresh);
  refresh();
  const stop = () => {
    if (panelSizing.get(view) !== stop) return;
    panelSizing.delete(view);
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    observer.disconnect();
    win.removeEventListener("resize", refresh);
    viewport?.removeEventListener("resize", refresh);
    for (const restore of restoreView) restore();
    if (cappedRoot) restoreRoot();
  };
  panelSizing.set(view, stop);
  return stop;
}

function toSamples(rows, start) {
  const locations = [];
  for (const row of rows) {
    const second = row.lu ?? row.lc;
    const { latitude, longitude } = row.a ?? {};
    if (!Number.isFinite(second) || !hasCoordinates(row.a)) continue;
    locations.push({
      second,
      point: [latitude, longitude],
      timestamp: new Date(second * 1000),
      state: row.s,
      attributes: row.a,
    });
  }
  locations.sort((a, b) => a.second - b.second);
  const first = locations.findIndex((sample) => sample.second >= start);
  const day = first === -1 ? [] : locations.slice(first);
  const baseline = first === -1 ? locations.at(-1) : locations[first - 1];
  // Keep the first point and all moves, but skip repeated coordinates in the trail.
  const trail = day.filter(({ point }, index) =>
    index === 0 || point[0] !== day[index - 1].point[0] || point[1] !== day[index - 1].point[1]);
  const name = friendlyName(locations.findLast(({ attributes }) => friendlyName(attributes))?.attributes);
  return { day, baseline, trail, name };
}

function distanceMeters(a, b) {
  const radians = Math.PI / 180;
  const latitudeDelta = (b[0] - a[0]) * radians;
  const longitudeDelta = (b[1] - a[1]) * radians;
  const arc = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a[0] * radians) * Math.cos(b[0] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

function movementIntervals(samples, threshold) {
  const intervals = [];
  let anchor = samples[0];
  let previous = anchor;
  let departure;
  for (let index = 1; index < samples.length; index++) {
    const sample = samples[index];
    const distance = distanceMeters(anchor.point, sample.point);
    const accuracy = [anchor.attributes.gps_accuracy, sample.attributes.gps_accuracy]
      .filter(Number.isFinite);
    const minimum = Math.max(threshold, ...accuracy);
    // Accumulate gradual displacement. Start at the first departure from the
    // anchor, while leaving prolonged gaps between samples unshaded.
    if (sample.second - previous.second > maxMovementGap) departure = sample.second;
    else if (distance < minimum / 2) departure = undefined;
    else departure ??= previous.second;

    if (distance >= minimum) {
      const start = sample.second - departure <= maxMovementGap ? departure : previous.second;
      const latest = intervals.at(-1);
      if (latest && start <= latest.end) latest.end = sample.second;
      else intervals.push({ start, end: sample.second });
      anchor = sample;
      departure = undefined;
    }
    previous = sample;
  }
  return intervals;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

async function loadNativeMap() {
  if (customElements.get("ha-map")) return;
  await customElements.whenDefined("hui-card");
  const loader = document.createElement("hui-card");
  loader.config = { type: "map", entities: [] };
  loader.load();
  let timeout;
  try {
    await Promise.race([
      customElements.whenDefined("ha-map"),
      new Promise((_, reject) => { timeout = setTimeout(reject, 12000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadDateRangePicker() {
  if (customElements.get("ha-date-range-picker")) return;
  await customElements.whenDefined("hui-card");
  // The energy date selection card bundles Home Assistant's date range picker.
  const loader = document.createElement("hui-card");
  loader.config = { type: "energy-date-selection" };
  loader.load();
  let timeout;
  try {
    await Promise.race([
      customElements.whenDefined("ha-date-range-picker"),
      new Promise((_, reject) => { timeout = setTimeout(reject, 12000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function styleTrailPoints(engine) {
  const compact = window.matchMedia("(max-width: 620px), (pointer: coarse) and (max-width: 950px)");
  // HA's map component does not expose trail sizing. Adjust only the native
  // trail point layers on this card's engine, using its original paint on wide screens.
  const map = engine?._map;
  const pointLayers = engine?._pathPointLayers;
  if (map?.setPaintProperty && pointLayers) {
    const defaults = new Map();
    let frame;
    const refresh = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (engine._map !== map) return;
        for (const id of defaults.keys()) {
          if (!pointLayers.has(id)) defaults.delete(id);
        }
        for (const id of pointLayers) {
          if (!map.getLayer(id)) continue;
          const paint = {
            radius: map.getPaintProperty(id, "circle-radius"),
            stroke: map.getPaintProperty(id, "circle-stroke-width"),
          };
          if (compact.matches && !defaults.has(id)) defaults.set(id, paint);
          const next = compact.matches ? compactTrailPoint : defaults.get(id);
          if (!next) continue;
          if (paint.radius !== next.radius) map.setPaintProperty(id, "circle-radius", next.radius);
          if (paint.stroke !== next.stroke) map.setPaintProperty(id, "circle-stroke-width", next.stroke);
        }
      });
    };
    map.on("styledata", refresh);
    compact.addEventListener("change", refresh);
    refresh();
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      compact.removeEventListener("change", refresh);
      map.off("styledata", refresh);
    };
  }

  const leaflet = engine?.leafletMap;
  if (!leaflet?.eachLayer) return undefined;
  const defaults = new WeakMap();
  const resize = (layer) => {
    if (!layer.setRadius || !layer.getTooltip?.()) return;
    if (compact.matches && !defaults.has(layer)) {
      defaults.set(layer, { radius: layer.getRadius(), stroke: layer.options.weight });
    }
    const next = compact.matches ? compactTrailPoint : defaults.get(layer);
    if (!next) return;
    if (layer.getRadius() !== next.radius) layer.setRadius(next.radius);
    if (layer.options.weight !== next.stroke) layer.setStyle({ weight: next.stroke });
  };
  const refresh = () => leaflet.eachLayer(resize);
  const layerAdded = ({ layer }) => resize(layer);
  leaflet.on("layeradd", layerAdded);
  compact.addEventListener("change", refresh);
  refresh();
  return () => {
    compact.removeEventListener("change", refresh);
    leaflet.off("layeradd", layerAdded);
  };
}

class LocationHistoryCard extends HTMLElement {
  #hass;
  #config;
  #nodes;
  #clock;
  #zone;
  #period;
  #window;
  #view;
  #cursor;
  #range;
  #drag;
  #history = new Map();
  #entities = [];
  #defaultVisibility = new Set();
  #visibilityOverrides = new Map();
  #visibilityKey;
  #markerStates = {};
  #provideStates;
  #map;
  #stopTrailStyling;
  #frame;
  #request = 0;
  #status = "";
  #mapError = false;
  #animation;
  #playbackSpeed = 1;
  #lastTick;
  #language;
  #text = copy.en;
  #layout;
  #preview = false;
  #stopPanelSizing;
  #tickResize = new ResizeObserver(() => this.#renderTicks());
  #linesHooked;
  #lineOpacity = new WeakMap();

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.append(template.content.cloneNode(true));
    this.#nodes = Object.fromEntries([...root.querySelectorAll("[id]")].map((el) => [el.id, el]));
    for (const key of ["title", "message", "output", "map-area"]) {
      this.#nodes[key] = root.querySelector(`.${key}`) ?? root.querySelector(key);
    }

    // On the native map only, provide historical entity states in Lit's context.
    root.addEventListener("context-request", (event) => {
      if (event.context !== "states" || event.composedPath()[0] !== this.#map) return;
      event.stopPropagation();
      const callback = event.callback;
      const publish = (states) => callback(states, dispose);
      const dispose = () => { if (this.#provideStates === publish) this.#provideStates = undefined; };
      if (event.subscribe) this.#provideStates = publish;
      publish(this.#markerStates);
    });

    const { date, dates, play, speed, trails, fit, refresh } = this.#nodes;
    const timelineArea = this.#nodes["timeline-area"];
    date.addEventListener("change", () => {
      const today = this.#clock.dateAt(this.#now());
      if (!date.value || date.value > today) { date.value = this.#clock.dateAt(this.#period.start); return; }
      this.#period = this.#clock.day(date.value);
      this.#loadHistory();
    });
    // Home Assistant's date range picker (presets, previous / next): any span of whole days.
    dates.extendedPresets = true;
    dates.timePicker = false;
    dates.addEventListener("value-changed", (event) => {
      const { startDate, endDate } = event.detail?.value ?? {};
      if (!(startDate instanceof Date) || !(endDate instanceof Date)) return;
      const start = Math.floor(startDate.getTime() / 1000);
      const end = Math.ceil(endDate.getTime() / 1000);
      if (!(end > start) || start > this.#now()) return;
      this.#period = { start, end };
      this.#loadHistory();
    });
    speed.addEventListener("wa-select", (event) => {
      const selected = Number(event.detail.item.value);
      if (!speeds.includes(selected)) return;
      this.#playbackSpeed = selected;
      this.#updateSpeed();
    });
    timelineArea.addEventListener("pointerdown", this.#startDrag);
    timelineArea.addEventListener("pointermove", this.#moveDrag);
    timelineArea.addEventListener("pointerup", this.#moveDrag);
    timelineArea.addEventListener("lostpointercapture", () => {
      const kind = this.#drag?.kind;
      this.#drag = undefined;
      // Letting go of a start / end handle zooms the timeline (and the map) into the chosen stretch.
      if (kind === "start" || kind === "end") this.#setView({ start: this.#range.start, last: this.#range.end });
    });
    timelineArea.addEventListener("keydown", this.#handleTimelineKey);
    this.#nodes.timeline.addEventListener("blur", (event) => {
      event.currentTarget.removeAttribute("data-pointer-focus");
    });
    this.#nodes["reset-range"].addEventListener("click", () => {
      this.#pause();
      this.#range = { start: this.#window.start, end: this.#window.last };
      this.#setView({ start: this.#window.start, last: this.#window.last });
    });
    play.addEventListener("click", () => this.#animation === undefined ? this.#start() : this.#pause());
    trails.addEventListener("change", () => this.#applyLines());
    fit.addEventListener("click", () => this.#fit(false));
    refresh.addEventListener("click", () => {
      this.#attachMap();
      this.#loadHistory({ keepTime: true });
    });
    this.#nodes["manage-entities"].addEventListener("click", () => {
      if (!this.#hass?.user?.is_admin || this.#preview) return;
      const path = editableCardPath(this);
      if (path) {
        this.dispatchEvent(new CustomEvent("ll-edit-card", { bubbles: true, composed: true, detail: { path } }));
      }
    });
  }

  static getStubConfig() { return {}; }

  static async getConfigElement() {
    if (!customElements.get("ha-form")) {
      await customElements.get("hui-entities-card")?.getConfigElement();
    }
    return document.createElement(`${tag}-editor`);
  }

  setConfig(config) {
    const entities = config.entities ?? [];
    if (!Array.isArray(entities) || !entities.map(entityId).every((id) =>
      typeof id === "string" && /^(person|device_tracker)\.[a-z0-9_]+$/.test(id))) {
      throw new Error(this.#text.config);
    }
    const excluded = config.excluded_people ?? [];
    if (!Array.isArray(excluded) || !excluded.every(isPerson)) {
      throw new Error(this.#text.excludedPeopleConfig);
    }
    const movementThreshold = config.movement_threshold ?? defaultMovementThreshold;
    if (!Number.isFinite(movementThreshold) || movementThreshold <= 0) {
      throw new Error(this.#text.thresholdError);
    }
    this.#config = { ...config, entities: [...new Set(entities.map(entityId))], movementThreshold };
    this.#nodes.trails.checked = config.show_trails !== false;
    this.#updateLabels();
    this.#syncEntities();
    this.#renderMovement();
    if (this.isConnected && this.#clock) this.#loadHistory({ keepTime: true });
  }

  set hass(hass) {
    const wasConnected = this.#hass?.connected;
    this.#hass = hass;
    const userId = hass.user?.id;
    const visibilityKey = userId ? `${tag}:visibility:${userId}:` : undefined;
    const preferencesChanged = this.#visibilityKey !== visibilityKey;
    if (preferencesChanged) {
      this.#visibilityKey = visibilityKey;
      this.#visibilityOverrides.clear();
      this.#restoreVisibility();
    }
    const language = hass.language || "en";
    const zone = hass.config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const languageChanged = this.#language !== language;
    const zoneChanged = this.#zone !== zone;
    if (languageChanged) {
      this.#language = language;
      this.#text = language.toLowerCase().startsWith("zh") ? copy.zh : copy.en;
      this.#updateLabels();
    }
    if (zoneChanged || languageChanged) {
      this.#clock = createClock(zone, language);
    }
    const { entitiesChanged, defaultsChanged } = this.#syncEntities();
    if (zoneChanged) {
      this.#zone = zone;
      this.#period = this.#clock.day(this.#clock.dateAt(this.#now()));
      if (this.isConnected) this.#loadHistory();
    } else if (this.isConnected && (entitiesChanged || (wasConnected === false && hass.connected))) {
      this.#loadHistory({ keepTime: true });
    }
    if (languageChanged) {
      this.#renderMovement();
      this.#renderTicks();
    }
    const picturesChanged = this.#frame?.some(({ id, marker, picture }) =>
      marker && picture !== this.#markerPicture(id));
    if (languageChanged || defaultsChanged || preferencesChanged || picturesChanged || !this.#frame) {
      this.#renderFrame();
    }
    this.#updateManageButton();
  }

  set layout(value) {
    this.#layout = value;
    this.#updateLayout();
  }

  set preview(value) {
    this.#preview = value;
    this.#updateLayout();
    this.#updateManageButton();
  }

  #updateLayout() {
    const panel = this.#layout === "panel" && !this.#preview;
    this.toggleAttribute("panel", panel);
    if (panel && this.isConnected) this.#stopPanelSizing ??= fitPanelToViewport(this);
    else {
      this.#stopPanelSizing?.();
      this.#stopPanelSizing = undefined;
    }
  }

  getCardSize() { return 8; }
  getGridOptions() { return { columns: "full", rows: "auto", min_columns: 6 }; }

  connectedCallback() {
    this.#updateLayout();
    window.addEventListener("storage", this.#onVisibilityStorage);
    window.addEventListener(visibilityEvent, this.#onVisibilityEvent);
    this.#restoreVisibility();
    this.#renderEntities();
    this.#updateManageButton();
    this.#tickResize.observe(this.#nodes["tick-grid"]);
    if (this.#clock && this.#config) this.#loadHistory({ keepTime: true });
    this.#attachPicker();
    this.#attachMap();
  }

  disconnectedCallback() {
    this.#stopPanelSizing?.();
    this.#stopPanelSizing = undefined;
    window.removeEventListener("storage", this.#onVisibilityStorage);
    window.removeEventListener(visibilityEvent, this.#onVisibilityEvent);
    this.#tickResize.disconnect();
    this.#stopTrailStyling?.();
    this.#stopTrailStyling = undefined;
    this.#pause();
    this.#drag = undefined;
    this.#request++;
  }

  #now() { return Math.floor(Date.now() / 1000); }

  async #attachPicker() {
    try {
      await loadDateRangePicker();
      this.#nodes.dates.hidden = false;
      this.#nodes["date-field"].hidden = true;
    } catch {
      // Keep the plain single-day date field.
    }
  }

  async #attachMap() {
    if (this.#map) return;
    this.#mapError = false;
    try {
      await loadNativeMap();
      if (!this.isConnected || this.#map) return;
      this.#map = document.createElement("ha-map");
      this.#map.zoom = 14;
      this.#map.zoomPosition = "topright";
      this.#map.clusterMarkers = true;
      this.#map.scaleRuler = true;
      this.#map.autoFit = false;
      this.#map.addEventListener("editing-available-changed", () => {
        this.#stopTrailStyling?.();
        this.#stopTrailStyling = this.isConnected ? styleTrailPoints(this.#map._engine) : undefined;
      });
      this.#nodes["map-area"].prepend(this.#map);
      this.#frame = undefined;
      this.#renderFrame();
      this.#fit(true);
    } catch {
      this.#mapError = true;
      this.#renderFrame();
    }
  }

  async #loadHistory({ keepTime = false } = {}) {
    if (!this.#config || !this.#clock || !this.isConnected) return;
    const request = ++this.#request;
    this.#pause();
    const oldCursor = this.#cursor;
    const oldLast = this.#window?.last;
    const oldRange = this.#range;
    const oldView = this.#view;
    const now = this.#now();
    this.#nodes.date.max = this.#clock.dateAt(now);
    this.#nodes.date.value = this.#clock.dateAt(this.#period.start);
    this.#nodes.dates.startDate = new Date(this.#period.start * 1000);
    this.#nodes.dates.endDate = new Date(this.#period.end * 1000 - 1);
    this.#window = this.#clock.window(this.#period, now);
    const { start, end, last } = this.#window;
    const rangeEnd = keepTime && oldRange && oldRange.end !== oldLast ? clamp(oldRange.end, start, last) : last;
    this.#range = {
      start: keepTime && oldRange ? clamp(oldRange.start, start, rangeEnd) : start,
      end: rangeEnd,
    };
    // The timeline shows the whole period, or the stretch it was zoomed into (kept on refresh).
    this.#view = {
      start: keepTime && oldView ? clamp(oldView.start, start, this.#range.start) : start,
      last: keepTime && oldView && oldView.last !== oldLast ? clamp(oldView.last, this.#range.end, last) : last,
    };
    // Start at the end of the range so every trail in it is drawn; Play replays from the start.
    this.#cursor = keepTime && oldCursor !== undefined && oldCursor !== oldLast
      ? clamp(oldCursor, this.#range.start, this.#range.end)
      : this.#range.end;
    const entityIds = this.#entities;
    this.#status = entityIds.length ? "loading" : "";
    this.#history.clear();
    this.#frame = undefined;
    this.#renderEntities();
    this.#renderMovement();
    this.#renderTicks();
    this.#renderFrame();
    if (!entityIds.length) return;

    try {
      const result = await this.#hass.callWS({
        type: "history/history_during_period",
        // Recorder dates the preceding state at the query start. Offset the
        // start by 1 ms so this baseline can never turn into a midnight trail point.
        start_time: new Date(start * 1000 - 1).toISOString(),
        end_time: new Date(Math.min(end, now + 1) * 1000).toISOString(),
        entity_ids: entityIds,
        include_start_time_state: true,
        significant_changes_only: false,
        minimal_response: false,
        no_attributes: false,
      });
      if (request !== this.#request) return;
      this.#history = new Map(entityIds.map((id) => {
        const series = toSamples(result[id] ?? [], start);
        const movement = movementIntervals(series.day, this.#config.movementThreshold);
        return [id, { ...series, movement }];
      }));
      this.#status = "";
      this.#renderEntities();
      this.#renderMovement();
      this.#renderFrame();
      this.#fit(true);
    } catch {
      if (request !== this.#request) return;
      this.#status = "error";
      this.#renderFrame();
    }
  }

  #updateLabels() {
    const text = this.#text;
    const title = String(this.#config?.title ?? "").trim();
    this.#nodes.title.textContent = title;
    this.#nodes.title.hidden = !title;
    this.#nodes["date-label"].textContent = text.date;
    this.#nodes.date.accessibleLabel = text.date;
    this.#nodes.trails.textContent = text.trails;
    this.#nodes.timeline.setAttribute("aria-label", text.timeline);
    this.#nodes["range-start"].setAttribute("aria-label", text.rangeStart);
    this.#nodes["range-end"].setAttribute("aria-label", text.rangeEnd);
    this.#nodes["reset-range"].label = text.resetRange;
    this.#nodes.movement.setAttribute("aria-label", text.movement);
    this.#updateSpeed();
    this.#nodes.fit.label = text.fit;
    this.#nodes.refresh.label = text.refresh;
    this.#nodes["manage-entities"].querySelector("span").textContent = text.manage;
    this.#updatePlay();
  }

  #name(id) {
    return entityName(this.#hass?.states, id, this.#history.get(id)?.name);
  }

  #markerPicture(id) {
    return this.#hass.states[id]?.attributes.entity_picture;
  }

  #updateManageButton() {
    this.#nodes["manage-entities"].hidden = this.#preview || !this.#hass?.user?.is_admin ||
      !editableCardPath(this);
  }

  #syncEntities() {
    if (!this.#config) return {};
    const states = this.#hass?.states ?? {};
    const people = observedPeople(this.#config, states);
    const trackers = this.#config.entities.filter(isTracker);
    const entities = [...people, ...trackers];
    const explicit = new Set(this.#config.entities);
    const defaults = new Set([...trackers, ...people.filter((id) =>
      explicit.has(id) || hasLinkedGpsTracker(states[id], states))]);
    const entitiesChanged = entities.length !== this.#entities.length ||
      entities.some((id, index) => id !== this.#entities[index]);
    const defaultsChanged = defaults.size !== this.#defaultVisibility.size ||
      [...defaults].some((id) => !this.#defaultVisibility.has(id));
    if (entitiesChanged) this.#entities = entities;
    this.#defaultVisibility = defaults;
    this.#renderEntities();
    return { entitiesChanged, defaultsChanged };
  }

  #visible(id) {
    return this.#visibilityOverrides.get(id) ?? this.#defaultVisibility.has(id);
  }

  #restoreVisibility() {
    if (!this.#visibilityKey) return;
    try {
      const storage = window.localStorage;
      const overrides = new Map();
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(this.#visibilityKey)) continue;
        const value = storage.getItem(key);
        if (value === "true" || value === "false") {
          overrides.set(key.slice(this.#visibilityKey.length), value === "true");
        }
      }
      this.#visibilityOverrides = overrides;
    } catch {
      // Keep the current preferences if browser storage is unavailable.
    }
  }

  #updateVisibility(key, value) {
    if (!this.#visibilityKey || !key?.startsWith(this.#visibilityKey)) return;
    const id = key.slice(this.#visibilityKey.length);
    if (value === "true" || value === "false") this.#visibilityOverrides.set(id, value === "true");
    else this.#visibilityOverrides.delete(id);
    this.#renderEntities();
    this.#renderFrame();
  }

  #onVisibilityStorage = (event) => this.#updateVisibility(event.key, event.newValue);

  #onVisibilityEvent = (event) => {
    const { source, key, value } = event.detail ?? {};
    if (source !== this) this.#updateVisibility(key, value);
  };

  #toggleVisibility(id) {
    const visible = !this.#visible(id);
    this.#visibilityOverrides.set(id, visible);
    this.#renderEntities();
    this.#renderFrame();
    if (!this.#visibilityKey) return;
    const key = this.#visibilityKey + id;
    const value = String(visible);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Other cards in this page can still receive the change.
    }
    window.dispatchEvent(new CustomEvent(visibilityEvent, { detail: { key, value, source: this } }));
  }

  #renderEntities() {
    if (!this.#config) return;
    const container = this.#nodes.movement;
    const ids = this.#entities;
    if (ids.length !== container.children.length ||
        ids.some((id, index) => container.children[index]?.dataset.entity !== id)) {
      container.replaceChildren(...ids.map((id) => {
        const row = document.createElement("div");
        row.className = "movement-row";
        row.dataset.entity = id;
        row.style.setProperty("--entity-color", this.#color(id));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "visibility";
        const eye = document.createElement("ha-icon");
        eye.className = "eye";
        eye.setAttribute("aria-hidden", "true");
        const color = document.createElement("span");
        color.className = "entity-color";
        color.setAttribute("aria-hidden", "true");
        const name = document.createElement("span");
        name.className = "entity-name";
        const warning = document.createElement("ha-icon");
        warning.className = "tracker-warning";
        warning.setAttribute("icon", "mdi:alert-outline");
        warning.setAttribute("aria-hidden", "true");
        warning.hidden = true;
        button.append(eye, color, name, warning);
        button.addEventListener("click", () => this.#toggleVisibility(id));
        const track = document.createElement("div");
        track.className = "movement-track";
        track.setAttribute("role", "img");
        row.append(button, track);
        return row;
      }));
    }
    for (const row of container.children) {
      const button = row.firstElementChild;
      const [eye, , nameLabel, warning] = button.children;
      const id = row.dataset.entity;
      const name = this.#name(id);
      if (nameLabel.textContent !== name) {
        nameLabel.textContent = name;
        this.#frame = undefined;
      }
      const missing = isTracker(id) && this.#hass && !hasCoordinates(this.#hass.states[id]?.attributes);
      warning.hidden = !missing;
      const visible = this.#visible(id);
      row.toggleAttribute("data-hidden", !visible);
      eye.setAttribute("icon", visible ? "mdi:eye-outline" : "mdi:eye-off-outline");
      const action = `${visible ? this.#text.hide : this.#text.show} ${name}`;
      button.title = missing ? `${action} · ${this.#text.noGps}` : action;
      button.setAttribute("aria-label", `${this.#text.visibility} · ${name}`);
      button.setAttribute("aria-pressed", String(visible));
    }
  }

  #renderMovement() {
    if (!this.#window || !this.#config) return;
    const threshold = `${this.#config.movementThreshold} m`;
    for (const row of this.#nodes.movement.children) {
      const track = row.lastElementChild;
      const intervals = this.#history.get(row.dataset.entity)?.movement ?? [];
      const description = intervals.length ? this.#text.movement : this.#text.noMovement;
      track.title = `${this.#text[this.#status] ?? description} · ${threshold}`;
      track.setAttribute("aria-label", track.title);
      const { start: viewStart, last: viewLast } = this.#view;
      track.replaceChildren(...intervals.filter(({ start, end }) => end >= viewStart && start <= viewLast).map(({ start, end }) => {
        const segment = document.createElement("span");
        segment.className = "movement-segment";
        const startPercent = this.#percent(start);
        segment.style.left = `min(${startPercent}%, calc(100% - 2px))`;
        segment.style.width = `${this.#percent(end) - startPercent}%`;
        const from = this.#display(start);
        const to = this.#display(end);
        segment.title = from === to ? from : `${from} – ${to}`;
        return segment;
      }));
    }
  }

  #percent(second) {
    const { start, last } = this.#view;
    return last === start ? 0 : clamp((second - start) * 100 / (last - start), 0, 100);
  }

  #multiDay() { return this.#view && this.#view.last - this.#view.start > 26 * 3600; }

  #display(second) {
    return (this.#multiDay() ? this.#clock.displayDay : this.#clock.display).format(second * 1000);
  }

  #renderTicks() {
    if (!this.#window) return;
    const grid = this.#nodes["tick-grid"];
    const width = grid.clientWidth;
    if (!width) return;
    const { start, last } = this.#view;
    const span = last - start;
    const hours = tickHours.find((step) => width * step * 3600 >= 72 * span);
    const period = (hours ?? 24) * 3600;
    const ticks = [];
    // Ticks stay on the period's own hours (it starts at local midnight) when zoomed in.
    const first = start + (period - (start - this.#window.start) % period) % period;
    for (let second = first; second <= last; second += period) {
      const tick = document.createElement("div");
      tick.className = "time-tick";
      tick.style.left = `${this.#percent(second)}%`;
      if (second === first || width * (last - second) >= 36 * span) {
        const label = document.createElement("span");
        label.textContent = (period >= 86400 ? this.#clock.tickDay : this.#clock.tick).format(second * 1000);
        tick.append(label);
      }
      ticks.push(tick);
    }
    grid.replaceChildren(...ticks);
  }

  #setView(view) {
    if (!this.#window) return;
    const changed = view.start !== this.#view?.start || view.last !== this.#view?.last;
    this.#view = view;
    this.#cursor = clamp(this.#cursor, this.#range.start, this.#range.end);
    this.#renderMovement();
    this.#renderTicks();
    this.#renderFrame();
    if (changed) this.#fit(false);
  }

  #limits(kind) {
    if (kind === "start") return [this.#view.start, this.#range.end - 1];
    if (kind === "end") return [this.#range.start + 1, this.#view.last];
    return [this.#range.start, this.#range.end];
  }

  #setTimelineValue(kind, second) {
    const value = clamp(second, ...this.#limits(kind));
    if (kind === "cursor") {
      this.#seek(value);
      return;
    }
    if (this.#range[kind] === value) return;
    this.#range[kind] = value;
    this.#seek(this.#cursor);
  }

  #startDrag = (event) => {
    const trim = this.#nodes.trim;
    if (this.#drag || event.button !== 0 || this.#nodes.timeline.disabled) return;
    const button = event.target.closest("button");
    const handle = button?.dataset.handle;
    if (button && !handle) return;
    const bounds = trim.getBoundingClientRect();
    if (!bounds.width) return;
    if (!handle && (event.clientX < bounds.left || event.clientX > bounds.right)) return;

    event.preventDefault();
    const kind = handle ?? "cursor";
    const isEdge = kind !== "cursor";
    const position = isEdge
      ? bounds.left + bounds.width * this.#percent(this.#range[kind]) / 100
      : event.clientX;
    this.#drag = { kind, pointerId: event.pointerId, offset: event.clientX - position };
    const control = isEdge ? button : this.#nodes.timeline;
    if (!isEdge) control.setAttribute("data-pointer-focus", "");
    control.focus({ preventScroll: true });
    this.#nodes["timeline-area"].setPointerCapture(event.pointerId);
    if (isEdge) this.#pause();
    else this.#moveDrag(event);
  };

  #moveDrag = (event) => {
    if (this.#drag?.pointerId !== event.pointerId) return;
    const bounds = this.#nodes.trim.getBoundingClientRect();
    if (!bounds.width) return;
    const { start, last } = this.#view;
    const fraction = clamp((event.clientX - bounds.left - this.#drag.offset) / bounds.width, 0, 1);
    const second = start + Math.round(fraction * (last - start));
    if (this.#drag.kind === "cursor") {
      this.#range.start = Math.min(second, this.#range.start);
      this.#range.end = Math.max(second, this.#range.end);
      this.#seek(second);
    } else {
      this.#setTimelineValue(this.#drag.kind, second);
    }
  };

  #handleTimelineKey = (event) => {
    const kind = event.target.dataset.handle;
    if (!kind || event.target.disabled) return;
    if (kind === "cursor") event.target.removeAttribute("data-pointer-focus");
    const [min, max] = this.#limits(kind);
    const value = kind === "cursor" ? Math.floor(this.#cursor) : this.#range[kind];
    const step = event.altKey ? 1 : event.shiftKey ? 300 : 60;
    const targets = {
      Home: min, End: max, PageUp: value + 900, PageDown: value - 900,
      ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step, ArrowUp: value + step,
    };
    if (!Object.hasOwn(targets, event.key)) return;
    event.preventDefault();
    this.#setTimelineValue(kind, targets[event.key]);
  };

  #seek(second) {
    this.#pause();
    this.#cursor = clamp(second, this.#range.start, this.#range.end);
    this.#renderFrame();
  }

  #start() {
    if (!this.#window || this.#nodes.play.disabled) return;
    if (this.#cursor >= this.#range.end) this.#cursor = this.#range.start;
    this.#lastTick = performance.now();
    this.#animation = requestAnimationFrame(this.#tick);
    this.#updatePlay();
  }

  #tick = (time) => {
    const elapsed = Math.min(250, time - this.#lastTick) / 1000;
    this.#lastTick = time;
    // At 1×, advance one historical minute per real second for each day shown.
    const days = Math.max(1, Math.round((this.#view.last - this.#view.start) / 86400));
    this.#cursor = Math.min(this.#range.end, this.#cursor + elapsed * 60 * days * this.#playbackSpeed);
    if (this.#cursor === this.#range.end) this.#pause();
    else this.#animation = requestAnimationFrame(this.#tick);
    this.#renderFrame();
  };

  #pause() {
    if (this.#animation !== undefined) cancelAnimationFrame(this.#animation);
    this.#animation = undefined;
    this.#updatePlay();
  }

  #updatePlay() {
    const running = this.#animation !== undefined;
    this.#nodes.play.querySelector("span").textContent = running ? this.#text.pause : this.#text.play;
    this.#nodes.play.querySelector("ha-icon").setAttribute("icon", running ? "mdi:pause" : "mdi:play");
  }

  #updateSpeed() {
    const button = this.#nodes["speed-button"];
    const label = `${this.#playbackSpeed}×`;
    button.querySelector("span").textContent = label;
    button.setAttribute("aria-label", `${this.#text.speed} · ${label}`);
    for (const option of this.#nodes.speed.querySelectorAll("ha-dropdown-item")) {
      option.selected = Number(option.value) === this.#playbackSpeed;
    }
  }

  #renderTimeline(now, disabled) {
    const nodes = this.#nodes;
    const { start, end } = this.#range;
    const startLabel = this.#display(start);
    const endLabel = this.#display(end);
    const cursorLabel = this.#display(now);
    nodes.trim.style.setProperty("--clip-start", `${this.#percent(start)}%`);
    nodes.trim.style.setProperty("--clip-end", `${this.#percent(end)}%`);
    nodes["timeline-plot"].style.setProperty("--playhead", `${this.#percent(now)}%`);
    nodes.trim.setAttribute("aria-disabled", String(disabled));
    nodes.start.textContent = startLabel;
    nodes.end.textContent = endLabel;
    nodes.output.textContent = cursorLabel;
    for (const [kind, control, value, label] of [
      ["start", nodes["range-start"], start, startLabel],
      ["cursor", nodes.timeline, now, cursorLabel],
      ["end", nodes["range-end"], end, endLabel],
    ]) {
      const [min, max] = this.#limits(kind);
      control.disabled = disabled;
      control.title = `${control.getAttribute("aria-label")} · ${label}`;
      control.setAttribute("aria-valuemin", String(disabled ? value : min));
      control.setAttribute("aria-valuemax", String(disabled ? value : max));
      control.setAttribute("aria-valuenow", String(value));
      control.setAttribute("aria-valuetext", label);
    }
    nodes["reset-range"].disabled = disabled || (start === this.#window.start && end === this.#window.last &&
      this.#view.start === this.#window.start && this.#view.last === this.#window.last);
  }

  #renderFrame() {
    if (!this.#window) return;
    const { start, last } = this.#window;
    const now = Math.floor(this.#cursor);
    const nodes = this.#nodes;
    this.#renderTimeline(now, Boolean(this.#status) || last <= start);

    const shown = this.#entities.filter((id) => this.#visible(id));
    const entries = shown.map((id) => {
      const series = this.#history.get(id);
      const day = series?.day ?? [];
      const markerCount = countThrough(day, now);
      const marker = day[markerCount - 1] ?? series?.baseline;
      const trail = series?.trail;
      return {
        id, trail, day,
        first: trail ? countThrough(trail, this.#range.start, false) : 0,
        elapsed: trail ? countThrough(trail, now) : 0,
        end: trail ? (this.#range.end === last ? trail.length : countThrough(trail, this.#range.end)) : 0,
        fitStart: countThrough(day, this.#range.start, false),
        fitEnd: countThrough(day, this.#range.end),
        hasHistory: Boolean(day.length || series?.baseline),
        marker, picture: marker && this.#markerPicture(id),
      };
    });
    const hasHistory = entries.some((entry) => entry.hasHistory);
    const hasPosition = entries.some(({ marker }) => marker);
    if (!hasHistory && this.#animation !== undefined) this.#pause();
    const status = this.#mapError ? "mapError" : this.#status ||
      (!this.#entities.length ? "noEntities" :
        !shown.length ? "hidden" : !hasHistory ? "noHistory" : !hasPosition ? "noPosition" : "");
    nodes.message.textContent = this.#text[status] ?? "";
    nodes.message.hidden = !status;
    nodes.play.disabled = !hasHistory || this.#range.end <= this.#range.start || Boolean(this.#status);
    nodes.refresh.disabled = this.#status === "loading";
    nodes.dates.disabled = this.#status === "loading";
    if (!this.#map) {
      nodes.fit.disabled = true;
      return;
    }

    const previous = this.#frame ?? [];
    const visibilityChanged = !this.#frame || previous.length !== entries.length ||
      entries.some(({ id }, index) => previous[index]?.id !== id);
    const markersChanged = visibilityChanged || entries.some(({ marker, picture }, index) =>
      marker !== previous[index]?.marker || picture !== previous[index]?.picture);
    const pathsChanged = visibilityChanged || entries.some(({ trail, first, elapsed, end }, index) => {
      const old = previous[index];
      return trail !== old.trail || first !== old.first || elapsed !== old.elapsed || end !== old.end;
    });
    if (markersChanged) {
      const states = {};
      const entities = [];
      const markers = entries.filter(({ marker }) => marker)
        .map((entry) => ({ ...entry, name: this.#name(entry.id) }));
      const labels = markerLabels(markers);
      for (const { id, marker, name, picture } of markers) {
        const label = labels.get(id);
        const attributes = { ...marker.attributes, friendly_name: name, entity_picture: picture };
        const entity = { entity_id: id, color: this.#color(id), name, hide_accuracy: true };
        // The native map uses attribute labels for text markers and keeps name as the accessible title.
        if (label !== undefined) {
          attributes[markerLabelAttribute] = label;
          entity.label_mode = "attribute";
          entity.attribute = markerLabelAttribute;
        }
        states[id] = {
          entity_id: id,
          state: marker.state,
          attributes,
          last_changed: marker.timestamp.toISOString(),
          last_updated: marker.timestamp.toISOString(),
        };
        entities.push(entity);
      }
      this.#markerStates = states;
      this.#map.entities = entities;
      this.#provideStates?.(states);
    }
    if (pathsChanged) {
      const context = [];
      const selected = [];
      for (const { id, trail, first, elapsed, end } of entries) {
        if (!trail) continue;
        const color = this.#color(id);
        const name = this.#name(id);
        for (const { points, faded } of trailSections(trail, first, elapsed, end)) {
          (faded ? context : selected).push({
            points, color: faded ? `${color}59` : color, name, fullDatetime: true,
          });
        }
      }
      this.#map.paths = [...context, ...selected];
      requestAnimationFrame(() => this.#applyLines());
    }
    nodes.fit.disabled = !entries.some(({ fitStart, fitEnd }) => fitEnd > fitStart);
    this.#frame = entries;
  }

  #color(id) { return sampleColors[this.#entities.indexOf(id) % sampleColors.length]; }

  // "Show paths" off: hide the lines between the recorded points and keep the points.
  // The native map draws each path as a line layer and a point layer, so only the line
  // layers are hidden (and re-hidden whenever the map rebuilds its style).
  #applyLines() {
    const engine = this.#map?._engine;
    const show = this.#nodes.trails.checked;
    const map = engine?._map;
    if (map?.getStyle && map.setLayoutProperty) {
      if (!this.#linesHooked) {
        this.#linesHooked = map;
        map.on("styledata", () => this.#applyLines());
      }
      const want = show ? "visible" : "none";
      for (const layer of map.getStyle()?.layers ?? []) {
        if (!/^ha-map-path-\d+-lines$/.test(layer.id)) continue;
        if ((map.getLayoutProperty(layer.id, "visibility") ?? "visible") !== want) {
          map.setLayoutProperty(layer.id, "visibility", want);
        }
      }
      return;
    }
    const leaflet = engine?.leafletMap;
    if (!leaflet?.eachLayer) return;
    leaflet.eachLayer((layer) => {
      if (!layer.getLatLngs || layer.getRadius || !layer.setStyle) return;
      if (!this.#lineOpacity.has(layer)) this.#lineOpacity.set(layer, layer.options.opacity ?? 1);
      layer.setStyle({ opacity: show ? this.#lineOpacity.get(layer) : 0 });
    });
  }

  #fit(wholeDay) {
    if (!this.#map || !this.#frame) return;
    const points = [];
    for (const { id, day, fitStart, fitEnd } of this.#frame) {
      if (wholeDay) {
        const series = this.#history.get(id);
        for (const { point } of series?.trail ?? []) points.push(point);
        if (series?.baseline) points.push(series.baseline.point);
      } else {
        for (let index = fitStart; index < fitEnd; index++) points.push(day[index].point);
      }
    }
    if (points.length) this.#map.fitBounds(points, { pad: 0.18 });
  }
}

const editorSchema = [
  { name: "people", selector: { entity: { multiple: true, filter: [{ domain: "person" }] } } },
  { name: "trackers", selector: { entity: { multiple: true, filter: [{ domain: "device_tracker" }] } } },
  { name: "title", selector: { text: {} } },
  { name: "movement_threshold", selector: { number: { mode: "box", min: 0.1, step: 0.1 } } },
  { name: "show_trails", selector: { boolean: {} } },
];

class LocationHistoryCardEditor extends HTMLElement {
  #config;
  #hass;
  #text = copy.en;
  #form;
  #description;
  #warning;
  #formPeople = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: grid; gap: 12px; }
        p { margin: 0; color: var(--secondary-text-color); }
        ha-alert[hidden] { display: none; }
      </style>
      <p></p>
      <ha-form></ha-form>
      <ha-alert alert-type="warning" role="status" hidden></ha-alert>`;
    this.#description = root.querySelector("p");
    this.#form = root.querySelector("ha-form");
    this.#warning = root.querySelector("ha-alert");
    this.#form.schema = editorSchema;
    this.#form.computeLabel = ({ name }) => ({
      people: this.#text.people,
      trackers: this.#text.trackers,
      title: this.#text.title,
      movement_threshold: this.#text.threshold,
      show_trails: this.#text.trails,
    })[name];
    this.#form.addEventListener("value-changed", this.#formChanged);
  }

  set hass(hass) {
    const hadStates = Boolean(this.#hass?.states);
    this.#hass = hass;
    this.#text = hass.language?.toLowerCase().startsWith("zh") ? copy.zh : copy.en;
    this.#description.textContent = this.#text.peopleAuto;
    this.#form.hass = hass;
    if (!hadStates && hass.states) this.#updateForm();
    this.#updateWarning();
  }

  setConfig(config) {
    this.#config = config;
    this.#updateForm();
    this.#updateWarning();
  }

  #updateForm() {
    const config = this.#config;
    if (!config) return;
    this.#formPeople = observedPeople(config, this.#hass?.states);
    this.#form.data = {
      people: this.#formPeople,
      trackers: [...new Set((config.entities ?? []).map(entityId).filter(isTracker))],
      title: config.title,
      movement_threshold: config.movement_threshold ?? defaultMovementThreshold,
      show_trails: config.show_trails !== false,
    };
  }

  #formChanged = (event) => {
    event.stopPropagation();
    if (!this.#config) return;
    const value = event.detail.value;
    const previous = this.#config.entities ?? [];
    const people = new Set((value.people ?? []).filter(isPerson));
    const excluded = new Set(this.#config.excluded_people ?? []);
    for (const id of this.#formPeople) {
      if (!people.has(id)) excluded.add(id);
    }
    for (const id of people) excluded.delete(id);
    this.#formPeople = [...people];

    const trackers = new Set((value.trackers ?? []).filter(isTracker));
    const entities = previous.filter((entry) => {
      const id = entityId(entry);
      return isPerson(id) ? people.delete(id) : trackers.delete(id);
    });
    // People already exposed as states are discovered automatically.
    entities.push(...[...people].filter((id) => !this.#hass?.states?.[id]));
    entities.push(...trackers);
    const config = { ...this.#config };
    if (excluded.size) config.excluded_people = [...excluded];
    else delete config.excluded_people;
    if (entities.length) config.entities = entities;
    else delete config.entities;
    if (value.title) config.title = value.title;
    else delete config.title;
    if (Number.isFinite(value.movement_threshold) && value.movement_threshold > 0) {
      if (value.movement_threshold === defaultMovementThreshold) delete config.movement_threshold;
      else config.movement_threshold = value.movement_threshold;
    }
    if (value.show_trails === false) config.show_trails = false;
    else delete config.show_trails;
    this.#config = config;
    this.#updateWarning();
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config }, bubbles: true, composed: true,
    }));
  };

  #updateWarning() {
    if (!this.#hass || !this.#config) return;
    const { states } = this.#hass;
    const missing = (this.#config.entities ?? []).map(entityId).filter((id) =>
      isTracker(id) && !hasCoordinates(states[id]?.attributes));
    const message = missing.length
      ? `${missing.map((id) => entityName(states, id)).join(" · ")} · ${this.#text.noGps}`
      : "";
    if (this.#warning.textContent !== message) this.#warning.textContent = message;
    this.#warning.hidden = !missing.length;
  }
}

if (!customElements.get(tag)) {
  customElements.define(tag, LocationHistoryCard);
  customElements.define(`${tag}-editor`, LocationHistoryCardEditor);
  (window.customCards ??= []).push({
    type: tag,
    name: "Location History",
    description: "Browse and replay recorded GPS locations on the Home Assistant map.",
    preview: false,
  });
}
