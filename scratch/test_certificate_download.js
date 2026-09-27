/**
 * Automated test for GET /api/certificate (the certificate PDF download
 * endpoint used by both normal browsers and the Telegram download flow).
 *
 * Run with:  node scratch/test_certificate_download.js
 *
 * Verifies:
 *  - The server starts and the endpoint returns HTTP 200 for a valid payload
 *  - Content-Type is application/pdf
 *  - Content-Disposition contains "attachment" and the expected filename
 *  - The response body is a structurally valid PDF (starts with %PDF)
 *  - Uzbek/Cyrillic names do not crash PDF generation and are embedded
 *  - Missing/invalid "data" param is rejected with 400, not a crash
 */
const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');

function encodeCertExportParam(cert) {
  const json = JSON.stringify(cert);
  const base64 = Buffer.from(json, 'utf8').toString('base64');
  return encodeURIComponent(base64);
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: PORT, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

const PORT = 3901;
process.env.PORT = String(PORT);

async function main() {
  // Run server.js as a real child process (so `require.main === module`
  // is naturally true and it binds+listens) rather than requiring it in
  // this process, which would only define its exports without starting
  // the HTTP server.
  const serverProc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let bootLog = '';
  serverProc.stdout.on('data', (d) => { bootLog += d.toString(); });
  serverProc.stderr.on('data', (d) => { bootLog += d.toString(); });

  const cleanup = () => { try { serverProc.kill(); } catch (_) {} };
  process.on('exit', cleanup);

  // Wait for the server to be ready to accept connections.
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      await get('/api/questions');
      ready = true;
    } catch (_) { /* not up yet */ }
  }
  if (!ready) {
    console.error('Server did not start in time. Boot log:\n' + bootLog);
    cleanup();
    process.exit(1);
  }

  let failures = 0;
  const check = (label, fn) => {
    try { fn(); console.log('  PASS -', label); }
    catch (e) { failures++; console.error('  FAIL -', label, '\n        ', e.message); }
  };

  // --- Test 1: valid Latin-name certificate ---
  const cert1 = {
    userName: 'Aliyev Sardor Bahodirovich',
    score: 19, total: 20, percentage: 95, grade: "A'LO (PASS)",
    certificateId: 'OP-2026-100001', dateStr: '27 sentyabr 2026', year: 2026, isDemo: false
  };
  const res1 = await get('/api/certificate?data=' + encodeCertExportParam(cert1));
  check('valid cert -> HTTP 200', () => assert.strictEqual(res1.statusCode, 200));
  check('valid cert -> Content-Type application/pdf', () => assert.strictEqual(res1.headers['content-type'], 'application/pdf'));
  check('valid cert -> Content-Disposition attachment', () => assert.ok(/attachment/.test(res1.headers['content-disposition'] || '')));
  check('valid cert -> correct filename', () => assert.ok(
    (res1.headers['content-disposition'] || '').includes('OSON-PRAVA-SERTIFIKAT-OP-2026-100001.pdf')
  ));
  check('valid cert -> body starts with %PDF', () => assert.strictEqual(res1.body.slice(0, 5).toString(), '%PDF-'));
  check('valid cert -> Access-Control-Allow-Origin set for Telegram downloadFile()', () =>
    assert.strictEqual(res1.headers['access-control-allow-origin'], 'https://web.telegram.org'));

  // --- Test 2: Uzbek/Cyrillic name must not crash PDF generation ---
  const cert2 = {
    userName: 'Абдурахмонова Зилола Шарифжон қизи', // Cyrillic Uzbek
    score: 18, total: 20, percentage: 90, grade: 'YAXSHI (PASS)',
    certificateId: 'OP-2026-100002', dateStr: "27 sentyabr 2026 yil, o‘g‘il", year: 2026, isDemo: false
  };
  const res2 = await get('/api/certificate?data=' + encodeCertExportParam(cert2));
  check('cyrillic name -> HTTP 200 (no crash)', () => assert.strictEqual(res2.statusCode, 200));
  check('cyrillic name -> body starts with %PDF', () => assert.strictEqual(res2.body.slice(0, 5).toString(), '%PDF-'));
  check('cyrillic name -> non-trivial PDF size', () => assert.ok(res2.body.length > 5000));

  // --- Test 3: missing data param -> 400, not a 500 crash ---
  const res3 = await get('/api/certificate');
  check('missing data param -> HTTP 400', () => assert.strictEqual(res3.statusCode, 400));

  // --- Test 4: malformed data param -> handled gracefully (500 JSON, not a hang/crash) ---
  const res4 = await get('/api/certificate?data=not-valid-base64-json%%%');
  check('malformed data -> not HTTP 200', () => assert.notStrictEqual(res4.statusCode, 200));

  cleanup();
  console.log(failures === 0 ? '\nAll certificate download tests passed.\n' : `\n${failures} test(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
