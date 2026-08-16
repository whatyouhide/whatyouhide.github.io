import { advancePipeline, createPipeline, nextPipelineEvent, pipelineFinished, BATCH_SIZE, type PipelineModel, type PipelineOptions } from "./broadwayPipelineModel";

// Each inline figure shows one handoff. The shared model still runs the full upstream path.
// Counts change the model. A resize changes only coordinates. Packets keep their owners.
const keyName = (key: number) => key === 0 ? ":default" : ":priority";
export type InlineNode = { id: string; label: string; x: number; y: number; width: number };
export type InlineEdge = { id: string; from: string; to: string; x1: number; y1: number; x2: number; y2: number };
export type InlineLayout = { width: number; height: number; headings: { x: number; lines: string[] }[]; nodes: InlineNode[]; edges: InlineEdge[] };
export const edgePath = (edge: InlineEdge) => `M ${edge.x1} ${edge.y1} C ${(edge.x1 + edge.x2) / 2} ${edge.y1}, ${(edge.x1 + edge.x2) / 2} ${edge.y2}, ${edge.x2} ${edge.y2}`;
export function edgePoint(edge: InlineEdge, progress: number) {
    const t = Math.max(0, Math.min(1, progress)), u = 1 - t, middle = (edge.x1 + edge.x2) / 2;
    return { x: u ** 3 * edge.x1 + 3 * u * t * middle + t ** 3 * edge.x2, y: (u ** 3 + 3 * u * u * t) * edge.y1 + (3 * u * t * t + t ** 3) * edge.y2 };
}
export function inlineLayout(options: PipelineOptions, width = 358): InlineLayout {
    const { chapter, producers, processors, batchers, workers } = options;
    const source = [{ id: "source", label: "Source" }];
    const producer = Array.from({ length: producers }, (_, i) => ({ id: `producer-${i}`, label: `Producer ${i + 1}` }));
    const processor = Array.from({ length: processors }, (_, i) => ({ id: `processor-${i}`, label: `Processor ${i + 1}` }));
    const batcher = Array.from({ length: batchers }, (_, i) => ({ id: `batcher-${i}`, label: keyName(i) }));
    const worker = Array.from({ length: batchers * workers }, (_, i) => ({ id: `worker-${Math.floor(i / workers)}-${i % workers}`, label: `${keyName(Math.floor(i / workers))}·${i % workers + 1}` }));
    if (chapter === 0) {
        return { width, height: 182, headings: [{ x: width / 2 - 35, lines: ["Messages"] }], nodes: [{ ...source[0], x: width / 2 - 74, y: 110, width: 148 }], edges: [{ id: "arrival", from: "arrival", to: "source", x1: width / 2, y1: 32, x2: width / 2, y2: 110 }] };
    }
    const stages = [source, producer, processor, batcher, worker];
    const labels = [["Source"], ["Producers"], ["Processors"], ["Batchers"], ["Batch", "processors"]];
    const left = stages[chapter - 1], right = stages[chapter];
    const rows = Math.max(left.length, right.length), field = Math.max(148, rows * 54), nodeWidth = (width - 80) / 2;
    const column = (nodes: typeof source, x: number) => nodes.map((node, i) => ({ ...node, x, y: 42 + field * (i + 0.5) / nodes.length - 21, width: nodeWidth }));
    const nodes = [...column(left, 1), ...column(right, width - nodeWidth - 1)];
    const edges = nodes.slice(0, left.length).flatMap(from => nodes.slice(left.length).filter(to => chapter !== 4 || to.id.startsWith(`worker-${from.id.split("-")[1]}-`)).map(to => ({ id: `${from.id}/${to.id}`, from: from.id, to: to.id, x1: from.x + from.width, y1: from.y + 21, x2: to.x, y2: to.y + 21 })));
    return { width, height: field + 56, nodes, edges, headings: [{ x: 1, lines: labels[chapter - 1] }, { x: width - nodeWidth - 1, lines: labels[chapter] }] };
}
export function createInlinePipeline(options: PipelineOptions) {
    const model = createPipeline(options);
    // Run the upstream events before showing the first handoff in this figure.
    const ready = () => options.chapter === 0 || (options.chapter === 4 ? model.batches.some(batch => batch.state === "travel") : model.messages.some(message => message.state === ["arrival", "fetch", "dispatch", "collect"][options.chapter]));
    while (!ready() && !pipelineFinished(model)) advancePipeline(model);
    return model;
}
export function inlineState(model: PipelineModel) {
    const nodes: Record<string, { active: boolean; status: string }> = { source: { active: model.messages.some(m => m.state === "arrival" || m.state === "fetch"), status: "Message storage" } };
    model.producerBusy.forEach((id, i) => nodes[`producer-${i}`] = { active: id !== null, status: id === null ? "Ready" : `message ${id}` });
    model.working.forEach((id, i) => nodes[`processor-${i}`] = { active: id !== null, status: id === null ? "Ready" : `message ${id}` });
    model.buffers.forEach((buffer, key) => {
        const ready = model.batches.find(batch => batch.key === key && batch.state === "ready");
        nodes[`batcher-${key}`] = { active: buffer.length > 0 || !!ready, status: ready ? `${ready.messages.length} · ${ready.reason}` : `${buffer.length} / ${BATCH_SIZE}` };
        for (let i = 0; i < model.options.workers; i++) {
            const batch = model.batches.find(b => b.key === key && b.worker === i && b.state === "working");
            nodes[`worker-${key}-${i}`] = { active: !!batch, status: batch ? `batch ${batch.id} (${batch.messages.length})` : "Ready" };
        }
    });
    const chapter = model.options.chapter;
    const state = ["arrival", "fetch", "dispatch", "collect"][chapter];
    const packets = chapter === 4
        ? model.batches.filter(b => b.state === "travel").map(b => ({ id: b.id, edge: `batcher-${b.key}/worker-${b.key}-${b.worker}`, started: b.started, ends: b.ends, size: b.messages.length }))
        : model.messages.filter(m => m.state === state).map(m => ({ id: m.id, edge: ["arrival", `source/producer-${m.producer}`, `producer-${m.producer}/processor-${m.processor}`, `processor-${m.processor}/batcher-${m.key}`][chapter], started: m.started, ends: m.ends, size: 1 }));
    const events: { at: number; text: string }[] = [];
    for (const message of model.messages) {
        if (chapter === 0 && message.state === "source") events.push({ at: message.ends, text: `The source stores message ${message.id}.` });
        if (chapter === 0 && message.state === "arrival") events.push({ at: message.started, text: `Message ${message.id} arrives at the source.` });
        if (chapter === 1 && message.producer >= 0) events.push({ at: message.started, text: `Producer ${message.producer + 1} ${message.state === "fetch" ? "fetches" : "received"} message ${message.id}.` });
        if (chapter === 2 && ["dispatch", "queued", "working", "done"].includes(message.state)) events.push({ at: message.state === "done" ? message.ends : message.started, text: message.state === "dispatch" ? `Producer ${message.producer + 1} sends message ${message.id} to processor ${message.processor + 1}.` : `Processor ${message.processor + 1} ${message.state === "done" ? "finished" : "handles"} message ${message.id}.` });
        if (chapter === 3 && ["collect", "buffered"].includes(message.state)) events.push({ at: message.state === "buffered" ? message.ends : message.started, text: `${keyName(message.key)} ${message.state === "collect" ? "receives" : "collected"} message ${message.id}.` });
    }
    if (chapter >= 3) for (const batch of model.batches) events.push({ at: batch.state === "done" ? batch.ends : batch.started, text: chapter === 3 ? `${keyName(batch.key)}: ${batch.messages.length} messages form a batch (${batch.reason}).` : batch.state === "travel" ? `${keyName(batch.key)} sends ${batch.messages.length} messages to worker ${batch.worker + 1}.` : batch.state === "working" ? `Worker ${batch.worker + 1} runs handle_batch/4 on ${batch.messages.length} messages.` : batch.state === "done" ? `Worker ${batch.worker + 1} finished batch ${batch.id}.` : `${keyName(batch.key)} has a batch ready.` });
    const caption = pipelineFinished(model) ? ["All 10 messages are stored at the source.", "Producers received all 10 messages.", "Processors handled all 10 messages.", "All 10 messages formed batches.", "Batch processors handled all 10 messages."][chapter] : events.sort((a, b) => b.at - a.at)[0]?.text ?? model.action;
    return { nodes, packets, caption };
}

export function nextInlineEvent(model: PipelineModel) {
    const visibleNodes = inlineLayout(model.options).nodes.map(node => node.id);
    const signature = () => {
        const state = inlineState(model);
        return JSON.stringify([state.caption, state.packets, visibleNodes.map(id => state.nodes[id])]);
    };
    const before = signature();
    do { nextPipelineEvent(model); } while (!pipelineFinished(model) && signature() === before);
}
