const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { pipeStream } = require('../../utils/stream');

class FakeRes extends EventEmitter {
    constructor() {
        super();
        this.headers = {};
        this.chunks = [];
        this.writableEnded = false;
        this.destroyed = false;
    }
    setHeader(name, value) { this.headers[name] = value; }
    write(chunk) { this.chunks.push(String(chunk)); return true; }
    end() { this.writableEnded = true; this.emit('finish'); }
}

const encoder = new TextEncoder();

test('forwards every upstream chunk and ends the response', async () => {
    const upstream = new Response(new ReadableStream({
        start(c) {
            c.enqueue(encoder.encode('data: one\n\n'));
            c.enqueue(encoder.encode('data: two\n\n'));
            c.close();
        }
    }));
    const res = new FakeRes();
    await pipeStream(upstream, res);
    assert.equal(res.headers['Content-Type'], 'text/event-stream');
    assert.equal(res.chunks.join(''), 'data: one\n\ndata: two\n\n');
    assert.equal(res.writableEnded, true);
});

test('cancels the upstream read when the client disconnects', async () => {
    let cancelled = false;
    const upstream = new Response(new ReadableStream({
        start(c) { c.enqueue(encoder.encode('data: first\n\n')); },
        cancel() { cancelled = true; }
    }));
    const res = new FakeRes();
    const done = pipeStream(upstream, res);
    await new Promise(r => setImmediate(r));
    res.emit('close');
    await done;
    assert.equal(cancelled, true);
    assert.equal(res.writableEnded, true);
});

test('reports a mid-stream upstream failure as an SSE error event', async () => {
    let pulls = 0;
    const upstream = new Response(new ReadableStream({
        pull(c) {
            if (pulls++ === 0) c.enqueue(encoder.encode('data: partial\n\n'));
            else c.error(new Error('upstream broke'));
        }
    }));
    const res = new FakeRes();
    await pipeStream(upstream, res);
    assert.equal(res.chunks[0], 'data: partial\n\n');
    assert.match(res.chunks[1], /upstream broke/);
    assert.equal(res.writableEnded, true);
});
