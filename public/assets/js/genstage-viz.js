import { h, render } from "https://esm.sh/preact@10";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "https://esm.sh/preact@10/hooks";
import htm from "https://esm.sh/htm@3";

const html = htm.bind(h);

// ============================================================
// Shared hooks
// ============================================================

// Runs a simulation loop: calls stepFn(prevState, deltaMs) at ~60fps
// while running. Returns state + controls.
//
// Usage:
//   const { sim, running, toggle, reset } = useSimulation(myStep, INIT_STATE);
//
function useSimulation(stepFn, initState) {
  const [sim, setSim] = useState(initState);
  const [running, setRunning] = useState(false);
  const stepRef = useRef(stepFn);
  stepRef.current = stepFn;

  useEffect(() => {
    if (!running) return;
    let raf;
    let lastTime = null;
    const tick = (now) => {
      const dt = lastTime === null ? 0 : Math.min(now - lastTime, 100);
      lastTime = now;
      setSim((s) => stepRef.current(s, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const toggle = useCallback(() => setRunning((r) => !r), []);
  const reset = useCallback(() => {
    setRunning(false);
    setSim(initState);
  }, [initState]);

  return { sim, running, toggle, reset };
}

// ============================================================
// Shared SVG components
// ============================================================

// A labeled box (source, producer, consumer, ...).
// `labelPosition`: "center" (default) puts label inside the box,
//                   "top" puts it above the box.
function Node({ x, y, w, h, label, labelPosition }) {
  const isTop = labelPosition === "top";
  return html`
    <g>
      <rect x=${x} y=${y} width=${w} height=${h} rx="8" class="gs-box" />
      <text
        x=${x + w / 2}
        y=${isTop ? y - 6 : y + h / 2 + 4}
        text-anchor="middle"
        class=${isTop ? "gs-lbl" : "gs-box-label"}
      >
        ${label}
      </text>
    </g>
  `;
}

// A dashed line between two points, with dots traveling along it.
// `flights` is an array of {id, t0, t1} — each dot's start/end time.
// `now` is the current simulation clock.
function Track({ x1, x2, y, flights, now, dotClass }) {
  const w = x2 - x1;
  return html`
    <g>
      <line
        x1=${x1}
        y1=${y}
        x2=${x2}
        y2=${y}
        class="gs-track"
        stroke-dasharray="4 3"
      />
      ${flights.map((f) => {
        const p = Math.min(1, (now - f.t0) / (f.t1 - f.t0));
        return html`<circle
          key=${f.id}
          cx=${x1 + p * w}
          cy=${y}
          r="5"
          class=${dotClass || "gs-dot"}
        />`;
      })}
    </g>
  `;
}

// A horizontal fill bar showing how full a queue is.
// Changes color at 50% and 80% thresholds.
// `label` adds a small text label to the left of the bar.
function QueueBar({ x, y, w, h, count, capacity, label }) {
  const labelW = label ? 40 : 0;
  const barX = x + labelW;
  const barW = w - labelW;
  const fill = count / capacity;
  const cls =
    fill > 0.8
      ? "gs-q-fill gs-q-fill--danger"
      : fill > 0.5
        ? "gs-q-fill gs-q-fill--warn"
        : "gs-q-fill";
  return html`
    <g>
      ${label &&
      html`<text x=${x} y=${y + h / 2 + 3} class="gs-bar-label">
        ${label}
      </text>`}
      <rect x=${barX} y=${y} width=${barW} height=${h} rx="3" class="gs-q-bg" />
      <rect
        x=${barX}
        y=${y}
        width=${barW * fill}
        height=${h}
        rx="3"
        class=${cls}
      />
      ${count > 0 &&
      html`<text
        x=${barX + barW + 8}
        y=${y + h / 2 + 3}
        class="gs-q-count"
      >
        ${count}/${capacity}
      </text>`}
    </g>
  `;
}

// A progress bar for the event currently being processed.
// `progress` is 0..1 (0 = just started, 1 = done).
// `label` adds a small text label to the left of the bar.
function ProcessingBar({ x, y, w, h, progress, label }) {
  const labelW = label ? 40 : 0;
  const barX = x + labelW;
  const barW = w - labelW;
  return html`
    <g>
      ${label &&
      html`<text x=${x} y=${y + h / 2 + 3} class="gs-bar-label">
        ${label}
      </text>`}
      <rect x=${barX} y=${y} width=${barW} height=${h} rx="2" class="gs-bar-bg" />
      ${progress > 0 &&
      html`<rect
        x=${barX}
        y=${y}
        width=${barW * progress}
        height=${h}
        rx="2"
        class="gs-bar-fg"
      />`}
      <text
        x=${barX + barW + 8}
        y=${y + h / 2 + 3}
        class="gs-bar-pct"
      >
        ${progress > 0 ? Math.round(progress * 100) + "%" : "idle"}
      </text>
    </g>
  `;
}

// ============================================================
// Shared HTML components
// ============================================================

// Play/Pause + Reset buttons.
function PlayControls({ running, onToggle, onReset }) {
  return html`
    <div class="gs-controls-row">
      <button
        class=${`gs-btn gs-btn--go${running ? " gs-btn--on" : ""}`}
        onClick=${onToggle}
      >
        ${running ? "Pause" : "Start"}
      </button>
      <button class="gs-btn" onClick=${onReset}>Reset</button>
    </div>
  `;
}

// ============================================================
// Scene 1: Push (no back-pressure)
// ============================================================

const PROCESSING_TIME = 1000; // consumer: 1 event per second, fixed
const TRAVEL_TIME = 600;
const QUEUE_CAP = 12;

const DROP_DUR = 600; // how long the drop animation lasts

const PUSH_INIT = {
  flights: [],
  queue: [],
  drops: [],
  processing: null,
  processStart: 0,
  produced: 0,
  consumed: 0,
  dropped: 0,
  lastEmit: 0,
  now: 0,
  nid: 0,
};

// Pure step function. Takes (state, deltaMs) → new state.
// `rate` is baked in via closure (see Scene1 component).
function makePushStep(rateRef) {
  return function pushStep(s, dt) {
    if (dt <= 0) return s;
    const rate = rateRef.current;
    const now = s.now + dt;
    let {
      flights,
      queue,
      drops,
      processing,
      processStart,
      produced,
      consumed,
      dropped,
      lastEmit,
      nid,
    } = s;

    flights = flights.slice();
    queue = queue.slice();
    drops = drops.filter((d) => now - d.t0 < DROP_DUR);

    // Emit a new event if enough time has passed
    if (rate > 0 && now - lastEmit >= 1000 / rate) {
      flights.push({ id: nid, t0: now, t1: now + TRAVEL_TIME });
      produced++;
      lastEmit = now;
      nid++;
    }

    // Check which flights have arrived
    const alive = [];
    for (const f of flights) {
      if (now >= f.t1) {
        // Arrived at consumer
        if (!processing && queue.length === 0) {
          processing = f.id;
          processStart = now;
        } else if (queue.length < QUEUE_CAP) {
          queue.push({ id: f.id, t: now });
        } else {
          dropped++;
          drops.push({ id: f.id, t0: now, dx: (Math.random() - 0.5) * 20 });
        }
      } else {
        alive.push(f);
      }
    }
    flights = alive;

    // Finish processing if time is up
    if (processing !== null && now - processStart >= PROCESSING_TIME) {
      consumed++;
      processing = null;
      if (queue.length > 0) {
        const next = queue.shift();
        processing = next.id;
        processStart = now;
      }
    }

    return {
      flights,
      queue,
      drops,
      processing,
      processStart,
      produced,
      consumed,
      dropped,
      lastEmit,
      now,
      nid,
    };
  };
}

// SVG layout coordinates for Scene 1
const L = {
  w: 700,
  h: 110,
  src: { x: 10, y: 20, w: 80, h: 48 },
  trk: { x1: 100, x2: 320, y: 44 },
  con: { x: 330, y: 12, w: 360, h: 68 },
  q: { x: 342, y: 30, w: 280, h: 14 },
  bar: { x: 342, y: 54, w: 280, h: 6 },
};

function Scene1() {
  const [rate, setRate] = useState(0.5);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  // Create step function that reads rate from the ref
  const [stepFn] = useState(() => makePushStep(rateRef));
  const { sim, running, toggle, reset } = useSimulation(stepFn, PUSH_INIT);

  // Derived values for rendering
  const processingProgress =
    sim.processing !== null
      ? Math.min(1, (sim.now - sim.processStart) / PROCESSING_TIME)
      : 0;

  return html`
    <div class="gs-scene-body">
      <label class="gs-rate">
        <span>Event rate: <strong>${rate}</strong> ev/s</span>
        <input
          type="range"
          min="0.2"
          max="3"
          step="0.1"
          value=${rate}
          onInput=${(e) => setRate(+e.target.value)}
        />
        <span class="gs-rate-hint">
          Consumer processes 1 ev/s.
          ${rate > 1 ? " Events arriving faster than processing!" : ""}
        </span>
      </label>

      <svg viewBox="0 0 ${L.w} ${L.h}" class="gs-svg">
        <${Node} ...${L.src} label="Source" />
        <${Track}
          ...${L.trk}
          flights=${sim.flights}
          now=${sim.now}
        />
        <${Node} ...${L.con} label="Consumer" labelPosition="top" />
        <${QueueBar}
          ...${L.q}
          count=${sim.queue.length}
          capacity=${QUEUE_CAP}
          label="queue"
        />
        <${ProcessingBar}
          ...${L.bar}
          progress=${processingProgress}
          label="proc"
        />

        ${sim.drops.map((d) => {
          const p = Math.min(1, (sim.now - d.t0) / DROP_DUR);
          return html`<circle
            key=${d.id}
            cx=${L.trk.x2 + 10 + d.dx}
            cy=${L.con.y + L.con.h + p * 28}
            r=${5 - p * 2}
            class="gs-drop"
            opacity=${1 - p * p}
          />`;
        })}
      </svg>

      <div class="gs-stats">
        <span>Produced: <strong>${sim.produced}</strong></span>
        <span>Consumed: <strong>${sim.consumed}</strong></span>
        ${sim.dropped > 0 &&
        html`<span class="gs-stat--drop"
          >Dropped: <strong>${sim.dropped}</strong></span
        >`}
      </div>

      <${PlayControls}
        running=${running}
        onToggle=${toggle}
        onReset=${reset}
      />
    </div>
  `;
}

// ============================================================
// Mount
// ============================================================

const root = document.getElementById("gs-root");
if (root) render(html`<${Scene1} />`, root);
