import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const { outputFiles } = await build({ stdin: {
    contents: `export * from './src/components/broadway_viz/broadwayInlineScene'; export * from './src/components/broadway_viz/broadwayPipelineModel';`,
    resolveDir: process.cwd(),
}, bundle: true, write: false, format: 'esm', platform: 'node' });
const { inlineLayout, inlineState, createInlinePipeline, advancePipeline, pipelineFinished, nextInlineEvent, edgePoint } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

const counts = [
    { producers: 2, processors: 4, batchers: 2, workers: 2 },
    { producers: 4, processors: 8, batchers: 2, workers: 4 },
    { producers: 1, processors: 1, batchers: 1, workers: 1 },
];

test('inline diagrams start at a real transfer and keep each packet on its owning route', () => {
    for (let chapter = 0; chapter <= 4; chapter++) for (const count of counts) {
        const options = { chapter, ...count };
        const model = createInlinePipeline(options);
        const layout = inlineLayout(options, 288);
        if (chapter > 0) assert.ok(inlineState(model).packets.length > 0, 'start at the first handoff');
        let transfers = 0;
        while (!pipelineFinished(model)) {
            const { nodes, packets } = inlineState(model);
            assert.ok(layout.nodes.every(node => nodes[node.id]), 'every drawn node has model state');
            for (const packet of packets) {
                transfers++;
                const edge = layout.edges.find(edge => edge.id === packet.edge);
                assert.ok(edge, 'every moving packet has a visible path');
                assert.deepEqual(edgePoint(edge, 0), { x: edge.x1, y: edge.y1 });
                assert.deepEqual(edgePoint(edge, 1), { x: edge.x2, y: edge.y2 });
                if (chapter === 4) {
                    const batch = model.batches.find(batch => batch.id === packet.id);
                    assert.equal(batch.state, 'travel');
                    assert.equal(packet.size, batch.messages.length);
                    assert.equal(edge.to, `worker-${batch.key}-${batch.worker}`);
                    assert.equal(edge.from, `batcher-${batch.key}`);
                } else {
                    const message = model.messages.find(message => message.id === packet.id);
                    assert.equal(packet.started, message.started);
                    assert.equal(packet.ends, message.ends);
                    const destination = ['source', `producer-${message.producer}`, `processor-${message.processor}`, `batcher-${message.key}`][chapter];
                    assert.equal(edge.to, destination);
                }
            }
            advancePipeline(model);
        }
        assert.ok(transfers > 0);
        assert.equal(chapter === 0 ? model.messages.filter(m => m.state === 'source').length : model.completed, 10);
        assert.equal(inlineState(model).packets.length, 0);
    }
});

test('inline layouts fit narrow screens and preserve state on resize', () => {
    for (let chapter = 0; chapter <= 4; chapter++) for (const count of counts) {
        const options = { chapter, ...count }, model = createInlinePipeline(options);
        const before = structuredClone(model);
        for (const width of [288, 358, 727]) {
            const layout = inlineLayout(options, width);
            for (const node of layout.nodes) {
                assert.ok(node.x >= 0 && node.x + node.width <= width);
                assert.ok(node.y >= 0 && node.y + 42 <= layout.height);
            }
            assert.ok(layout.edges.every(edge => layout.nodes.some(node => node.id === edge.to)));
        }
        assert.deepEqual(model, before);
    }
});

test('manual inline steps reach the same result as continuous playback', () => {
    for (let chapter = 0; chapter <= 4; chapter++) {
        const options = { chapter, ...counts[0] };
        const continuous = createInlinePipeline(options);
        while (!pipelineFinished(continuous)) advancePipeline(continuous);
        const manual = createInlinePipeline(options);
        while (!pipelineFinished(manual)) nextInlineEvent(manual);
        assert.deepEqual(manual, continuous);
    }
});
