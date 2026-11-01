// 브라우저 자동 검증 (Playwright 필요: 프로젝트에는 포함하지 않음)
//   준비:  python -m http.server 4173 --directory dist   (다른 터미널)
//   실행:  NODE_PATH=<playwright 가 설치된 node_modules> node tools/e2e_check.js [shots 폴더]
//   환경변수: BASE(기본 http://localhost:4173/index.html), PW_EXE(설치된 chromium 실행 파일 경로, 선택)
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/index.html';
const SHOTS = process.argv[2] || path.join(os.tmpdir(), 'chalkak_shots');
fs.mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = [[360, 640], [390, 844], [412, 915], [768, 1024]];
const results = [];
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail === undefined ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail)) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined && !ok ? '  ' + JSON.stringify(detail) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FONT = /fonts\.(googleapis|gstatic)/;

async function newPage(browser, vp, opt) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: vp[0], height: vp[1] } }, opt || {}));
  const p = await ctx.newPage(); p.ctx = ctx; p.errs = []; p.bad = [];
  p.on('console', m => { if (m.type() === 'error' && !FONT.test(m.text() + (m.location().url || ''))) p.errs.push(m.text()) });
  p.on('pageerror', e => p.errs.push('PAGEERR ' + e.message));
  p.on('requestfailed', r => { if (!FONT.test(r.url())) p.bad.push(r.url() + ' ' + ((r.failure() || {}).errorText || '')) });
  p.on('response', r => { if (r.status() >= 400 && !FONT.test(r.url())) p.bad.push(r.status() + ' ' + r.url()) });
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await sleep(250);
  await p.evaluate(() => { window.__cancels = 0; window.addEventListener('pointercancel', () => window.__cancels++) });
  return p;
}
const geo = p => p.evaluate(() => { const s = document.querySelector('#stage').getBoundingClientRect(); return { l: s.left, w: s.width, b: s.bottom, h: s.height } });
const center = (p, id, fy) => p.evaluate(({ id, fy }) => { const r = document.querySelector(`.family-member[data-id="${id}"] .hit`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * fy] }, { id, fy: fy || .55 });
async function dragTo(p, id, xp, yp, steps) {
  const r = await p.evaluate(id => { const s = document.querySelector('#stage').getBoundingClientRect(), m = document.querySelector(`.family-member[data-id="${id}"] .hit`).getBoundingClientRect(); return { sl: s.left, sw: s.width, sb: s.bottom, sh: s.height, cx: m.left + m.width / 2, cy: m.top + m.height * .55 } }, id);
  await p.mouse.move(r.cx, r.cy); await p.mouse.down(); const tx = r.sl + xp / 100 * r.sw, ty = r.sb - yp / 100 * r.sh, n = steps || 5;
  await p.mouse.move((r.cx + tx) / 2, (r.cy + ty) / 2, { steps: n }); await p.mouse.move(tx, ty, { steps: n }); await p.mouse.up();
}
const st = p => p.evaluate(() => ({ phase: __game.phase, rem: __game.S.rem, conds: __game.evaluateConditions(__game.cfg, __game.measure(), document.querySelector('#stage').clientWidth / document.querySelector('#stage').clientHeight) }));
const leftOf = (p, id) => p.evaluate(id => parseFloat(document.querySelector(`.family-member[data-id="${id}"]`).style.left), id);
async function satisfy(p, level) {            // 레벨별로 '실제 드래그/탭'으로 조건 2개를 맞춘다
  if (level === 1) await dragTo(p, 'bro', 82, 2);
  if (level === 2) { const mx = await leftOf(p, 'mom'); await dragTo(p, 'dad', mx + 9, 31); }
  if (level === 3) { const c = await center(p, 'sis', .5); await p.mouse.click(c[0], c[1]); await sleep(60); const c2 = await center(p, 'sis', .5); await p.mouse.click(c2[0], c2[1]); }
}
const waitPhase = (p, ph, to) => p.waitForFunction(x => __game.phase === x, ph, { timeout: to || 8000, polling: 20 });
const waitRem = (p, r) => p.waitForFunction(x => __game.S.rem !== undefined && __game.S.rem <= x, r, { timeout: 8000, polling: 15 });
const shutter = p => p.evaluate(() => document.querySelector('#shutter').click());
const waitResult = p => p.waitForFunction(() => document.querySelector('#result').classList.contains('active'), null, { timeout: 8000 });
const lastRec = p => p.evaluate(() => JSON.parse(localStorage.getItem('familyPhotoGallery'))[0]);
async function toStaging(p) { await p.click('#missionStart'); await sleep(150) }
const noAuto = p => p.evaluate(() => { __game.S.stagingStart = performance.now() / 1000 + 9999 });   // 스트레스 테스트 중 15초 자동 시작 방지

// 한글 한 글자 낙하(마지막 줄이 1글자) 검사
const orphanCheck = (p, sel) => p.evaluate(sel => {
  const bad = [];
  document.querySelectorAll(sel).forEach(el => {
    if (!el.getClientRects().length) return;
    const chain = []; for (let a = el; a && a !== document.body; a = a.parentElement) { chain.push([a, a.style.cssText]); a.style.setProperty('transform', 'none', 'important'); a.style.setProperty('animation', 'none', 'important'); a.style.setProperty('clip-path', 'none', 'important'); a.style.setProperty('opacity', '1', 'important') }   // 회전·애니메이션 중에는 줄 판정이 틀어지므로 잠시 해제
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const rows = {};
    while ((n = w.nextNode())) { const t = n.textContent; for (let i = 0; i < t.length; i++) { if (/\s/.test(t[i])) continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (!b.width) continue; const k = Math.round(b.top / 4); rows[k] = (rows[k] || 0) + 1 } }
    const ks = Object.keys(rows).map(Number).sort((a, b) => a - b); if (ks.length > 1 && rows[ks[ks.length - 1]] === 1) bad.push(el.textContent.trim().slice(0, 30));
    chain.forEach(([a, c]) => { a.style.cssText = c });
  });
  return bad;
}, sel);
const overflowCheck = (p, sel) => p.evaluate(sel => { const bad = []; document.querySelectorAll(sel).forEach(el => { if (!el.getClientRects().length) return; const r = el.getBoundingClientRect(); if (r.width && (r.left < -1 || r.right > innerWidth + 1)) bad.push(el.textContent.trim().slice(0, 20) + ':' + Math.round(r.left) + '~' + Math.round(r.right)) }); return bad }, sel);
const membersInside = p => p.evaluate(() => { const s = document.querySelector('#stage').getBoundingClientRect(); return [...document.querySelectorAll('.family-member')].map(m => { const r = m.querySelector('.hit').getBoundingClientRect(); const ix = Math.max(0, Math.min(r.right, s.right) - Math.max(r.left, s.left)), iy = Math.max(0, Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top)); const cs = getComputedStyle(m); return { id: m.dataset.id, frac: +(ix * iy / (r.width * r.height)).toFixed(3), shown: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 } }) });

(async () => {
  const exe = process.env.PW_EXE || (os.homedir() + '/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe');
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});

  // ===== 1. 뷰포트별 완주 =====
  for (const vp of VIEWPORTS) {
    const tag = `${vp[0]}x${vp[1]}`; const p = await newPage(browser, vp);
    try {
      await p.screenshot({ path: path.join(SHOTS, `${tag}_title.png`) });
      const o1 = await orphanCheck(p, '.subtitle,.title-sub span,.title-sub button,.how,.difficulty button'); rec(`[${tag}] 타이틀 글자 낙하 없음`, o1.length === 0, o1);
      await p.click('#startBtn'); await sleep(150);
      const o2 = await orphanCheck(p, '.cond-list li,.mission-tip,.mission-card h3,.mission-kicker'), v2 = await overflowCheck(p, '#missionStart,.cond-list li');
      rec(`[${tag}] 브리핑 글자 낙하·버튼 잘림 없음`, o2.length === 0 && v2.length === 0, { o2, v2 });
      await p.screenshot({ path: path.join(SHOTS, `${tag}_L1_briefing.png`) });
      await p.click('#missionStart'); await sleep(150);
      const s0 = await st(p); rec(`[${tag}] L1 시작: 조건 정확히 1개(②) 미충족`, s0.conds.filter(x => !x).length === 1 && s0.conds[1] === false, s0.conds);
      const inside0 = await membersInside(p); rec(`[${tag}] L1 시작: 캐릭터 전신이 화면 안`, inside0.every(m => m.frac >= .97 && m.shown), inside0);
      await p.screenshot({ path: path.join(SHOTS, `${tag}_L1_staging.png`) });
      for (let level = 1; level <= 3; level++) {
        if (level > 1) { await p.click('#nextBtn'); await sleep(150); await p.click('#missionStart'); await sleep(150); }
        const s1 = await st(p); rec(`[${tag}] L${level} 시작 시 조건 1개만 미충족`, s1.conds.filter(x => !x).length === 1, s1.conds);
        await p.screenshot({ path: path.join(SHOTS, `${tag}_L${level}_staging.png`) });
        await satisfy(p, level); await sleep(120);
        const s2 = await st(p); rec(`[${tag}] L${level} 드래그/탭 1~2번으로 조건 2개 충족`, s2.conds.every(Boolean), s2.conds);
        await waitPhase(p, 'chaos', 4000); rec(`[${tag}] L${level} 손을 뗀 뒤 ready→chaos 자동 진입`, true);
        await waitRem(p, level === 3 ? 1.2 : 1.9); await p.screenshot({ path: path.join(SHOTS, `${tag}_L${level}_chaos.png`) });
        await waitRem(p, level === 3 ? 0.55 : 1.0); await shutter(p); await waitResult(p); await sleep(3600);
        const r = await lastRec(p);
        rec(`[${tag}] L${level} 결과 저장(V2 필드)`, r.version === 2 && !!r.rarity && !!r.scoreParts && Array.isArray(r.events) && !!r.title && r.level === level, { rar: r.rarity, ev: r.events, score: r.score, title: r.title });
        await p.screenshot({ path: path.join(SHOTS, `${tag}_L${level}_result.png`) });
        const ok = await p.evaluate(() => { const n = document.querySelector('#nextBtn').getBoundingClientRect(), ph = document.querySelector('#photoBox').getBoundingClientRect(); return { btnIn: n.top >= 0 && n.bottom <= innerHeight + 1, photoFrac: +(ph.height / innerHeight).toFixed(3) } });
        rec(`[${tag}] L${level} 결과: 사진 높이 ≥ 화면 55%`, ok.photoFrac >= .55, ok);
        const o3 = await orphanCheck(p, '.photo-caption,#resultComment,.stamp,.score-row small'); rec(`[${tag}] L${level} 결과: 글자 낙하 없음`, o3.length === 0, o3);
        if (level === 1) rec(`[${tag}] L1 결과: '다음 사진' 버튼이 스크롤 없이 화면 안`, ok.btnIn, ok);
      }
      await p.click('#nextBtn'); await sleep(200);
      const done = await p.evaluate(() => ({ active: document.querySelector('#complete').classList.contains('active'), text: document.querySelector('#complete').innerText }));
      rec(`[${tag}] L3 후 '거실 앨범 완성!' + 다음 앨범 준비 중`, done.active && /거실 앨범 완성/.test(done.text) && /다음 앨범 준비 중/.test(done.text), done.text.slice(0, 40));
      await p.screenshot({ path: path.join(SHOTS, `${tag}_complete.png`) });
      await p.click('#completeAlbum'); await sleep(300);
      const gal = await p.evaluate(() => ({ n: document.querySelectorAll('.gallery-card').length, st: document.querySelectorAll('.album-sticker').length, foot: [...document.querySelectorAll('.gallery-card footer span:first-child')].map(x => x.textContent) }));
      rec(`[${tag}] 앨범: 3장 + 등급 스티커 + 거실 N/3`, gal.n === 3 && gal.st === 3 && gal.foot.every(f => /\/3$/.test(f)), gal);
      await p.screenshot({ path: path.join(SHOTS, `${tag}_album.png`) });
      rec(`[${tag}] 콘솔 오류 0 / 이미지·리소스 오류 0`, p.errs.length === 0 && p.bad.length === 0, { errs: p.errs, bad: p.bad });
    } catch (e) { rec(`[${tag}] 완주 중 예외`, false, String(e).slice(0, 300)); await p.screenshot({ path: path.join(SHOTS, `${tag}_exception.png`) }).catch(() => { }); }
    await p.ctx.close();
  }

  // ===== 2. 드래그 스트레스 (마우스) =====
  {
    const p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await noAuto(p);
    const ids = ['mom', 'dad', 'sis', 'bro'], dirs = { 위: [0, -1], 아래: [0, 1], 대각선: [1, -1] };
    for (const [name, v] of Object.entries(dirs)) {
      let lost = 0, stuck = 0;
      for (let i = 0; i < 20; i++) {
        const id = ids[i % 4], g = await geo(p), c = await center(p, id, .6);
        await p.mouse.move(c[0], c[1]); await p.mouse.down();
        const tx = Math.max(g.l + 5, Math.min(g.l + g.w - 5, c[0] + v[0] * (60 + Math.random() * 120))), ty = c[1] + v[1] * (150 + Math.random() * 400);
        await p.mouse.move(tx, ty, { steps: 3 });                        // 빠른 스와이프
        if (i % 5 === 4) await p.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));   // 포인터 취소
        await p.mouse.up(); await sleep(30);
        if ((await membersInside(p)).some(m => m.frac < .85 || !m.shown)) lost++;
        if (await p.evaluate(() => __game.dragId)) stuck++;               // 드래그가 안 끝나고 남음
      }
      rec(`[드래그 스트레스] ${name}방향 빠른 드래그 20회(포인터 취소 4회 포함): 캐릭터 소실 0건`, lost === 0, { lost });
      rec(`[드래그 스트레스] ${name}방향: 종료/취소 후 드래그 상태 잔류 0건`, stuck === 0, { stuck });
    }
    await p.ctx.close();
  }
  // ===== 2b. 터치 스와이프 (CDP 터치 이벤트, 모바일 에뮬레이션) =====
  {
    const p = await newPage(browser, [412, 915], { hasTouch: true, isMobile: true }); await p.click('#startBtn'); await toStaging(p); await noAuto(p);
    const cdp = await p.ctx.newCDPSession(p); let lost = 0;
    for (let i = 0; i < 20; i++) {
      const id = ['mom', 'dad', 'sis', 'bro'][i % 4], c = await center(p, id, .6), dir = i % 3 === 0 ? [0, -1] : i % 3 === 1 ? [0, 1] : [1, -1];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1] }] });
      for (let k = 1; k <= 4; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.max(20, Math.min(390, c[0] + dir[0] * 25 * k)), y: c[1] + dir[1] * 60 * k }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(40);
      if ((await membersInside(p)).some(m => m.frac < .85 || !m.shown)) lost++;
    }
    const cancels = await p.evaluate(() => window.__cancels);
    rec('[터치] 위/아래/대각선 빠른 스와이프 20회: 캐릭터 소실 0건', lost === 0, { lost });
    rec('[터치] 스와이프 중 브라우저 pointercancel 0회 (touch-action:none 방어 유지)', cancels === 0, { cancels });
    await p.ctx.close();
  }

  // ===== 3. 셔터 순간 스냅샷 = 결과 사진 (좌표·크기·z) =====
  for (const [level, remAt] of [[1, 3.5], [2, 0.3], [3, 0.3]]) {
    const p = await newPage(browser, [390, 844]);
    await p.evaluate(l => localStorage.setItem('familyPhotoV2Level', String(l)), level); await p.reload(); await sleep(200);
    await p.click('#startBtn'); await toStaging(p); await satisfy(p, level); await waitPhase(p, 'chaos', 4000);
    if (remAt < 3) await waitRem(p, remAt); else await sleep(100);
    await sleep(80);
    const live = await p.evaluate(() => { const out = __game.boxes(); document.querySelector('#shutter').click(); return { out } });
    await waitResult(p); await sleep(200);
    const photo = await p.evaluate(() => { const pb = document.querySelector('#photoBox'); pb.style.setProperty('transform', 'none', 'important'); pb.style.setProperty('animation', 'none', 'important'); const sc = document.querySelector('#photoScene').getBoundingClientRect();   /* 액자 회전(-1.2°)을 풀고 측정 */
      return [...document.querySelectorAll('#photoScene img.faithful-image')].filter(i => /\/poses\//.test(i.src)).map(i => { const r = i.getBoundingClientRect(), m = i.src.match(/poses\/(mom|dad|sis|bro)-p(\d)/); return { id: m[1], poseId: m[1] + '-p' + m[2], cx: (r.left + r.width / 2 - sc.left) / sc.width * 100, bottom: (sc.bottom - r.bottom) / sc.height * 100, w: r.width / sc.width * 100, h: r.height / sc.height * 100, z: Number(getComputedStyle(i).zIndex) } }) });
    let maxd = 0, poseOK = true; live.out.forEach(m => { const q = photo.find(x => x.id === m.id); if (q.poseId !== m.poseId) poseOK = false; maxd = Math.max(maxd, Math.abs(q.cx - m.cx), Math.abs(q.bottom - m.bottom), Math.abs(q.w - m.wc), Math.abs(q.h - m.hc)) });
    const zl = live.out.slice().sort((a, b) => a.z - b.z).map(m => m.id).join(), zp = photo.slice().sort((a, b) => a.z - b.z).map(m => m.id).join();
    const rec0 = await lastRec(p), saved = rec0.members.every(m => m.poseId && live.out.find(x => x.id === m.id).poseId === m.poseId);
    rec(`[스냅샷] 레벨${level}: 배치 화면 ↔ 결과 사진 좌표·크기 오차 ≤ 0.5% (최대 ${maxd.toFixed(2)}%)`, maxd <= .5, { maxd });
    rec(`[스냅샷] 레벨${level}: poseId 일치(화면·결과 사진·저장 기록)`, poseOK && saved, { poseOK, saved, poses: live.out.map(m => m.poseId) });
    rec(`[스냅샷] 레벨${level}: 앞뒤(z) 순서 일치`, zl === zp, { zl, zp });
    await p.evaluate(() => openGallery()); await sleep(250);   // 앨범 재렌더링 후에도 동일한지
    const alb = await p.evaluate(() => { const card = document.querySelector('.gallery-card .photo-scene'); return [...card.querySelectorAll('img.faithful-image')].filter(i => /\/poses\//.test(i.src)).map(i => i.src.match(/poses\/((mom|dad|sis|bro)-p\d)/)[1]).sort().join() });
    rec(`[스냅샷] 레벨${level}: 앨범 재렌더링 후에도 같은 포즈 구성`, alb === live.out.map(m => m.poseId).sort().join(), { alb });
    await p.ctx.close();
  }

  // ===== 4. 새로고침 후 진행 레벨·최고점·앨범 유지 + 구버전 기록 호환 =====
  {
    const p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await satisfy(p, 1); await waitPhase(p, 'chaos', 4000); await waitRem(p, 1.0); await shutter(p); await waitResult(p); await sleep(300);
    const best1 = await p.evaluate(() => localStorage.getItem('familyPhotoV2Best')); await p.click('#nextBtn'); await sleep(200); await p.reload(); await sleep(300);
    const after = await p.evaluate(() => ({ lvl: localStorage.getItem('familyPhotoV2Level'), best: localStorage.getItem('familyPhotoV2Best'), n: JSON.parse(localStorage.getItem('familyPhotoGallery') || '[]').length, bestShown: document.querySelector('#best').textContent }));
    await p.click('#startBtn'); await sleep(200); const kicker = await p.evaluate(() => document.querySelector('#missionKicker').textContent);
    rec('[저장] 새로고침 후 진행 레벨(2)·최고점·앨범 유지', after.lvl === '2' && after.best === best1 && Number(best1) > 0 && after.n === 1 && /사진 2\/3/.test(kicker), { after, kicker });
    const keys = await p.evaluate(() => Object.keys(localStorage));
    rec('[저장] V2 전용 키(familyPhotoV2Level/Best) 사용, 임의 구버전 키 혼합 없음', keys.every(k => ['familyPhotoV2Level', 'familyPhotoV2Best', 'familyPhotoGallery', 'familyPhotoDifficulty', 'familyPhotoMuted'].includes(k)), keys);
    await p.evaluate(() => { const old = { score: 1234, caption: '아빠는 또 눈 감음', members: [{ id: 'mom', x: 20, state: '' }, { id: 'dad', x: 40, state: 'sleep', pose: 'assets/dad-action.png' }, { id: 'sis', x: 60, state: '' }, { id: 'bro', x: 80, state: '' }], props: [], effect: 'shake', level: 3, scene: '거실', bg: 'assets/living-room.png', sticker: '🎭 자유 영혼' }; const l = JSON.parse(localStorage.getItem('familyPhotoGallery')); l.push(old); localStorage.setItem('familyPhotoGallery', JSON.stringify(l)) });
    await p.reload(); await sleep(200); await p.click('#titleAlbum'); await sleep(200);
    const gal = await p.evaluate(() => [...document.querySelectorAll('.gallery-card footer span:first-child')].map(x => x.textContent));
    rec('[저장] 구버전(V1) 기록도 오류 없이 렌더링(거실 3/9 표기)', gal.length === 2 && /3\/9/.test(gal[1]) && p.errs.length === 0, { gal, errs: p.errs });
    await p.ctx.close();
  }

  // ===== 5. 자동 시작 / 자동 촬영 / 조건 1개 즉시 촬영 / 드래그 중 ready 차단 =====
  {
    let p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p);
    const t0 = Date.now(); await waitPhase(p, 'chaos', 17000); const dt = (Date.now() - t0) / 1000;
    const toastTxt = await p.evaluate(() => document.querySelector('#toast').textContent);
    rec('[자동] staging 15초 후 chaos 자동 시작 + 안내 토스트', dt > 14.3 && dt < 16.5 && /지루/.test(toastTxt), { dt, toastTxt });
    const t1 = Date.now(); await waitResult(p); const d2 = (Date.now() - t1) / 1000; await sleep(200);
    const r = await lastRec(p); rec('[자동] 0초 자동 촬영(약 3초 뒤) → 결과 저장', d2 > 2.6 && d2 < 3.9 && r.remaining <= .05, { d2, rem: r.remaining });
    await p.ctx.close();
    p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await shutter(p); await waitResult(p); await sleep(200);
    const r1 = await lastRec(p); rec('[즉시 촬영] 조건 1개 충족 상태 촬영: 사고 없음·평범·구도 절반·미준비 문구', r1.events.length === 0 && r1.rarity === 'normal' && r1.compRate === .5 && /준비 안|어색|흐트러진/.test(r1.title), { ev: r1.events, rar: r1.rarity, comp: r1.compRate, title: r1.title });
    await p.ctx.close();
    p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p);
    const c = await p.evaluate(() => { const r = document.querySelector('.family-member[data-id="bro"] .char-img').getBoundingClientRect(), s = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .6, tx: s.left + .82 * s.width, ty: s.bottom - .02 * s.height } });
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.tx, c.ty, { steps: 8 }); await sleep(1200);
    const held = await st(p); rec('[ready] 손가락을 누른 채(드래그 중)에는 조건 충족해도 ready 진입 안 함', held.phase === 'staging' && held.conds.every(Boolean), held);
    await p.mouse.up(); await sleep(120); const early = await st(p); await sleep(450); const later = await st(p);
    rec('[ready] 손을 뗀 뒤 0.3초 유지 후에야 ready', early.phase === 'staging' && (later.phase === 'ready' || later.phase === 'chaos'), { early: early.phase, later: later.phase });
    await p.ctx.close();
  }

  // ===== 6. 사고 중 드래그 규칙 =====
  {
    let p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await satisfy(p, 1); await waitPhase(p, 'chaos', 4000);
    await waitRem(p, 2.05);                         // 아빠 사고(2.2s) 직후
    const pt = await p.evaluate(() => { const r = document.querySelector('.family-member[data-id="dad"] .char-img').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * .6, document.querySelector('.family-member[data-id="dad"]').dataset.locked] });
    await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0] - 40, pt[1] - 40, { steps: 4 }); const lockedDrag = await p.evaluate(() => ({ id: __game.dragId, dragging: document.querySelector('.family-member[data-id="dad"]').classList.contains('dragging') })); await p.mouse.up();
    rec('[사고 중 드래그] 사고를 치는 아빠는 사고 직후 잡을 수 없음', pt[2] === '1' && !lockedDrag.dragging && lockedDrag.id !== 'dad', { locked: pt[2], lockedDrag });
    const m0 = await leftOf(p, 'sis'); await dragTo(p, 'sis', 62 + 12, 12); await sleep(60); const m1 = await leftOf(p, 'sis');
    rec('[사고 중 드래그] 다른 가족(누나)은 사고 타임 중에도 드래그 가능', Math.abs(m1 - m0) > 4, { m0, m1 });
    await waitRem(p, 1.0); await sleep(100); const free = await p.evaluate(() => !document.querySelector('.family-member[data-id="dad"]').dataset.locked);
    rec('[사고 중 드래그] 사고 후 약 0.8초가 지나면 아빠도 다시 잡을 수 있음', free);
    await p.ctx.close();
    // 드래그 중인 대상의 사고는 0.4초 미뤄지고, 다시 드래그 중이면 강제 해제 후 실행 (결정적 발생)
    p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await satisfy(p, 1); await waitPhase(p, 'chaos', 4000); await waitRem(p, 2.6);
    const dp = await center(p, 'dad', .6);
    await p.mouse.move(dp[0], dp[1]); await p.mouse.down(); await p.mouse.move(dp[0] + 30, dp[1] + 30, { steps: 4 });
    await waitRem(p, 2.15); await sleep(50); const mid = await p.evaluate(() => ({ fired: __game.S.fired.map(f => f.ev.id), pend: __game.S.pending.map(e => e.id + '@' + e.at.toFixed(2)), dragId: __game.dragId }));
    await waitRem(p, 1.7); await sleep(60); const fin = await p.evaluate(() => ({ fired: __game.S.fired.map(f => ({ id: f.ev.id, at: +f.firedAt.toFixed(2) })), dragId: __game.dragId, accident: document.querySelector('.family-member[data-id="dad"]').dataset.accident }));
    await p.mouse.up();
    rec('[사고 중 드래그] 드래그 중인 대상의 사고는 대상을 바꾸지 않고 0.4초 미룸', !mid.fired.includes('dadEyes') && mid.pend.some(x => /dadEyes/.test(x)) && mid.dragId === 'dad', mid);
    rec('[사고 중 드래그] 미룬 뒤에도 드래그 중이면 강제 해제 후 사고 실행(결정적)', fin.fired.some(f => f.id === 'dadEyes' && f.at <= 1.85) && fin.accident === 'dadEyes' && fin.dragId !== 'dad', fin);
    await p.ctx.close();
  }

  // ===== 7. 탭: 연출 포즈 순환 / 탭 vs 드래그 (레벨 1~3 공통) =====
  {
    const p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await noAuto(p);
    const c = await center(p, 'bro', .6);
    const info = () => p.evaluate(() => { const m = document.querySelector('.family-member[data-id="bro"]'); return { pid: m.dataset.poseId, role: m.dataset.role, left: parseFloat(m.style.left), bottom: parseFloat(m.style.bottom), gag: m.dataset.gag || '' } });
    const a0 = await info(); await p.mouse.click(c[0], c[1]); await sleep(80); const a1 = await info();
    rec('[탭] 1회: base → wave(손인사) + 라벨, 위치 변화 없음', a0.pid === 'bro-p6' && a1.pid === 'bro-p5' && a1.role === 'wave' && /손인사/.test(a1.gag) && Math.abs(a1.left - a0.left) < .01 && Math.abs(a1.bottom - a0.bottom) < .01, { a0, a1 });
    await p.mouse.click(c[0], c[1]); await sleep(80); const a2 = await info(); rec('[탭] 2회: wave → special(메롱)', a2.pid === 'bro-p3' && a2.role === 'special' && /메롱/.test(a2.gag), a2);
    await p.mouse.click(c[0], c[1]); await sleep(80); const a3 = await info(); rec('[탭] 3회: 원래 포즈(base)로 복귀', a3.pid === a0.pid && a3.role === 'base', a3);
    await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 4, c[1] + 3); await p.mouse.up(); await sleep(80); const a4 = await info();
    rec('[탭] 6px 미만 이동 + 빠른 release 도 탭(위치 유지)', a4.role === 'wave' && Math.abs(a4.left - a0.left) < .01, a4);
    await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 30, c[1] - 30, { steps: 4 }); await p.mouse.up(); await sleep(80); const a5 = await info();
    rec('[탭] 6px 이상 이동 → 드래그(포즈 순환 안 됨, 위치 이동)', a5.role === a4.role && Math.abs(a5.left - a0.left) > 3, { a4, a5 });
    const c2 = await center(p, 'bro', .6); await p.mouse.move(c2[0], c2[1]); await p.mouse.down(); await sleep(400); await p.mouse.up(); await sleep(80); const a6 = await info();
    rec('[탭] 250ms 이상 누르면 탭이 아님', a6.role === a5.role, a6);
    await p.evaluate(() => { const m = el('dad'); m.dataset.accident = 'test'; setPose(m, 'dad-p4', false) }); const dc = await center(p, 'dad', .5); await p.mouse.click(dc[0], dc[1]); await sleep(80);
    rec('[탭] 사고 중인 인물(accident)은 탭 무시', (await p.evaluate(() => el('dad').dataset.poseId)) === 'dad-p4');
    await p.ctx.close();
    const q = await newPage(browser, [390, 844]); await q.evaluate(() => localStorage.setItem('familyPhotoV2Level', '3')); await q.reload(); await sleep(200); await q.click('#startBtn'); await toStaging(q); await noAuto(q);
    const sc = await center(q, 'sis', .5); await q.mouse.click(sc[0], sc[1]); await sleep(120); const w = await st(q);
    const sc2 = await center(q, 'sis', .5); await q.mouse.click(sc2[0], sc2[1]); await sleep(120); const sp = await st(q);
    rec('[L3] 특수 자세 조건: wave 는 불충족, special(두 번 탭)에서 충족', w.conds[1] === false && sp.conds[1] === true, { w: w.conds, sp: sp.conds });
    await q.ctx.close();
  }

  // ===== 7b. 24포즈 × 드래그 경계 (눈에 보이는 영역이 stage 밖으로 안 나감) + 프리로드 =====
  {
    const p = await newPage(browser, [390, 844]); await p.click('#startBtn'); await toStaging(p); await noAuto(p);
    const pre = await p.evaluate(async () => (await __game.preloaded)); rec('[포즈] 24장+고양이+배경 프리로드·decode 성공(실패 0)', pre === undefined ? false : true);
    const ids = ['mom', 'dad', 'sis', 'bro']; const bad = []; let n = 0;
    for (const id of ids) for (let k = 1; k <= 6; k++) {
      await p.evaluate(({ id, k }) => { const m = el(id); delete m.dataset.accident; setPose(m, `${id}-p${k}`, false) }, { id, k }); await sleep(20);
      for (const [fx, fy] of [[-5, 0], [105, 0], [50, 100], [50, -5], [-5, 100], [105, 100]]) {
        const g = await geo(p), c = await center(p, id, .5);
        await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(g.l + fx / 100 * g.w, g.b - (100 - fy) / 100 * g.h, { steps: 4 }); await p.mouse.up();
        const r = await p.evaluate(id => { const s = document.querySelector('#stage').getBoundingClientRect(), h = document.querySelector(`.family-member[data-id="${id}"] .hit`).getBoundingClientRect(); return { l: h.left - s.left, r: s.right - h.right, t: h.top - s.top, b: s.bottom - h.bottom } }, id); n++;
        if (r.l < -1.5 || r.r < -1.5 || r.t < -1.5 || r.b < -1.5) bad.push({ pose: `${id}-p${k}`, fx, fy, r });
      }
      await p.evaluate(id => { const m = el(id); placeInstant(m, 50, 20); resetPose(m) }, id);
    }
    rec(`[경계] 24포즈 × 6방향 드래그(${n}회): 눈에 보이는 영역이 화면 밖으로 안 나감`, bad.length === 0, bad.slice(0, 3));
    rec('[경계] 포즈 교체 후에도 캐릭터 소실 0건(표시·불투명)', (await membersInside(p)).every(m => m.shown));
    await p.ctx.close();
  }

  // ===== 8. 셔터 타이밍별 실제 결과(브라우저) =====
  const table = [];
  for (let level = 1; level <= 3; level++) {
    for (const when of ['사고 전(ready)', '약 2.0초', '약 1.0초', '0초 자동']) {
      const p = await newPage(browser, [390, 844]); await p.evaluate(l => localStorage.setItem('familyPhotoV2Level', String(l)), level); await p.reload(); await sleep(200);
      await p.click('#startBtn'); await toStaging(p); await satisfy(p, level); await waitPhase(p, 'chaos', 4000).catch(() => { });
      if (when.startsWith('사고 전')) await shutter(p); else if (when.includes('2.0')) { await waitRem(p, 2.0); await shutter(p) } else if (when.includes('1.0')) { await waitRem(p, 1.0); await shutter(p) }
      await waitResult(p); await sleep(150); const r = await lastRec(p); table.push({ level, when, rem: r.remaining, comp: r.scoreParts.comp, moment: r.scoreParts.moment, chaos: r.scoreParts.chaos, total: r.score, rarity: r.rarity, ev: r.events.join('+'), title: r.title }); await p.ctx.close();
    }
  }
  console.log('\n[브라우저 실측: 셔터 시점별 결과]'); console.table(table);
  fs.writeFileSync(path.join(SHOTS, 'timing_table.json'), JSON.stringify(table, null, 1));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  fs.writeFileSync(path.join(SHOTS, 'e2e_results.json'), JSON.stringify(results, null, 1));
  console.log(`\n자동 검증: ${results.length - failed.length} 통과 / ${failed.length} 실패 (스크린샷: ${SHOTS})`);
  failed.forEach(f => console.log(' - FAIL', f.name, f.detail));
  process.exit(failed.length ? 1 : 0);
})();
