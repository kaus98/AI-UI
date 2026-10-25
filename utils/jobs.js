const EventEmitter = require('events');

// A job is one chat generation. It runs independently of any HTTP connection: output is
// buffered here, and clients can (re)attach at any offset to replay and follow it.
const JOB_TTL_MS = 15 * 60 * 1000;
const jobs = new Map();

function createJob(id) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    const job = { id, buffer: '', status: 'running', finished: false, controller: new AbortController(), emitter };
    jobs.set(id, job);
    return job;
}

function getJob(id) {
    return jobs.get(id);
}

function appendToJob(job, text) {
    if (!text || job.finished) return;
    job.buffer += text;
    job.emitter.emit('update');
}

function sseData(payload) {
    return `data: ${JSON.stringify(payload)}\n\n`;
}

function finishJob(job, status = 'done', errorMessage = null) {
    if (job.finished) return;
    if (errorMessage) appendToJob(job, sseData({ error: { message: errorMessage } }));
    job.buffer += `event: end\ndata: ${JSON.stringify({ status })}\n\n`;
    job.status = status;
    job.finished = true;
    job.emitter.emit('update');
    setTimeout(() => {
        if (jobs.get(job.id) === job) jobs.delete(job.id);
    }, JOB_TTL_MS).unref();
}

function cancelJob(job) {
    if (!job.finished) job.controller.abort();
}

async function pipeUpstreamToJob(upstream, job) {
    if (!upstream.body) return;
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToJob(job, decoder.decode(value, { stream: true }));
    }
    appendToJob(job, decoder.decode());
}

// Send the job's output from `offset` onward, then keep following until the job finishes.
function streamJob(job, res, offset = 0) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Job-Id', job.id);
    res.flushHeaders();

    let sent = Math.min(Math.max(offset, 0), job.buffer.length);
    let closed = false;

    const cleanup = () => {
        closed = true;
        job.emitter.off('update', flush);
        res.off('close', cleanup);
    };

    const flush = () => {
        if (closed || res.destroyed) return cleanup();
        if (sent < job.buffer.length) {
            res.write(job.buffer.slice(sent));
            sent = job.buffer.length;
        }
        if (job.finished) {
            cleanup();
            res.end();
        }
    };

    job.emitter.on('update', flush);
    res.on('close', cleanup);
    flush();
}

module.exports = { createJob, getJob, appendToJob, finishJob, cancelJob, pipeUpstreamToJob, streamJob, sseData };
