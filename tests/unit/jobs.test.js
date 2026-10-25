const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createJob, getJob, appendToJob, finishJob, cancelJob, streamJob } = require('../../utils/jobs');

class FakeRes extends EventEmitter {
    constructor() {
        super();
        this.headers = {};
        this.chunks = [];
        this.writableEnded = false;
        this.destroyed = false;
    }
    setHeader(name, value) { this.headers[name] = value; }
    flushHeaders() {}
    write(chunk) { this.chunks.push(String(chunk)); return true; }
    end() { this.writableEnded = true; this.emit('finish'); }
}

test('a replay from an offset returns exactly the remaining output and ends after the job finishes', () => {
    const job = createJob(`t-${Date.now()}-a`);
    appendToJob(job, 'data: one\n\n');
    const res = new FakeRes();
    streamJob(job, res, 0);
    assert.equal(res.writableEnded, false);

    appendToJob(job, 'data: two\n\n');
    finishJob(job, 'done');
    assert.equal(res.writableEnded, true);
    assert.equal(res.chunks.join(''), 'data: one\n\ndata: two\n\nevent: end\ndata: {"status":"done"}\n\n');

    const late = new FakeRes();
    streamJob(job, late, 'data: one\n\n'.length);
    assert.equal(late.chunks.join(''), 'data: two\n\nevent: end\ndata: {"status":"done"}\n\n');
    assert.equal(late.writableEnded, true);
});

test('a finished job reports its error as an SSE error event before the end marker', () => {
    const job = createJob(`t-${Date.now()}-b`);
    finishJob(job, 'error', 'upstream broke');
    assert.equal(job.status, 'error');
    assert.match(job.buffer, /"message":"upstream broke"/);
    assert.match(job.buffer, /event: end/);
});

test('cancelling aborts the job controller and leaves finished jobs alone', () => {
    const job = createJob(`t-${Date.now()}-c`);
    cancelJob(job);
    assert.equal(job.controller.signal.aborted, true);

    const done = createJob(`t-${Date.now()}-d`);
    finishJob(done, 'done');
    cancelJob(done);
    assert.equal(done.controller.signal.aborted, false);
    assert.equal(getJob(done.id), done);
});

test('a client that disconnects does not stop the job', () => {
    const job = createJob(`t-${Date.now()}-e`);
    const res = new FakeRes();
    streamJob(job, res, 0);
    res.emit('close');
    appendToJob(job, 'data: still running\n\n');
    finishJob(job, 'done');
    assert.equal(job.status, 'done');
    assert.equal(job.controller.signal.aborted, false);
    assert.equal(res.chunks.length, 0);
});
