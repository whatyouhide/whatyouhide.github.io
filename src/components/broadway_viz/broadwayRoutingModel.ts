/** A bounded routing example, not a reproduction of GenStage's scheduler. */
export type RoutingOptions = { producers: number; processors: number; partitioned: boolean };
export type Message = { id: number; user: number; producer: number; processor: number | null; state: "pending" | "travel" | "queued" | "working" | "done"; started: number; ends: number };
export type RoutingModel = { options: RoutingOptions; time: number; nextDispatch: number; cursor: number; messages: Message[]; queues: number[][]; working: (number | null)[]; completed: number[][]; revision: number; action: string };
export const TRAVEL_MS = 700;
export const STEP_MS = 20;
export const userIds = [42, 7, 42, 9, 42, 7, 9, 42, 7, 9, 42, 7];

export function createRoutingModel(options: RoutingOptions): RoutingModel {
    if (![options.producers, options.processors].every(n => Number.isInteger(n) && n >= 1 && n <= 4)) throw new RangeError("Counts must be between 1 and 4.");
    return {
        options: { ...options }, time: 0, nextDispatch: 500, cursor: 0, revision: 0,
        messages: userIds.map((user, index) => ({ id: index + 1, user, producer: index % options.producers, processor: null, state: "pending", started: 0, ends: 0 })),
        queues: Array.from({ length: options.processors }, () => []),
        working: Array(options.processors).fill(null),
        completed: Array.from({ length: options.processors }, () => []),
        action: "Each processor has demand at every producer. Follow the first message.",
    };
}

export const finished = (model: RoutingModel) => model.messages.every(message => message.state === "done");
const announce = (model: RoutingModel, action: string) => { model.action = action; model.revision++; };

export function advanceRouting(model: RoutingModel) {
    model.time += STEP_MS;
    const { processors, partitioned } = model.options;
    for (const message of model.messages) {
        if (message.state === "working" && message.ends <= model.time) {
            const worker = message.processor!;
            message.state = "done";
            model.working[worker] = null;
            model.completed[worker].push(message.id);
            announce(model, `Processor ${worker} finished message ${message.id} (user ${message.user}).`);
        }
    }
    for (const message of model.messages) {
        if (message.state === "travel" && message.ends <= model.time) {
            message.state = "queued";
            model.queues[message.processor!].push(message.id);
            announce(model, `Message ${message.id} reached processor ${message.processor}.`);
        }
    }
    model.queues.forEach((queue, worker) => {
        if (model.working[worker] !== null || !queue.length) return;
        const message = model.messages[queue.shift()! - 1];
        model.working[worker] = message.id;
        message.state = "working";
        message.started = model.time;
        message.ends = model.time + (message.user === 42 ? 2400 : 1000);
        announce(model, `Processor ${worker} started message ${message.id} (user ${message.user}).`);
    });
    if (model.time < model.nextDispatch) return;
    // Two credits per producer/processor subscription. Completion returns one.
    const outstanding = (producer: number, worker: number) => model.messages.filter(m => m.producer === producer && m.processor === worker && m.state !== "pending" && m.state !== "done").length;
    for (const message of model.messages) {
        if (message.state !== "pending") continue;
        // Each producer keeps its own source order, including when it has no credit.
        if (model.messages.some(m => m.producer === message.producer && m.id < message.id && m.state === "pending")) continue;
        let worker = message.user % processors;
        if (!partitioned) {
            const candidates = Array.from({ length: processors }, (_, i) => (model.cursor + i) % processors).filter(i => outstanding(message.producer, i) < 2);
            if (!candidates.length) continue;
            worker = candidates.reduce((best, next) => {
                const load = (i: number) => model.messages.filter(m => m.processor === i && m.state !== "done").length;
                return load(next) < load(best) ? next : best;
            });
        }
        if (outstanding(message.producer, worker) >= 2) continue;
        message.processor = worker;
        message.state = "travel";
        message.started = model.time;
        message.ends = model.time + TRAVEL_MS;
        model.cursor = (worker + 1) % processors;
        model.nextDispatch = model.time + 900;
        announce(model, `Producer ${message.producer + 1} sent message ${message.id}, user ${message.user}, to processor ${worker}${partitioned ? `: ${message.user} % ${processors} = ${worker}` : " using available demand"}.`);
        break;
    }
}

export function nextRoutingEvent(model: RoutingModel) {
    const revision = model.revision;
    while (!finished(model) && model.revision === revision) advanceRouting(model);
}
