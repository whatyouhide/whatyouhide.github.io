/**
 * Question: how does a message become a processed batch?
 * Model: ten fixed arrivals, bounded fetches, serial callbacks, size/timeout batches.
 * Inputs: visible chapter and process counts. A change starts a new example.
 * Invariants: one owner per message; no callback overlap; batches contain only arrivals.
 * Focus: arrival, fetch, handoff, callback, batch formation, batch callback.
 * Timings illustrate causality, not Broadway's scheduler or demand refill algorithm.
 */
export type PipelineOptions = { chapter: number; producers: number; processors: number; batchers: number; workers: number };
export type PipelineMessage = { id: number; producer: number; processor: number; key: number; state: "pending" | "arrival" | "source" | "fetch" | "received" | "dispatch" | "queued" | "working" | "collect" | "buffered" | "batched" | "done"; started: number; ends: number };
export type PipelineBatch = { id: number; key: number; messages: number[]; reason: "size" | "timeout"; formedAt: number; worker: number; state: "ready" | "travel" | "working" | "done"; started: number; ends: number };
export type PipelineModel = { options: PipelineOptions; time: number; revision: number; action: string; messages: PipelineMessage[]; batches: PipelineBatch[]; buffers: number[][]; bufferSince: number[]; queues: number[][]; working: (number | null)[]; producerBusy: (number | null)[]; completed: number; cursor: number };
export const PIPELINE_STEP = 20;
export const BATCH_SIZE = 3;
export const BATCH_TIMEOUT = 4200;
export const PIPELINE_TRAVEL = 780;

export function createPipeline(options: PipelineOptions): PipelineModel {
    for (const [name, max] of [["chapter",4],["producers",4],["processors",8],["batchers",2],["workers",4]] as const) {
        const value = options[name];
        if (!Number.isInteger(value) || value < (name === "chapter" ? 0 : 1) || value > max) throw new RangeError(`Invalid ${name}`);
    }
    return {
        options: {...options}, time: 0, revision: 0, action: "Messages arrive at the source.", completed: 0, cursor: 0,
        messages: Array.from({length:10}, (_, index) => ({id:index + 1, producer:-1, processor:-1, key:options.batchers === 2 && (index + 1) % 3 === 0 ? 1 : 0, state:"pending", started:0, ends:0})),
        batches: [], buffers: Array.from({length:options.batchers}, () => []), bufferSince: Array(options.batchers).fill(0),
        queues: Array.from({length:options.processors}, () => []), working: Array(options.processors).fill(null), producerBusy: Array(options.producers).fill(null),
    };
}
export const pipelineFinished = (model: PipelineModel) => model.options.chapter === 0 ? model.messages.every(m => m.state === "source") : model.completed === model.messages.length;
function note(model: PipelineModel, action: string) { model.action = action; model.revision++; }
function move(model: PipelineModel, message: PipelineMessage, state: PipelineMessage["state"], duration: number) { message.state = state; message.started = model.time; message.ends = model.time + duration; }
function done(model: PipelineModel, message: PipelineMessage) { message.state = "done"; model.completed++; }
const keyName = (key: number) => key === 0 ? ":default" : ":priority";

export function advancePipeline(model: PipelineModel) {
    if (pipelineFinished(model)) return;
    model.time += PIPELINE_STEP;
    const {chapter, producers, processors, workers} = model.options;
    for (const message of model.messages) {
        if (message.state === "pending" && model.time >= 400 + (message.id - 1) * 860) {
            move(model, message, "arrival", 620);
            note(model, `Message ${message.id} arrives at the source.`);
        } else if (message.state === "arrival" && model.time >= message.ends) {
            message.state = "source";
            note(model, `The source stores message ${message.id}.`);
        } else if (message.state === "fetch" && model.time >= message.ends) {
            move(model, message, "received", 340);
            note(model, `Producer ${message.producer + 1} received message ${message.id}.`);
        } else if (message.state === "received" && model.time >= message.ends) {
            model.producerBusy[message.producer] = null;
            if (chapter === 1) done(model, message);
            else move(model, message, "dispatch", PIPELINE_TRAVEL);
            note(model, chapter === 1 ? `Message ${message.id} is ready for a processor.` : `Producer ${message.producer + 1} sends message ${message.id} to processor ${message.processor + 1}.`);
        } else if (message.state === "dispatch" && model.time >= message.ends) {
            message.state = "queued";
            model.queues[message.processor].push(message.id);
            note(model, `Message ${message.id} reached processor ${message.processor + 1}.`);
        } else if (message.state === "working" && model.time >= message.ends) {
            model.working[message.processor] = null;
            if (chapter === 2) done(model, message);
            else move(model, message, "collect", PIPELINE_TRAVEL);
            note(model, `handle_message/3 finished for message ${message.id}${chapter >= 3 ? `; send it to ${keyName(message.key)}` : ""}.`);
        } else if (message.state === "collect" && model.time >= message.ends) {
            message.state = "buffered";
            if (!model.buffers[message.key].length) model.bufferSince[message.key] = model.time;
            model.buffers[message.key].push(message.id);
            note(model, `${keyName(message.key)} collected message ${message.id}.`);
        }
    }
    if (chapter === 0) return;
    model.queues.forEach((queue, worker) => {
        if (model.working[worker] !== null || !queue.length) return;
        const message = model.messages[queue.shift()! - 1];
        model.working[worker] = message.id;
        move(model, message, "working", 1100 + (message.id % 3) * 180);
        note(model, `Processor ${worker + 1} runs handle_message/3 on message ${message.id}.`);
    });
    const firstWaiting = model.messages.find(m => m.state === "source");
    for (let offset = 0; offset < producers; offset++) {
        const producer = ((firstWaiting?.id ?? 1) - 1 + offset) % producers;
        if (model.producerBusy[producer] !== null) continue;
        const message = model.messages.find(m => m.state === "source");
        if (!message) break;
        const load = (worker: number) => model.messages.filter(m => m.processor === worker && ["fetch","received","dispatch","queued","working"].includes(m.state)).length;
        const candidates = Array.from({length:processors}, (_, index) => (model.cursor + index) % processors);
        const processor = candidates.reduce((best, next) => load(next) < load(best) ? next : best);
        // This example grants two slots per processor. Fetch only when one is free.
        if (chapter >= 2 && load(processor) >= 2) break;
        model.cursor = (processor + 1) % processors;
        message.producer = producer;
        message.processor = processor;
        model.producerBusy[producer] = message.id;
        move(model, message, "fetch", PIPELINE_TRAVEL);
        note(model, `Producer ${producer + 1} fetches message ${message.id} with downstream demand.`);
    }
    model.buffers.forEach((buffer, key) => {
        const timeout = buffer.length > 0 && model.time - model.bufferSince[key] >= BATCH_TIMEOUT;
        if (buffer.length < BATCH_SIZE && !timeout) return;
        const messages = buffer.splice(0, BATCH_SIZE);
        messages.forEach(id => model.messages[id - 1].state = "batched");
        model.batches.push({id:model.batches.length + 1, key, messages, reason:messages.length === BATCH_SIZE ? "size" : "timeout", formedAt:model.time, worker:-1, state:"ready", started:model.time, ends:model.time + 480});
        model.bufferSince[key] = buffer.length ? model.time : 0;
        note(model, `${keyName(key)} forms a batch of ${messages.length}: ${messages.length === BATCH_SIZE ? "batch size reached" : "batch timeout reached"}.`);
    });
    for (const batch of model.batches) {
        if (batch.state === "ready" && model.time >= batch.ends) {
            if (chapter === 3) {
                batch.state = "done";
                batch.messages.forEach(id => done(model, model.messages[id - 1]));
                note(model, `Batch ${batch.id} is ready for handle_batch/4 (${batch.messages.length} messages).`);
                continue;
            }
            const worker = Array.from({length:workers}, (_, i) => i).find(i => !model.batches.some(b => b.key === batch.key && b.worker === i && ["travel","working"].includes(b.state)));
            if (worker === undefined) continue;
            batch.worker = worker; batch.state = "travel"; batch.started = model.time; batch.ends = model.time + 960;
            note(model, `${keyName(batch.key)} sends batch ${batch.id}, with ${batch.messages.length} messages.`);
        } else if (batch.state === "travel" && model.time >= batch.ends) {
            batch.state = "working"; batch.started = model.time; batch.ends = model.time + 2000;
            note(model, `Batch processor ${batch.worker + 1} runs handle_batch/4 on ${batch.messages.length} messages.`);
        } else if (batch.state === "working" && model.time >= batch.ends) {
            batch.state = "done";
            batch.messages.forEach(id => done(model, model.messages[id - 1]));
            note(model, `handle_batch/4 finished batch ${batch.id}.`);
        }
    }
}
export function nextPipelineEvent(model: PipelineModel) {
    const revision = model.revision;
    while (!pipelineFinished(model) && model.revision === revision) advancePipeline(model);
}
