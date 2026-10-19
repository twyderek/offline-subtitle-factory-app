import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyReviewLayout } from './review-layout-fixture.mjs';

// Frontend-byte comparison or native App diagnostics, always with an owned test profile.
export async function compareInstalledUi({ call, evaluate, socket, until, review, evidence, nativeVersion = null, executable, runtimeAppRoot }) {
  const installed = '/Applications/離線字幕工廠.app/Contents/Resources/app';
  const publicRoot = fs.realpathSync(path.join(installed, 'public'));
  const origin = review.origin;
  const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const layoutValidation = process.argv.includes('--validate-layout');
  const results = { mode: nativeVersion ? `native-${nativeVersion}-app` : 'installed-frontend-in-source-shell', installedVersion: JSON.parse(fs.readFileSync(path.join(installed, 'package.json'))).version,
    sourceVersion: JSON.parse(fs.readFileSync('package.json')).version, hashes: {}, views: [], tasks: [], interceptionErrors: [],
    limitations: ['Source Electron shell and fixture APIs shared by both frontends; not installed runtime acceptance.',
      'Viewport emulation, not native resize or OS scaling.', 'Reference path is fixed to the local /Applications installation.'] };
  if (nativeVersion) {
    if (!runtimeAppRoot) throw new Error('Native runtime app root is required.');
    results.runtimeVersion = JSON.parse(fs.readFileSync(path.join(runtimeAppRoot, 'package.json'))).version;
    results.executableHash = hash(executable);
    results.mainScriptHash = hash(path.join(runtimeAppRoot, 'electron/main.mjs'));
    results.limitations = ['Owned isolated profile and synthetic media; not existing user data.',
      layoutValidation ? 'Native resize measurements are recorded under layout.nativeResize; other layout cases use viewport emulation. OS scaling was not varied.' : 'Native default window only; resizing and OS scaling not varied.',
      'No real Google/Keychain/upload or full transcription/export acceptance.'];
  }
  for (const name of ['index.html', 'review.html', 'styles.css', 'app.js', 'review.js']) {
    results.hashes[name] = { installed: hash(path.join(publicRoot, name)), source: hash(path.resolve('public', name)) };
    if (nativeVersion) results.hashes[name].runtime = hash(path.join(runtimeAppRoot, 'public', name));
  }
  const intercepted = new Set();
  const listener = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method !== 'Fetch.requestPaused') return;
    const task = (async () => {
      const { requestId, request } = message.params;
      try {
        const url = new URL(request.url);
        const relative = url.pathname === '/' ? 'index.html'
          : url.pathname === review.pathname ? 'review.html' : decodeURIComponent(url.pathname).slice(1);
        const candidate = path.resolve(publicRoot, relative);
        if (url.origin !== origin || !candidate.startsWith(`${publicRoot}${path.sep}`)
          || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()
          || !fs.realpathSync(candidate).startsWith(`${publicRoot}${path.sep}`)) {
          await call('Fetch.continueRequest', { requestId }); return;
        }
        const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(candidate)] || 'application/octet-stream';
        await call('Fetch.fulfillRequest', { requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: mime }, { name: 'Cache-Control', value: 'no-store' }],
          body: fs.readFileSync(candidate).toString('base64') });
      } catch (error) {
        results.interceptionErrors.push(error.message);
        await call('Fetch.failRequest', { requestId, errorReason: 'Failed' });
      }
    })();
    intercepted.add(task);
    task.catch((error) => results.interceptionErrors.push(error.message)).finally(() => intercepted.delete(task));
  };
  try {
    for (const version of nativeVersion ? [nativeVersion] : ['source', 'installed']) {
      if (!nativeVersion && version === 'installed') {
        socket.addEventListener('message', listener);
        await call('Fetch.enable', { patterns: [{ urlPattern: `${origin}/*`, requestStage: 'Request' }] });
      }
      for (const page of ['home', 'review']) {
        const home = new URL(review); home.pathname = '/'; // Preserve the owned API token without recording it.
        await call('Page.navigate', { url: page === 'home' ? home.href : review.href });
        await until(() => evaluate(page === 'home' ? 'Boolean(document.getElementById("jobForm"))'
          : 'document.getElementById("reviewVideo")?.readyState >= 1 && Boolean(document.querySelector(".review-cue"))'));
        // Let layout/fonts and asynchronous fixture state settle before comparison.
        await evaluate('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,400)))');
        if (page === 'home') {
          await until(() => evaluate('!document.body.textContent.includes("本機 API 驗證失敗")'));
        } else {
          const playback = await evaluate(`(async()=>{const v=document.getElementById('reviewVideo');v.muted=true;await v.play();
            const deadline=performance.now()+5000;while(v.currentTime<=0&&performance.now()<deadline)await new Promise(r=>setTimeout(r,50));
            v.pause();return {duration:v.duration,currentTime:v.currentTime};})()`);
          if (!(playback.currentTime > 0)) throw new Error('Comparison video playback failed.');
          results.tasks.push({ version, playback });
        }
        for (const [width, height] of nativeVersion ? [[1400, 900]] : [[1400, 900], [1280, 800], [1100, 700]]) {
          if (!nativeVersion) {
            await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
          }
          await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
          const metrics = await evaluate(`(() => {
            const rect=(element)=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
            return {width:innerWidth,height:innerHeight,outerWidth,outerHeight,bodyWidth:document.body.scrollWidth,
              controls:[...document.querySelectorAll(${JSON.stringify(page === 'review' ? '.review-top-actions button' : '.sidebar button, .sidebar a')})].map(e=>({id:e.id,text:e.textContent.trim(),...rect(e)})),
              video:document.getElementById('reviewVideo') ? {duration:document.getElementById('reviewVideo').duration} : null,
              panels:[...document.querySelectorAll('.review-workspace,.review-viewer,.review-editor,#cueList')].map(e=>({id:e.id,className:e.className,...rect(e)})),
              cueCount:document.querySelectorAll('.review-cue').length};
          })()`);
          const file = `${evidence}.${version}-${page}-${width}.png`;
          const shot = await call('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(file, Buffer.from(shot.data, 'base64'), { flag: 'wx' });
          results.views.push({ version, page, requestedWindow: { width, height },
            ...metrics, screenshot: path.basename(file) });
        }
        if (page === 'review') {
          const original = await evaluate('document.querySelector(".translated-text").value');
          const editAndSave = async (value) => {
            await evaluate(`(()=>{const e=document.querySelector('.translated-text');e.value=${JSON.stringify(value)};
              e.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('saveSrt').click();})()`);
            await until(() => evaluate('document.getElementById("reviewStatus").textContent.includes("已另存 SRT")'));
          };
          await editAndSave('介面複核 fixture');
          await call('Page.navigate', { url: review.href });
          await until(() => evaluate('document.querySelector(".translated-text")?.value === "介面複核 fixture"'));
          await editAndSave(original);
          await call('Page.navigate', { url: review.href });
          await until(() => evaluate(`document.querySelector('.translated-text')?.value === ${JSON.stringify(original)}`));
          results.tasks.at(-1).editSaveReloadRestored = true;
        }
      }
      if (!nativeVersion && version === 'installed') {
        await call('Fetch.disable');
        await Promise.all([...intercepted]);
        socket.removeEventListener('message', listener);
      }
    }
    if (['source', 'candidate'].includes(nativeVersion) && layoutValidation) results.layout = await verifyReviewLayout({ call, evaluate, evidence });
    if (results.interceptionErrors.length) throw new Error('Installed frontend interception failed.');
    fs.writeFileSync(`${evidence}.comparison.json`, JSON.stringify(results, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ comparison: results }));
  } finally {
    await call('Fetch.disable');
    await Promise.allSettled([...intercepted]);
    socket.removeEventListener('message', listener);
    if (!nativeVersion) await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: review.href });
  }
}
