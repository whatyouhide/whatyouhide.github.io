import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync(new URL('../src/components/broadway_viz/broadwayPipelineModel.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, {loader:'ts', format:'esm'});
const { createPipeline, advancePipeline, nextPipelineEvent, pipelineFinished, BATCH_SIZE, BATCH_TIMEOUT } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function run(options, check = false) {
    const model = createPipeline(options);
    while (!pipelineFinished(model) && model.time < 90000) {
        advancePipeline(model);
        if (!check) continue;
        for(let worker=0; worker<options.processors; worker++) {
            const active=model.messages.filter(m=>m.processor===worker && m.state==='working');
            assert.ok(active.length<=1, 'one message callback per processor');
            assert.equal(active[0]?.id ?? null,model.working[worker]);
            assert.ok(model.messages.filter(m=>m.processor===worker && ['fetch','received','dispatch','queued','working'].includes(m.state)).length<=2, 'bounded demand');
        }
        for(let producer=0; producer<options.producers; producer++) assert.ok(model.messages.filter(m=>m.producer===producer && ['fetch','received'].includes(m.state)).length<=1, 'bounded producer fetch');
        const batched=model.batches.flatMap(b=>b.messages);
        assert.equal(batched.length,new Set(batched).size,'messages never enter two batches');
        model.batches.forEach(batch=>{
            assert.ok(batch.messages.length>0 && batch.messages.length<=BATCH_SIZE);
            assert.ok(batch.messages.every(id=>model.messages[id-1].key===batch.key),'batch keys stay separate');
            if(batch.reason==='size') assert.equal(batch.messages.length,BATCH_SIZE);
            if(batch.reason==='timeout') assert.ok(Math.min(...batch.messages.map(id=>model.messages[id-1].ends))+BATCH_TIMEOUT<=batch.formedAt,'partial batch waits for timeout');
            if(['working','travel'].includes(batch.state)) assert.equal(model.batches.filter(b=>b.key===batch.key && b.worker===batch.worker && ['working','travel'].includes(b.state)).length,1,'one callback per batch worker');
        });
        assert.equal(model.completed,model.messages.filter(m=>m.state==='done').length);
    }
    assert.ok(pipelineFinished(model),JSON.stringify(options));
    assert.equal(model.messages.length,10);
    if(options.chapter===0) assert.ok(model.messages.every(m=>m.state==='source'));
    else assert.equal(model.completed,10);
    return model;
}

test('every chapter drains with every supported process count',()=>{
    for(let chapter=0;chapter<=4;chapter++) for(let producers=1;producers<=4;producers++) for(let processors=1;processors<=8;processors++) for(let batchers=1;batchers<=2;batchers++) for(let workers=1;workers<=4;workers++) run({chapter,producers,processors,batchers,workers});
});
test('messages preserve ownership, demand, callback and batching invariants',()=>{
    for(const options of [{chapter:4,producers:4,processors:1,batchers:2,workers:4},{chapter:4,producers:1,processors:8,batchers:1,workers:1},{chapter:3,producers:2,processors:4,batchers:2,workers:2}]) run(options,true);
});
test('size and timeout both produce real batches',()=>{
    const model=run({chapter:4,producers:2,processors:4,batchers:2,workers:2});
    assert.ok(model.batches.some(b=>b.reason==='size'));
    assert.ok(model.batches.some(b=>b.reason==='timeout'));
    assert.deepEqual(model.batches.flatMap(b=>b.messages).sort((a,b)=>a-b),Array.from({length:10},(_,i)=>i+1));
});
test('replay and stepping preserve the same result',()=>{
    const options={chapter:4,producers:2,processors:4,batchers:2,workers:2};
    const expected=run(options);
    assert.deepEqual(run(options),expected);
    const manual=createPipeline(options);
    while(!pipelineFinished(manual)) nextPipelineEvent(manual);
    assert.deepEqual(manual,expected);
});
