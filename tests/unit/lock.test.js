const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { withFileLock } = require('../../utils/helpers');

test('withFileLock serializes read-modify-write cycles on the same file', async () => {
    const file = path.join(os.tmpdir(), `aiui-lock-${Date.now()}.txt`);
    fs.writeFileSync(file, '0');
    try {
        await Promise.all(Array.from({ length: 50 }, () => withFileLock(file, async () => {
            const value = Number(await fsp.readFile(file, 'utf8'));
            await new Promise(r => setTimeout(r, Math.random() * 5));
            await fsp.writeFile(file, String(value + 1));
        })));
        assert.equal(fs.readFileSync(file, 'utf8'), '50');
    } finally {
        fs.rmSync(file, { force: true });
    }
});

test('withFileLock keeps running after a task fails', async () => {
    const file = path.join(os.tmpdir(), `aiui-lock-err-${Date.now()}.txt`);
    await assert.rejects(withFileLock(file, () => Promise.reject(new Error('boom'))), /boom/);
    const result = await withFileLock(file, () => 'ok');
    assert.equal(result, 'ok');
});
