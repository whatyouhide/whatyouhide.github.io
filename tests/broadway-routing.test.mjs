import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/components/broadway_viz/broadwayRoutingModel.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
const { createRoutingModel, advanceRouting, nextRoutingEvent, finished } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function run(options) {
    const model = createRoutingModel(options);
    const arrived = Array.from({length: options.processors}, () => []);
    const seen = new Set();
    while (!finished(model) && model.time < 60000) {
        advanceRouting(model);
        for (const message of model.messages) {
            if (options.partitioned && message.processor !== null) assert.equal(message.processor, message.user % options.processors);
            if (['queued','working','done'].includes(message.state) && !seen.has(message.id)) { seen.add(message.id); arrived[message.processor].push(message.id); }
        }
        model.working.forEach((id, worker) => {
            const active = model.messages.filter(m => m.processor === worker && m.state === 'working');
            assert.equal(active.length, id === null ? 0 : 1, 'one callback per worker');
            if (id !== null) assert.equal(active[0].id, id);
            assert.deepEqual(model.queues[worker], model.messages.filter(m => m.processor === worker && m.state === 'queued').sort((a,b)=>a.ends-b.ends).map(m=>m.id));
            for (let producer=0; producer<options.producers; producer++) assert.ok(model.messages.filter(m=>m.producer===producer && m.processor===worker && !['pending','done'].includes(m.state)).length <= 2, 'demand credit limit');
        });
    }
    assert.ok(finished(model), 'all configurations drain');
    assert.deepEqual(model.completed.flat().sort((a,b)=>a-b), Array.from({length:12},(_,i)=>i+1), 'no loss or duplication');
    assert.deepEqual(model.completed, arrived, 'callbacks keep arrival order at each worker');
    return model;
}

test('routing preserves message, callback, demand, and partition invariants for all counts', () => {
    for (let producers=1; producers<=4; producers++) for (let processors=1; processors<=4; processors++) for (const partitioned of [false,true]) run({producers,processors,partitioned});
});
test('one processor receives messages from every producer', () => {
    const model = run({producers:4,processors:1,partitioned:true});
    assert.equal(new Set(model.messages.filter(m=>m.processor===0).map(m=>m.producer)).size, 4);
});
test('replay and manual steps have the same result', () => {
    const options = {producers:3,processors:2,partitioned:true};
    const expected = run(options);
    assert.deepEqual(run(options), expected);
    const manual = createRoutingModel(options);
    while(!finished(manual)) nextRoutingEvent(manual);
    assert.deepEqual(manual, expected);
});
test('available demand can send the same key to different processors', () => {
    const model = run({producers:3,processors:2,partitioned:false});
    assert.equal(new Set(model.messages.filter(m=>m.user===42).map(m=>m.processor)).size, 2);
});
test('invalid process counts fail before a run starts', () => {
    for(const count of [0,5,1.5,NaN]) assert.throws(()=>createRoutingModel({producers:count,processors:2,partitioned:true}), RangeError);
});
