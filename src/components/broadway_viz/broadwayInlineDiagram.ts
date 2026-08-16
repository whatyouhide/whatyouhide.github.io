import { advancePipeline, pipelineFinished, PIPELINE_STEP, type PipelineOptions } from "./broadwayPipelineModel";
import { createInlinePipeline, edgePath, edgePoint, inlineLayout, inlineState, nextInlineEvent, type InlineLayout } from "./broadwayInlineScene";

const ns = "http://www.w3.org/2000/svg";
const attr = (node: Element, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
const text = (node: Element, value: string) => { if (node.textContent !== value) node.textContent = value; };
function element(tag: string, attributes: Record<string, string | number>, content?: string) {
    const node = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    if (content) node.textContent = content;
    return node;
}

class BroadwayInlineDiagram extends HTMLElement {
    motion = matchMedia("(prefers-reduced-motion: reduce)");
    model!: ReturnType<typeof createInlinePipeline>;
    layout!: InlineLayout;
    nodes = new Map<string, { group: Element; status: Element }>();
    packets: Element[] = [];
    sourceMarks: Element[] = [];
    svg!: SVGSVGElement;
    root!: HTMLElement;
    caption!: HTMLElement;
    play!: HTMLButtonElement;
    next!: HTMLButtonElement;
    replay!: HTMLButtonElement;
    announcement!: HTMLElement;
    control?: HTMLElement;
    controlHome?: Comment;
    observer?: IntersectionObserver;
    resize?: ResizeObserver;
    frame = 0;
    visible = false;
    running = true;
    last = 0;
    accumulator = 0;
    dwell = 0;
    revision = -1;
    width = 0;
    state!: ReturnType<typeof inlineState>;

    connectedCallback() {
        this.root = this.closest("broadway-scroll-explainer")!;
        this.svg = this.querySelector("svg")!;
        this.caption = this.querySelector("[data-inline-caption]")!;
        this.play = this.querySelector("[data-inline-play]")!;
        this.next = this.querySelector("[data-inline-next]")!;
        this.replay = this.querySelector("[data-inline-replay]")!;
        this.announcement = this.querySelector("[data-inline-announcement]")!;
        this.control = this.closest(".bvx-copy")?.querySelector<HTMLElement>(".bvx-control") ?? undefined;
        if (this.control) {
            this.controlHome = document.createComment("stage control");
            this.control.before(this.controlHome);
        }
        this.placeControl();
        this.running = !this.motion.matches;
        this.model = createInlinePipeline(this.options());
        this.measure();
        this.dataset.ready = "true";
        this.play.addEventListener("click", this.toggle);
        this.next.addEventListener("click", this.step);
        this.replay.addEventListener("click", this.restart);
        this.root.addEventListener("input", this.configure);
        this.root.addEventListener("broadway-layout", this.screenChanged);
        this.motion.addEventListener("change", this.preference);
        document.addEventListener("visibilitychange", this.sync);
        this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.sync(); }, { threshold: 0.1 });
        this.observer.observe(this);
        this.resize = new ResizeObserver(this.measure);
        this.resize.observe(this);
    }
    placeControl() {
        if (!this.control || !this.controlHome) return;
        if (this.root.dataset.static === "true") this.append(this.control);
        else this.controlHome.after(this.control);
    }
    screenChanged = () => { this.placeControl(); this.sync(); };
    options(): PipelineOptions {
        const data = this.root.dataset;
        return { chapter: Number(this.dataset.chapter), producers: Number(data.producerCount), processors: Number(data.processorCount), batchers: Number(data.batcherKeyCount), workers: Number(data.batchProcessorCount) };
    }
    configure = () => {
        const options = this.options();
        if (Object.keys(options).every(key => options[key as keyof PipelineOptions] === this.model.options[key as keyof PipelineOptions])) return;
        this.model = createInlinePipeline(options);
        this.accumulator = 0; this.dwell = 0;
        this.build(); this.sync();
    };
    measure = () => {
        const width = Math.round(this.getBoundingClientRect().width);
        if (!width || width === this.width) return;
        this.width = width; this.build();
    };
    build() {
        this.layout = inlineLayout(this.model.options, this.width || 358);
        attr(this.svg, "viewBox", `0 0 ${this.layout.width} ${this.layout.height}`);
        const field = element("g", { "aria-hidden": "true" });
        for (const heading of this.layout.headings) heading.lines.forEach((line, i) => field.append(element("text", { class: "inline-column", x: heading.x, y: 14 + i * 15 }, line)));
        for (const edge of this.layout.edges) field.append(element("path", { class: "inline-edge", d: edgePath(edge) }));
        this.nodes.clear();
        for (const node of this.layout.nodes) {
            const group = element("g", { class: "inline-node", transform: `translate(${node.x} ${node.y})` });
            const status = element("text", { class: "inline-state", x: 9, y: 33 });
            group.append(element("rect", { width: node.width, height: 42, rx: 4 }), element("text", { class: "inline-name", x: 9, y: 17 }, node.label), status);
            field.append(group); this.nodes.set(node.id, { group, status });
        }
        this.sourceMarks = this.model.options.chapter === 0 ? Array.from({ length: 10 }, (_, i) => {
            const mark = element("rect", { class: "inline-packet", x: this.layout.width / 2 - 57 + i * 12, y: 166, width: 6, height: 6, rx: 1, visibility: "hidden" });
            field.append(mark); return mark;
        }) : [];
        this.packets = Array.from({ length: 10 }, () => {
            const packet = element("g", { class: "inline-packet", visibility: "hidden" });
            if (this.model.options.chapter === 4) {
                for (let i = 0; i < 3; i++) packet.append(element("rect", { x: i * 6 - 7, y: -3, width: 5, height: 6, rx: 1 }));
            } else packet.append(element("circle", { r: 4 }));
            field.append(packet); return packet;
        });
        this.svg.replaceChildren(field);
        this.revision = -1; this.render();
    }
    render() {
        if (this.revision !== this.model.revision) {
            this.revision = this.model.revision;
            this.state = inlineState(this.model);
            for (const [id, node] of this.nodes) {
                const state = this.state.nodes[id];
                attr(node.group, "data-active", String(state.active)); text(node.status, state.status);
            }
            this.sourceMarks.forEach((mark, i) => attr(mark, "visibility", this.model.messages[i].state === "source" ? "visible" : "hidden"));
            text(this.caption, this.state.caption);
            attr(this.svg, "aria-label", `${this.dataset.title}. ${this.state.caption}`);
            this.next.disabled = pipelineFinished(this.model);
        }
        this.packets.forEach((node, i) => {
            const packet = this.state.packets[i];
            const edge = packet && this.layout.edges.find(edge => edge.id === packet.edge);
            attr(node, "visibility", edge && !this.motion.matches ? "visible" : "hidden");
            if (!edge || this.motion.matches) return;
            const point = edgePoint(edge, (this.model.time + this.accumulator - packet.started) / (packet.ends - packet.started));
            attr(node, "transform", `translate(${point.x} ${point.y})`);
            if (this.model.options.chapter === 4) [...node.children].forEach((mark, index) => attr(mark, "display", index < packet.size ? "inline" : "none"));
        });
    }
    stop() { cancelAnimationFrame(this.frame); this.frame = 0; this.last = 0; }
    sync = () => {
        this.stop();
        if (this.motion.matches) this.running = false;
        if (this.running && this.visible && this.root.dataset.static === "true" && !document.hidden) this.frame = requestAnimationFrame(this.tick);
        text(this.play, this.running ? "Pause" : "Play");
    };
    preference = () => { if (this.motion.matches) this.running = false; this.render(); this.sync(); };
    toggle = () => { this.running = !this.running; this.sync(); };
    step = () => {
        this.running = false; this.accumulator = 0;
        nextInlineEvent(this.model); this.render(); this.sync();
        text(this.announcement, this.state.caption);
    };
    restart = () => {
        this.model = createInlinePipeline(this.options());
        this.accumulator = 0; this.dwell = 0; this.revision = -1;
        this.running = !this.motion.matches; this.render(); this.sync();
        text(this.announcement, this.state.caption);
    };
    tick = (now: number) => {
        if (this.motion.matches) { this.render(); this.sync(); return; }
        const delta = this.last ? Math.min(80, now - this.last) : 0;
        this.last = now;
        if (pipelineFinished(this.model)) {
            this.dwell += delta;
            if (this.dwell >= 2200) { this.model = createInlinePipeline(this.options()); this.revision = -1; this.accumulator = 0; this.dwell = 0; }
        } else {
            this.accumulator += delta;
            while (this.accumulator >= PIPELINE_STEP && !pipelineFinished(this.model)) { advancePipeline(this.model); this.accumulator -= PIPELINE_STEP; }
        }
        this.render(); this.frame = requestAnimationFrame(this.tick);
    };
    disconnectedCallback() {
        this.stop(); this.observer?.disconnect(); this.resize?.disconnect();
        if (this.control && this.controlHome) { this.controlHome.after(this.control); this.controlHome.remove(); }
        this.play.removeEventListener("click", this.toggle);
        this.next.removeEventListener("click", this.step);
        this.replay.removeEventListener("click", this.restart);
        this.root.removeEventListener("input", this.configure);
        this.root.removeEventListener("broadway-layout", this.screenChanged);
        this.motion.removeEventListener("change", this.preference);
        document.removeEventListener("visibilitychange", this.sync);
    }
}
if (!customElements.get("broadway-inline-diagram")) customElements.define("broadway-inline-diagram", BroadwayInlineDiagram);
