import assert from 'node:assert/strict';
import fs from 'node:fs';

// Runs against the owned real source Electron review page, not a replacement UI.
export async function verifyReviewLayout({ call, evaluate, evidence }) {
  const results = { nativeResize: null, views: [] };
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const geometry = () => evaluate(`(() => {
    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const panel=s=>{const e=document.querySelector(s);return {...rect(e),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight};};
    return {width:innerWidth,height:innerHeight,outerWidth,outerHeight,
      workspace:panel('.review-workspace'),viewer:panel('.review-viewer'),editor:panel('.review-editor'),video:panel('.review-video-shell')};
  })()`);
  const assertGeometry = (m) => {
    for (const name of ['workspace', 'viewer', 'editor', 'video']) {
      const p = m[name];
      assert.ok(p.left >= -1 && p.right <= m.width + 1, `${name} must fit horizontally (${m.width}).`);
      assert.ok(p.scrollWidth <= p.clientWidth + 1, `${name} content must not overflow horizontally at ${m.width}×${m.height}: ${p.scrollWidth}/${p.clientWidth}.`);
    }
    assert.ok(m.viewer.right <= m.editor.left + 1, 'Viewer must not overlap editor.');
    assert.ok(m.video.right <= m.viewer.right + 1, 'Video must not overlap editor.');
    assert.ok(m.viewer.bottom <= m.height + 1 && m.editor.bottom <= m.height + 1, 'Panels must fit viewport height.');
  };
  const measureControls = () => evaluate(`(async () => {
    const ids=['playPause','back5','forward5','loopCue','downloadSrt','downloadVtt','downloadAss','saveSrt','bilingualLayout','cueSearch','qualityFilter','toggleAiToolbar','openYoutubePublish','timeAdjustSeconds','shortenAllCues','extendAllCues','followCue','loadProjectPreset','openTrim','stageProofread','stageBurn','backToHome'];
    const results=[];
    for(const id of ids){const e=document.getElementById(id);e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      await new Promise(r=>requestAnimationFrame(r));
      const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      results.push({id,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,pageScrollY:scrollY,hit:hit?.id||hit?.className,reachable:!!hit&&(e===hit||e.contains(hit))});}
    return results;
  })()`);
  const assertControls = (controls, width, height) => {
    for (const c of controls) assert.ok(c.width > 0 && c.height > 0 && c.left >= -1 && c.right <= width + 1 && c.top >= -1 && c.bottom <= height + 1 && c.reachable && c.pageScrollY === 0, `Control ${c.id} must be reachable without scrolling the page at ${width}×${height}: ${JSON.stringify(c)}.`);
  };
  // window.resizeTo may be rejected by Chromium; only claim native resize if measured.
  await evaluate('window.resizeTo(1100,700); new Promise(r=>setTimeout(r,250))');
  results.nativeResize = await geometry();
  results.nativeResize.applied = results.nativeResize.outerWidth === 1100 && results.nativeResize.outerHeight === 700;
  if (results.nativeResize.applied) {
    assertGeometry(results.nativeResize);
    results.nativeResize.controls = await measureControls();
    assertControls(results.nativeResize.controls, results.nativeResize.width, results.nativeResize.height);
    await evaluate("document.querySelector('.review-viewer').scrollTop=0;document.querySelector('.review-stage').scrollTop=0");
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    results.nativeResize.screenshot = `${evidence}.native-1100x700.png`;
    fs.writeFileSync(results.nativeResize.screenshot, Buffer.from(shot.data, 'base64'), { flag: 'wx' });
  }
  for (const [width, height] of [[1400, 900], [1281, 800], [1280, 800], [1241, 700], [1240, 700], [1200, 700], [1100, 700], [1100, 668]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate("document.querySelector('.review-viewer').scrollTop=0;document.querySelector('.review-stage').scrollTop=0");
    await settle();
    const m = await geometry();
    assertGeometry(m);
    // Scroll real ancestors to each control and verify it can receive pointer input.
    const controls = await measureControls();
    assertControls(controls, width, height);
    await evaluate("document.querySelector('.review-viewer').scrollTop=0;document.querySelector('.review-stage').scrollTop=0");
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const screenshot = `${evidence}.layout-${width}x${height}.png`;
    fs.writeFileSync(screenshot, Buffer.from(shot.data, 'base64'), { flag: 'wx' });
    results.views.push({ ...m, controls, screenshot });
  }
  const expanded = await evaluate(`(async () => {
    document.getElementById('toggleAiToolbar').click();
    const text=document.querySelector('.translated-text');text.value='長字幕換行驗證 '.repeat(150);
    text.style.height='450px';
    text.focus();
    text.scrollIntoView({block:'center'});
    await new Promise(r=>requestAnimationFrame(r));
    const r=text.getBoundingClientRect(),x=r.left+r.width/2,y=Math.max(1,Math.min(innerHeight-2,r.top+r.height/2));
    return {expanded:document.getElementById('toggleAiToolbar').getAttribute('aria-expanded'),pageScrollY:scrollY,
      horizontalFits:r.left>=0&&r.right<=innerWidth,hit:document.elementFromPoint(x,y)===text};
  })()`);
  assert.equal(expanded.expanded, 'true');
  assert.ok(expanded.horizontalFits && expanded.hit, 'Expanded AI and long subtitle must remain reachable.');
  assert.equal(expanded.pageScrollY, 0, 'Long subtitle focus must not scroll away the header.');
  results.expandedLongSubtitle = expanded;
  const expandedShot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${evidence}.expanded-ai-long-subtitle.png`, Buffer.from(expandedShot.data, 'base64'), { flag: 'wx' });
  await call('Emulation.clearDeviceMetricsOverride');
  return results;
}
