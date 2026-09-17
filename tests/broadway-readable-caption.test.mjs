import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../src/components/broadway_viz/broadwayReadableCaption.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
const { BroadwayReadableCaption, CAPTION_DWELL_MS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('automatic captions stay visible long enough to read', () => {
    const caption = new BroadwayReadableCaption('Messages arrive.', 0);

    assert.equal(caption.update('The source stores message 1.', 240), 'Messages arrive.');
    assert.equal(caption.update('Message 2 arrives.', CAPTION_DWELL_MS - 1), 'Messages arrive.');
    assert.equal(caption.update('Message 2 arrives.', CAPTION_DWELL_MS), 'Message 2 arrives.');
});

test('manual steps show their caption at once', () => {
    const caption = new BroadwayReadableCaption('Messages arrive.', 0);

    assert.equal(caption.update('The source stores message 1.', 240, true), 'The source stores message 1.');
});
