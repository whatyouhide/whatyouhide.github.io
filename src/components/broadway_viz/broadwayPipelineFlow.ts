import { advancePipeline, createPipeline, nextPipelineEvent, pipelineFinished, PIPELINE_STEP, type PipelineModel, type PipelineOptions } from "./broadwayPipelineModel";

type Point = {x:number; y:number};
const svgNS = "http://www.w3.org/2000/svg";
const setText = (node: Element, value: string) => { if (node.textContent !== value) node.textContent = value; };
const setAttribute = (node: Element, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };

export class BroadwayPipelineFlow {
    model: PipelineModel;
    frame = 0;
    running = true;
    visible = false;
    lastTime = 0;
    accumulator = 0;
    dwell = 0;
    revision = -1;
    motion = matchMedia("(prefers-reduced-motion: reduce)");
    observer: IntersectionObserver;
    paths = new Map<SVGGElement, Point[]>();
    sourceRoute: Point[] = [];
    svg: SVGSVGElement;
    source: HTMLElement;
    producers: HTMLElement[];
    processors: HTMLElement[];
    batchers: HTMLElement[];
    workers: HTMLElement[];
    batcherLabels: Element[];
    producerLabels: Element[];
    wires: SVGGElement[][];
    packets: SVGGElement[];
    batchPackets: SVGGElement[];
    batchLabels: SVGTextElement[];
    batchMarks: SVGRectElement[][];
    play: HTMLButtonElement;
    next: HTMLButtonElement;
    replay: HTMLButtonElement;
    action: HTMLElement;
    announcement: HTMLElement;

    constructor(public root: HTMLElement, options: PipelineOptions) {
        this.model = createPipeline(options);
        this.running = !this.motion.matches;
        this.svg = root.querySelector("[data-wires]")!;
        this.source = root.querySelector("[data-source-node]")!;
        this.producers = [...root.querySelectorAll<HTMLElement>("[data-producer]")];
        this.processors = [...root.querySelectorAll<HTMLElement>("[data-processor]")];
        this.batchers = [...root.querySelectorAll<HTMLElement>("[data-batcher]")];
        this.workers = [...root.querySelectorAll<HTMLElement>("[data-batch-processor]")];
        this.producerLabels = this.producers.map(node => node.querySelector("small")!);
        this.batcherLabels = this.batchers.map(node => node.querySelector("small")!);
        this.wires = ["source", "processor", "batcher", "batch-processor"].map(kind => [...root.querySelectorAll<SVGGElement>(`[data-${kind}-wire]`)]);
        const makePacket = (batch: boolean) => {
            const group = document.createElementNS(svgNS, "g");
            group.setAttribute("class", batch ? "bvx-flow-packet bvx-flow-packet--batch" : "bvx-flow-packet");
            group.setAttribute("visibility", "hidden");
            if (batch) {
                for (let i = 0; i < 3; i++) {
                    const square = document.createElementNS(svgNS, "rect");
                    square.setAttribute("x", String(i * 5 - 7)); square.setAttribute("y", String(i * -3));
                    square.setAttribute("width", "6"); square.setAttribute("height", "6"); square.setAttribute("rx", "1");
                    group.append(square);
                }
                const text = document.createElementNS(svgNS, "text");
                text.setAttribute("y", "-13"); text.setAttribute("text-anchor", "middle"); group.append(text);
            } else {
                const circle = document.createElementNS(svgNS, "circle"); circle.setAttribute("r", "4"); group.append(circle);
            }
            this.svg.append(group);
            return group;
        };
        this.packets = Array.from({length:10}, () => makePacket(false));
        this.batchPackets = Array.from({length:10}, () => makePacket(true));
        this.batchLabels = this.batchPackets.map(packet => packet.querySelector("text")!);
        this.batchMarks = this.batchPackets.map(packet => [...packet.querySelectorAll("rect")]);
        this.play = root.querySelector("[data-flow-play]")!;
        this.next = root.querySelector("[data-flow-next]")!;
        this.replay = root.querySelector("[data-flow-replay]")!;
        this.action = root.querySelector("[data-flow-action]")!;
        this.announcement = root.querySelector("[data-flow-announcement]")!;
        this.play.addEventListener("click", this.toggle);
        this.next.addEventListener("click", this.step);
        this.replay.addEventListener("click", this.replayRun);
        this.motion.addEventListener("change", this.preference);
        document.addEventListener("visibilitychange", this.sync);
        this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.sync(); }, {threshold:0.05});
        this.observer.observe(root.querySelector("[data-stage]")!);
        this.render(); this.sync();
    }
    configure(options: PipelineOptions) {
        if (Object.keys(options).every(key => options[key as keyof PipelineOptions] === this.model.options[key as keyof PipelineOptions])) return;
        this.model = createPipeline(options); this.accumulator = 0; this.dwell = 0; this.revision = -1;
        this.render(); this.sync();
    }
    stop() { cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = 0; }
    sync = () => {
        this.stop();
        const complete = pipelineFinished(this.model);
        if (this.running && this.visible && this.root.dataset.static !== "true" && !document.hidden) this.frame = requestAnimationFrame(this.tick);
        setText(this.play, this.running ? "Pause flow" : "Play flow");
        this.next.disabled = complete;
    };
    preference = () => { if (this.motion.matches) this.running = false; this.sync(); this.render(); };
    toggle = () => { this.running = !this.running; this.sync(); this.announce(); };
    step = () => { this.running = false; this.accumulator = 0; nextPipelineEvent(this.model); this.render(); this.sync(); this.announce(); };
    replayRun = () => { this.model = createPipeline(this.model.options); this.accumulator = 0; this.dwell = 0; this.revision = -1; this.running = !this.motion.matches; this.render(); this.sync(); this.announce(); };
    announce() { setText(this.announcement, this.action.textContent ?? ""); }
    tick = (now: number) => {
        const delta = this.lastTime ? Math.min(80, now - this.lastTime) : 0;
        this.lastTime = now;
        if (pipelineFinished(this.model)) {
            this.dwell += delta;
            if (this.dwell >= 2200) {
                this.model = createPipeline(this.model.options);
                this.accumulator = 0; this.dwell = 0; this.revision = -1;
                this.next.disabled = false;
            }
        } else {
            this.accumulator += delta;
            while (this.accumulator >= PIPELINE_STEP && !pipelineFinished(this.model)) { advancePipeline(this.model); this.accumulator -= PIPELINE_STEP; }
            this.next.disabled = pipelineFinished(this.model);
        }
        this.render();
        this.frame = requestAnimationFrame(this.tick);
    };
    measure() {
        if (this.root.dataset.static === "true") return;
        this.revision = -1;
        this.paths.clear();
        for (const wires of this.wires) for (const wire of wires) {
            const path = wire.querySelector("path")!;
            if (!path.getAttribute("d")) continue;
            const length = path.getTotalLength();
            this.paths.set(wire, Array.from({length:65}, (_, i) => {
                const point = path.getPointAtLength(length * i / 64); return {x:point.x,y:point.y};
            }));
        }
        const box = this.svg.getBoundingClientRect(), source = this.source.getBoundingClientRect();
        const end = {x:source.left + source.width * 0.25 - box.left, y:source.top + source.height * 0.15 - box.top};
        this.sourceRoute = Array.from({length:65}, (_, i) => ({x:end.x, y:end.y - 64 * (1 - i / 64)}));
        this.render();
    }
    route(layer: number, index: number) { return this.paths.get(this.wires[layer][index]); }
    showPacket(packet: SVGGElement, route: Point[] | undefined, started: number, ends: number, visible: boolean) {
        const show = visible && !!route?.length && !this.motion.matches;
        setAttribute(packet, "visibility", show ? "visible" : "hidden");
        if (!show || !route) return;
        const sample = Math.max(0, Math.min(64, (this.model.time + this.accumulator - started) / (ends - started) * 64));
        const i = Math.min(63, Math.floor(sample)), t = sample - i;
        const x = route[i].x + (route[i + 1].x - route[i].x) * t, y = route[i].y + (route[i + 1].y - route[i].y) * t;
        packet.setAttribute("transform", `translate(${x},${y})`);
    }
    render() {
        const model = this.model;
        if (model.revision !== this.revision) {
            this.revision = model.revision;
            this.producers.forEach((node, i) => {
                const id = model.producerBusy[i]; setAttribute(node, "data-flow-active", String(id != null));
                setText(this.producerLabels[i], id != null ? `message ${id}` : "producer");
            });
            this.processors.forEach((node, i) => setAttribute(node, "data-flow-active", String(model.working[i] != null)));
            this.batchers.forEach((node, i) => {
                const batch = model.batches.find(b => b.key === i && b.state === "ready");
                const count = model.buffers[i]?.length ?? 0;
                setText(this.batcherLabels[i], batch ? `${batch.messages.length} / ${batch.reason}` : `${count} / 3`);
                setAttribute(node, "data-flow-active", String(!!batch || count > 0));
            });
            this.workers.forEach(node => setAttribute(node, "data-flow-active", String(model.batches.some(b => b.key === Number(node.dataset.batcherIndex) && b.worker === Number(node.dataset.workerIndex) && b.state === "working"))));
            const complete = pipelineFinished(model);
            setText(this.action, complete ? `${model.messages.length} messages ${["stored at the source", "received by producers", "processed", "formed into batches", "processed in batches"][model.options.chapter]}.` : model.action);
            // Only one path gets emphasis. Other in-flight messages stay visible.
            const focus = model.messages.filter(m => ["fetch","dispatch","collect"].includes(m.state)).sort((a, b) => b.started - a.started || b.id - a.id)[0];
            let selected: SVGGElement | undefined;
            if (focus) {
                const layer = focus.state === "fetch" ? 0 : focus.state === "dispatch" ? 1 : 2;
                const index = layer === 0 ? focus.producer : layer === 1 ? focus.producer * 8 + focus.processor : focus.processor * 2 + focus.key;
                selected = this.wires[layer][index];
            }
            const batch = model.batches.find(b => b.state === "travel");
            if (batch) selected = this.wires[3][batch.key * 4 + batch.worker];
            this.wires.flat().forEach(wire => setAttribute(wire, "data-flow-active", String(wire === selected)));
        }
        model.messages.forEach((message, i) => {
            let route: Point[] | undefined;
            if (message.state === "arrival") route = this.sourceRoute;
            else if (message.state === "fetch") route = this.route(0, message.producer);
            else if (message.state === "dispatch") route = this.route(1, message.producer * 8 + message.processor);
            else if (message.state === "collect") route = this.route(2, message.processor * 2 + message.key);
            this.showPacket(this.packets[i], route, message.started, message.ends, !!route);
        });
        this.batchPackets.forEach((packet, i) => {
            const batch = model.batches[i];
            if (batch) {
                setText(this.batchLabels[i], String(batch.messages.length));
                this.batchMarks[i].forEach((rect, index) => setAttribute(rect, "visibility", index < batch.messages.length ? "inherit" : "hidden"));
            }
            this.showPacket(packet, batch ? this.route(3, batch.key * 4 + batch.worker) : undefined, batch?.started ?? 0, batch?.ends ?? 1, batch?.state === "travel");
        });
    }
    destroy() {
        this.stop(); this.observer.disconnect();
        this.play.removeEventListener("click", this.toggle); this.next.removeEventListener("click", this.step); this.replay.removeEventListener("click", this.replayRun);
        this.motion.removeEventListener("change", this.preference); document.removeEventListener("visibilitychange", this.sync);
        [...this.packets, ...this.batchPackets].forEach(node => node.remove());
    }
}
