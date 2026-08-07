export class GenStageDemoElement extends HTMLElement {
  running = true;
  frame = 0;
  lastFrame = 0;
  now = 0;

  connectDemo({ measure, resizeTarget = "[data-stage]", threshold = 0.08 } = {}) {
    this.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", this.onButtonClick);
    });

    if (measure) {
      const target = this.querySelector(resizeTarget);
      this.resizeObserver = new ResizeObserver(measure);
      if (target) this.resizeObserver.observe(target);
    }

    this.intersectionObserver = new IntersectionObserver(
      this.onVisibilityChange,
      { threshold },
    );
    this.intersectionObserver.observe(this);
    this.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }

  disconnectDemo() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.querySelectorAll("button").forEach((button) => {
      button.removeEventListener("click", this.onButtonClick);
    });
  }

  onVisibilityChange = ([entry]) => {
    this.isVisible = entry.isIntersecting;
    this.scheduleFrame();
  };

  scheduleFrame() {
    cancelAnimationFrame(this.frame);
    if (this.running && this.isVisible !== false) {
      this.lastFrame = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  start() {
    this.running = true;
    if (this.toggleButton) this.toggleButton.textContent = "Pause";
    this.scheduleFrame();
    this.updateView();
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    if (this.toggleButton) {
      this.toggleButton.textContent = this.pauseLabel ?? "Continue";
    }
    this.updateView();
  }

  tick = (time) => {
    if (!this.running) return;
    const elapsedMs = Math.min(time - this.lastFrame, 80);
    this.lastFrame = time;
    this.advance(elapsedMs);
    this.updateView();
    if (this.running && this.isVisible !== false) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  renderFlights(tokens, flights, durationMs, distance) {
    tokens.forEach((token) => {
      token.style.opacity = "0";
    });
    flights.forEach((flight) => {
      const token = tokens[(flight.id - 1) % tokens.length];
      const progress = Math.min(1, (this.now - flight.startedAt) / durationMs);
      const travel = this.reduceMotion ? distance : progress * distance;
      token.style.opacity = "1";
      token.style.transform = `translate3d(${travel}px, ${flight.id % 2 ? -3 : 3}px, 0)`;
    });
  }

  takeArrivals(flights, durationMs) {
    return flights.reduce(
      ([arrived, moving], flight) => {
        (this.now - flight.startedAt >= durationMs ? arrived : moving).push(
          flight,
        );
        return [arrived, moving];
      },
      [[], []],
    );
  }

  setSlots(slots, filled) {
    slots.forEach((slot, index) => {
      slot.classList.toggle("is-filled", index < filled);
    });
  }

  setText(selector, value) {
    this.setTextIn(this, selector, value);
  }

  setTexts(values, root = this) {
    Object.entries(values).forEach(([selector, value]) => {
      this.setTextIn(root, selector, value);
    });
  }

  setTextIn(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = String(value);
  }

  numberAttribute(name, fallback) {
    const value = Number(this.dataset[name]);
    return Number.isFinite(value) ? value : fallback;
  }

  jsonAttribute(name, fallback) {
    try {
      return JSON.parse(this.dataset[name]);
    } catch {
      return fallback;
    }
  }
}

export function defineGenStageDemo(name, constructor) {
  if (!customElements.get(name)) customElements.define(name, constructor);
}
