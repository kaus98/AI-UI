// Pipe an upstream streaming response (fetch Response) to an Express response.
// - Cancels the upstream read if the client disconnects, so no tokens are pulled for nobody.
// - If upstream fails mid-stream, emits an SSE error event and closes the response.
async function pipeStream(upstream, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!upstream.body) return res.end();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let finished = false;

    const onClientClose = () => {
        if (!finished) reader.cancel().catch(() => {});
    };
    res.on('close', onClientClose);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done || res.destroyed) break;
            res.write(decoder.decode(value, { stream: true }));
            if (typeof res.flush === 'function') res.flush();
        }
    } catch (err) {
        if (!finished && !res.writableEnded) {
            console.error('Upstream stream failed:', err.message);
            res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
        }
    } finally {
        finished = true;
        res.off('close', onClientClose);
        if (!res.writableEnded) res.end();
    }
}

module.exports = { pipeStream };
