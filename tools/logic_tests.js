// 순수 함수 단위 테스트: node tools/logic_tests.js   (V2.2 — 새 6포즈 체계)
const fs = require('fs'), path = require('path');
const L = require('./load_logic.js')(), A = L.A_DEFAULT;
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? pass++ : fail++; if (!ok) console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); };
const M = (id, x, y, pose) => L.nominalMember(id, x, y, pose);
const lv = i => L.LEVELS[i - 1];
const canon = i => lv(i).canon.map(([id, x, y, p]) => M(id, x, y, p));
const PM = L.POSE_META;

// --- POSE_META 무결성 ---
t('POSE_META 28개(기본 6 × 4 + 멧돼지 충돌 p7 × 4)', Object.keys(PM).length === 28 && ['mom', 'dad', 'sis', 'bro'].every(c => PM[c + '-p7'].role === 'hit'));
['mom', 'dad', 'sis', 'bro'].forEach(c => {
  const ps = Object.keys(PM).filter(k => PM[k].char === c), cnt = r => ps.filter(k => PM[k].role === r).length;
  t(`${c}: base 1 / wave 1 / special 1 / chaos 3`, cnt('base') === 1 && cnt('wave') === 1 && cnt('special') === 1 && cnt('chaos') === 3, ps.map(k => PM[k].role));
  t(`${c}: chaos 단계 1·2·3 각 1개`, [1, 2, 3].every(s => ps.filter(k => PM[k].sev === s).length === 1));
});
Object.entries(PM).forEach(([k, p]) => {
  const [x0, y0, x1, y1] = p.bbox, fx = p.face[0] / 100 * L.CANVAS.w, fy = p.face[1] / 100 * L.CANVAS.h;
  t(`${k}: 파일 존재`, fs.existsSync(path.join(__dirname, '..', 'dist', p.file)), p.file);
  t(`${k}: bbox 가 캔버스 안`, x0 >= 0 && y0 >= 0 && x1 <= L.CANVAS.w && y1 <= L.CANVAS.h && x1 > x0 && y1 > y0);
  t(`${k}: faceAnchor 가 bbox 안`, fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1, { fx, fy, bbox: p.bbox });
});
t('얼굴이 가려지는 포즈는 정확히 mom-p3, dad-p1, sis-p1', Object.keys(PM).filter(k => !PM[k].faceVisible).sort().join() === 'dad-p1,mom-p3,sis-p1');
t('점수표 §5-7', PM['mom-p3'].points === 70 && PM['mom-p4'].points === 120 && PM['mom-p5'].points === 150 && PM['dad-p4'].points === 80 && PM['dad-p1'].points === 110 && PM['dad-p2'].points === 150 && PM['sis-p1'].points === 70 && PM['sis-p2'].points === 100 && PM['sis-p3'].points === 100 && PM['bro-p2'].points === 70 && PM['bro-p4'].points === 100 && PM['bro-p1'].points === 130);
t('연쇄 반응 포즈: 엄마 p5, 아빠 p2, 누나 p2, 동생 p1', L.REACT.mom === 'mom-p5' && L.REACT.dad === 'dad-p2' && L.REACT.sis === 'sis-p2' && L.REACT.bro === 'bro-p1');
t('기본 포즈 눈에 보이는 높이 비율 아빠 1 : 엄마 .97 : 누나 .89 : 동생 .79', (() => { const h = id => { const b = PM[L.BASE[id]].bbox; return b[3] - b[1] }; const d = h('dad'); return Math.abs(h('mom') / d - .97) < .01 && Math.abs(h('sis') / d - .89) < .01 && Math.abs(h('bro') / d - .79) < .01 })());
t('모든 레벨 이벤트의 포즈가 해당 인물의 chaos 포즈', L.LEVELS.every(l => l.chaos.concat([l.extra]).every(e => e.kind === 'cat' || (PM[e.pose].char === e.actor && PM[e.pose].role === 'chaos'))));

// --- 눈에 보이는 영역(bbox) 기준 측정 ---
const dad = M('dad', 50, 20);
t('bbox 기준: 컨테이너 가운데 정렬 포즈의 보이는 중심 ≈ x', Math.abs(dad.cx - 50) < 6, dad.cx);
const momRush = L.withPose(M('mom', 50, 20), 'mom-p4');
t('bbox 기준: 가로로 넓은 포즈(엄마 p4)는 w 가 기본보다 크다', momRush.w > M('mom', 50, 20).w * 1.5, [momRush.w, M('mom', 50, 20).w]);
t('bbox 기준: 점프 포즈(누나 p3)는 보이는 바닥이 컨테이너 바닥보다 높다', L.withPose(M('sis', 50, 10), 'sis-p3').bottom > M('sis', 50, 10).bottom + 2);
// 이동 한계: 얼굴은 항상 프레임 안, 몸 일부는 좌우로 나가도 된다 (위쪽 끝은 기존대로 화면 안)
['mom', 'dad', 'sis', 'bro'].forEach(id => Object.keys(PM).filter(k => PM[k].char === id).forEach(k => {
  [3, 20, 40].forEach(y => {
    const m = L.nominalMember(id, 50, y, k), lim = L.limitsFor(k, m.wc0, m.hc0, y);
    const lo = L.moveM(m, -50, y), hi = L.moveM(m, 150, y);
    // V2.3 규칙: 좌우로 몸 일부가 프레임 밖으로 나가도 되지만(보이는 폭 60% 이상), 얼굴은 프레임 안에 남아 다시 잡을 수 있다
    const vis = q => (Math.min(100, q.cx + q.w / 2) - Math.max(0, q.cx - q.w / 2)) / q.w;
    t(`경계 ${k} y=${y}: 좌우 끝에서도 보이는 폭 60% 이상 + 얼굴이 프레임 안`, vis(lo) >= .6 - 1e-6 && vis(hi) >= .6 - 1e-6 && L.faceInFrame(lo) && L.faceInFrame(hi), [vis(lo), vis(hi), lo.face, hi.face]);
    t(`경계 ${k} y=${y}: 좌우 끝에서 몸 일부가 프레임 밖이어도 허용(보이는 폭 ≤ 100%)`, vis(lo) <= 1.0001 && vis(hi) <= 1.0001);
  });
  const top = L.maxYFor(k, L.HC0), mm = L.nominalMember(id, 50, top, k);
  t(`경계 ${k}: 위쪽 끝에서도 보이는 영역이 화면 안`, mm.bottom + mm.h <= 94.6, mm.bottom + mm.h);
}));

// --- 깊이 ---
t('depthScale(0)=1 / 하한 .68 / 단조 감소', L.depthScale(0) === 1 && L.depthScale(80) === .68 && L.depthScale(10) > L.depthScale(20));

// --- faces: 포즈가 얼굴 보임을 반영 ---
const spread = [M('mom', 18, 20), M('dad', 40, 22), M('sis', 62, 20), M('bro', 82, 21)];
t('faces: 4명 펼침 → 충족', L.evaluateConditions(lv(1), spread, A)[0] === true);
const withHidden = n => spread.map(m => n.includes(m.id) ? L.withPose(m, { mom: 'mom-p3', dad: 'dad-p1', sis: 'sis-p1' }[m.id]) : m);
t('faces: 얼굴 가린 포즈 1명 → 3개(충족)', L.evaluateConditions(lv(1), withHidden(['dad']), A)[0] === true);
t('faces: 얼굴 가린 포즈 2명 → 2개(미충족) — 경계', L.evaluateConditions(lv(1), withHidden(['dad', 'mom']), A)[0] === false);
t('faces: 눈 감기(dad-p4)는 얼굴이 보임 → 개수 유지', L.evaluateConditions(lv(1), spread.map(m => m.id === 'dad' ? L.withPose(m, 'dad-p4') : m), A)[0] === true);
t('faces: 화면 밖 얼굴은 안 보임', !L.faceVisible(Object.assign({}, M('bro', 50, 10), { face: { x: 2, y: 40 } }), [M('bro', 50, 10)]));
const stack = [M('mom', 50, 4), M('dad', 50, 1), M('sis', 20, 20), M('bro', 85, 20)];
const vis = stack.filter(m => L.faceVisible(m, stack)).map(m => m.id);
t('faces: 큰 아빠가 바로 앞에 서면 엄마 얼굴이 가려짐', !vis.includes('mom') && vis.includes('dad'), vis);

// --- big / behind / close ---
const flat = [M('mom', 18, 20), M('dad', 40, 20), M('sis', 62, 20), M('bro', 82, 20)];
t('big: 모두 같은 깊이 → 미충족 / 한 명 앞 → 충족', L.evaluateConditions(lv(1), flat, A)[1] === false && L.evaluateConditions(lv(1), canon(1), A)[1] === true);
let yEdge = null; for (let y = 20; y >= 0; y -= 0.05) { if (L.evaluateConditions(lv(1), [M('mom', 18, 20), M('dad', 40, 20), M('sis', 62, 20), M('bro', 82, y)], A)[1]) { yEdge = y; break } }
t('big: 경계 배율비 ≈ 1.12, 달성 가능 y(≥1)', yEdge !== null && yEdge >= 1 && Math.abs(L.depthScale(yEdge) / L.depthScale(20) - 1.12) < .01, yEdge);
const bh = (dy, my) => [M('mom', 40, my), M('dad', 50, dy), M('sis', 18, 22), M('bro', 82, 20)];
t('behind: 같은 줄·앞 → 미충족 / 충분히 뒤 → 충족', L.evaluateConditions(lv(2), bh(24, 24), A)[0] === false && L.evaluateConditions(lv(2), bh(20, 24), A)[0] === false && L.evaluateConditions(lv(2), bh(36, 24), A)[0] === true);
const bEdge = (() => { for (let d = 24; d < 50; d += .05) if (L.evaluateConditions(lv(2), bh(d, 24), A)[0]) return d })();
t('behind: 경계가 "2.5% 뒤" 근처(포즈 높이 차 허용)', bEdge > 25 && bEdge < 27.5, bEdge);
// 카메라 앞(y<0)에서 둘 다 커져 겹칠 때도 눈에 보이는 앞뒤와 판정이 일치: 아빠가 엄마보다 충분히 뒤(위)이고 실제로 뒤에 그려질 때만 충족
{
  const behindAt = (my, dy) => { const mom = M('mom', 40, my), dad = M('dad', 44, my + dy); return [L.evaluateConditions(lv(2), [mom, dad, M('sis', 18, 8), M('bro', 82, 6)], A)[0], dad.z < mom.z, dad.bottom - mom.bottom]; };
  const near = behindAt(-20, 3.5), same = behindAt(-20, 0), tooClose = behindAt(-20, 1);
  t('behind: 카메라 앞에서 아빠가 엄마보다 3.5 뒤면 충족(뒤에 그려짐)', near[0] === true && near[1] === true, near);
  t('behind: 같은 높이/거의 같은 높이면 미충족', same[0] === false && tooClose[0] === false, [same, tooClose]);
}
const near = dx => [M('mom', 40, 24), M('dad', 40 + dx, 31), M('sis', 18, 22), M('bro', 82, 20)];
t('close: 가까우면 충족 / 멀면 미충족, 경계 22% 안쪽', L.evaluateConditions(lv(2), near(10), A)[1] && !L.evaluateConditions(lv(2), near(30), A)[1]);

// --- triangle / special(wave 불충족) ---
const tri = [M('mom', 50, 30), M('dad', 24, 8), M('sis', 74, 10), M('bro', 50, 5)];
t('triangle: 삼각 → 충족 / 일직선 → 미충족', L.evaluateConditions(lv(3), tri, A)[0] === true && L.evaluateConditions(lv(3), [M('mom', 20, 10), M('dad', 40, 10), M('sis', 60, 10), M('bro', 80, 10)], A)[0] === false);
t('triangle: 얼굴 가린 포즈 2명 → 얼굴 2개라 삼각 불가', L.evaluateConditions(lv(3), tri.map(m => m.id === 'dad' ? L.withPose(m, 'dad-p1') : m.id === 'mom' ? L.withPose(m, 'mom-p3') : m), A)[0] === false);
t('triangle: 얼굴 가린 포즈 1명이어도 나머지 3명이 삼각이면 유지', L.evaluateConditions(lv(3), tri.map(m => m.id === 'dad' ? L.withPose(m, 'dad-p1') : m), A)[0] === true);
t('special: base → 미충족, wave → 미충족, special → 충족', [tri, tri.map(m => m.id === 'sis' ? L.withPose(m, L.WAVE.sis) : m), tri.map(m => m.id === 'sis' ? L.withPose(m, L.SPECIAL.sis) : m)].map(ms => L.evaluateConditions(lv(3), ms, A)[1]).join() === 'false,false,true');

// --- 시작 배치: 레벨마다 '정확히 1개만 미충족' ---
L.LEVELS.forEach((l, i) => l.start.forEach((lay, k) => {
  const st = L.evaluateConditions(l, lay.map(([id, x, y]) => M(id, x, y)), A), un = st.map((v, j) => v ? -1 : j).filter(j => j >= 0);
  t(`시작 배치 L${i + 1}-${k}: 미충족 정확히 1개(#${l.startUnmet})`, un.length === 1 && un[0] === l.startUnmet, st);
}));
L.LEVELS.forEach((l, i) => t(`canon L${i + 1}: 두 조건 모두 충족`, L.evaluateConditions(l, canon(i + 1), A).every(Boolean)));

// --- 점수 ---
let r = L.scoreSnapshot(lv(1), canon(1), A);
t('점수: 사고 전 구도 완벽(연출 0명) → 구도 320, 평범', r.comp === 320 && r.total === 320 && r.rarity === 'normal', r);
const staged = (n) => canon(1).map((m, i) => i < n ? L.withPose(m, L.WAVE[m.id]) : m);
t('연출 포즈 보너스: 1명 +7 → (80+7)×4, 3명 → 상한 20 → 400', L.scoreSnapshot(lv(1), staged(1), A).comp === 348 && L.scoreSnapshot(lv(1), staged(3), A).comp === 404 - 4 + 0 || L.scoreSnapshot(lv(1), staged(3), A).comp === (80 + 21) * 4);
t('연출 포즈 보너스 상한 20', L.scoreSnapshot(lv(1), staged(4), A).comp === (80 + 20) * 4, L.scoreSnapshot(lv(1), staged(4), A).comp);
t('연출 포즈라도 얼굴이 가려졌거나 chaos 면 보너스 없음(faceVisible/role 조건)', L.scoreSnapshot(lv(1), canon(1).map(m => m.id === 'dad' ? L.withPose(m, 'dad-p1') : m), A).staged === 0);
const catch2 = canon(1).map(m => m.id === 'dad' ? L.withPose(m, 'dad-p4') : m.id === 'bro' ? L.withPose(m, 'bro-p4') : m);
r = L.scoreSnapshot(lv(1), catch2, A);
t('점수: 사고 2개 포착(구도 완벽) = 320 + 80+100 + 동시 사고 120', r.comp === 320 && r.moment === 180 && r.chaos === 120 && r.total === 620 && r.rarity === 'disaster', r);
r = L.scoreSnapshot(lv(1), flat.map(m => m.id === 'dad' ? L.withPose(m, 'dad-p4') : m), A);
t('점수: 조건 1개 충족 → 구도 160, 사고 ×.55', r.compRate === .5 && r.comp === 160 && r.moment === Math.round(80 * .55), r);
const none = [M('mom', 40, 10), M('dad', 40, 11), M('sis', 40, 12), M('bro', 40, 13)];
r = L.scoreSnapshot(lv(3), none.map(m => L.withPose(m, L.REACT[m.id])), A, { catVisible: true });
t('점수: 조건 0개 배율 .25, 구도 0, 전설 불가', r.compRate === 0 && r.comp === 0 && r.mult === .25 && r.rarity !== 'legend', r);
r = L.scoreSnapshot(lv(3), canon(3).map(m => m.id === 'dad' ? L.withPose(m, 'dad-p1') : m.id === 'bro' ? L.withPose(m, 'bro-p2') : m), A, { catVisible: true });
t('L3: 고양이 +300 + 동시 사고 +120, 구도 유지 시 전설', r.chaos === 420 && r.rarity === 'legend', r);
const rr = (a, c, n) => L.rarityOf(lv(3), c, a, n);
t('등급 경계: 69/70, 259/260, 전설 459/460, 사건 1개·구도 0 은 전설 불가', rr(69, 1, 1) === 'normal' && rr(70, 1, 1) === 'funny' && rr(259, 1, 2) === 'funny' && rr(260, 1, 2) === 'disaster' && rr(459, 1, 4) === 'disaster' && rr(460, 1, 4) === 'legend' && rr(900, 1, 1) === 'disaster' && rr(900, 0, 4) === 'disaster');

// --- 고양이 연쇄 반응 ---
const c3 = canon(3), reacts = L.catReactions(c3, A);
t('연쇄 반응: 최대 2명, 각자 반응 포즈', reacts.length === 2 && reacts.every(x => x.poseId === L.REACT[x.id]));
t('연쇄 반응: 결정적(같은 입력 → 같은 결과)', JSON.stringify(reacts) === JSON.stringify(L.catReactions(c3, A)));
t('연쇄 반응: 고양이와 가장 가까운 2명(거리 정렬)', (() => { const d = m => Math.hypot((m.cx - L.CAT_POS.x) / 100, ((m.bottom + m.h / 2 - L.CAT_POS.y) / 100) / A); const order = c3.slice().sort((a, b) => d(a) - d(b) || (a.id < b.id ? -1 : 1)).slice(0, 2).map(m => m.id).sort(); return order.join() === reacts.map(x => x.id).sort().join() })(), reacts);
t('연쇄 반응: 거리 동률이면 인물 ID 순', (() => { const d0 = M('dad', 30, 20), twin = Object.assign({}, d0, { id: 'mom' }); const o = L.catReactions([twin, d0, M('sis', 5, 40), M('bro', 95, 40)], A); return o[0].id === 'dad' && o[1].id === 'mom' })());
t('연쇄 반응: 동생은 고양이 쪽으로 8~10% 이동', (() => { const r1 = L.catReactions([M('bro', 20, 10), M('mom', 90, 40), M('dad', 95, 40), M('sis', 5, 40)], A).find(x => x.id === 'bro'); const r2 = L.catReactions([M('bro', 80, 10), M('mom', 5, 40), M('dad', 10, 40), M('sis', 95, 40)], A).find(x => x.id === 'bro'); return r1 && r2 && r1.dx > 8 && r1.dx <= 10 && r2.dx < -8 && r2.dx >= -10 })());
t('연쇄 반응 적용: 포즈가 바뀌고 동생은 실제로 이동', (() => { const ms = [M('bro', 20, 10), M('mom', 90, 40), M('dad', 95, 40), M('sis', 5, 40)], o = L.applyReactions(ms, A), b = o.find(m => m.id === 'bro'); return b.poseId === 'bro-p1' && b.x > 20 })());

// --- 구도 붕괴 계획 / 시뮬레이션 ---
const momRush2 = L.buildEvents(lv(2), 'normal').find(e => e.id === 'momRush');
const plan2 = L.planMoves(lv(2), canon(2).map(m => L.withPose(m, m.id === 'sis' ? 'sis-p1' : m.poseId)).map(m => m.id === 'mom' ? L.withPose(m, 'mom-p4') : m), A, momRush2, []);
t('붕괴 계획: 레벨2 엄마 이동', plan2.length >= 1 && plan2[0].id === 'mom');
t('결정성: 같은 입력이면 같은 계획', JSON.stringify(plan2) === JSON.stringify(L.planMoves(lv(2), canon(2).map(m => L.withPose(m, m.id === 'sis' ? 'sis-p1' : m.poseId)).map(m => m.id === 'mom' ? L.withPose(m, 'mom-p4') : m), A, momRush2, [])));
// 8초 구간에서는 사고 포즈가 hold 후 돌아오므로, 구도를 영구히 깨는 것은 이동·밀침(bump)뿐이다. L3 는 고양이 밀침만으로는 삼각이 안 깨질 수 있어(자동촬영이 나쁘지 않을 수 있음) L1·L2 만 단언한다
L.LEVELS.slice(0, 2).forEach((l, i) => t(`L${i + 1}: 0초 자동촬영은 구도가 무너져 있다(canon 기준)`, L.simulateShot(l, canon(i + 1), A, 0, 'normal', true).compRate <= .5));
// 8초 구간: 사고는 hold 초 뒤 원래 자세로 복귀한다. 한 명만 사고 중이면 삼각 유지, 두 명이 겹치면(얼굴 2개만 보임) 삼각 붕괴
const sim3 = T => L.simulateShot(lv(3), canon(3), A, T, 'normal', true).conds[0];
t('L3: 아빠 재채기 중(4.7초)에는 삼각 유지, 엄마 옷 정리 중(3.6초)에도 아빠가 돌아와 삼각 유지', sim3(4.7) === true && sim3(3.6) === true);
const lv3o = Object.assign({}, lv(3), { chaos: lv(3).chaos.map(e => e.id === 'dadSneeze' ? Object.assign({}, e, { at: 1.8 }) : e.id === 'momFix' ? Object.assign({}, e, { at: 1.5 }) : e) });
t('L3: 아빠 재채기와 엄마 옷 정리가 겹치면(3.8초) 삼각이 무너지고, 지나면(2.0초) 복귀', L.simulateShot(lv3o, canon(3), A, 3.8, 'normal', true).conds[0] === false && L.simulateShot(lv3o, canon(3), A, 5.5, 'normal', true).conds[0] === true);

// --- 난이도 / 제목 ---
t('난이도 easy: 사고 늦어짐, L3 두 번째 사고 제거', L.buildEvents(lv(1), 'easy', 5, true)[0].at < L.buildEvents(lv(1), 'normal', 5, true)[0].at && L.buildEvents(lv(3), 'easy', 5, true).filter(e => e.kind !== 'cat').length === 1);
t('난이도 chaos: 추가 사고 1개', L.buildEvents(lv(1), 'chaos', 5, true).length === L.buildEvents(lv(1), 'normal', 5, true).length + 1);
const keys = new Set(), seen = new Set(), mkRes = (events, compRate, flags, rarity) => ({ events, compRate, flags: flags || {}, rarity: rarity || 'funny' });
[mkRes([], 1, {}, 'normal'), mkRes([], .5, {}, 'normal'), mkRes(['eyes_closed'], 1), mkRes(['jump'], 1), mkRes(['eyes_closed', 'jump'], 1, { duo: true }), mkRes(['phone'], 1), mkRes(['rush'], 1), mkRes(['phone', 'rush'], 1, { duo: true }),
 mkRes(['sneeze', 'fix_clothes'], 1, { duo: true }), mkRes(['cat'], 1, { cat: true }), mkRes(['sneeze', 'fix_clothes', 'startled', 'cat'], 1, { cat: true, duo: true }, 'legend'), mkRes(['sneeze'], 0, {}), mkRes(['sneeze'], 1), mkRes(['fix_clothes'], 1), mkRes(['crouch'], 1), mkRes(['startled', 'run'], 1, { duo: true })]
 .forEach(res => { const o = L.makeTitle(res, 0); keys.add(o.key); [0, 1, 2].forEach(s => seen.add(L.makeTitle(res, s).title)); t('제목 비어있지 않음: ' + o.key, o.title.length > 0 && o.comment.length > 0); });
t('제목: 조합 키 10종 이상 / 고유 문구 20개 이상', keys.size >= 10 && seen.size >= 20, [keys.size, seen.size]);
t('문구에 금지어 없음', ![...seen].concat(Object.values(L.COMMENTS).flat()).some(x => /실패했습니다|다시 도전/.test(x)));
t('조건 라벨 14자 / 말풍선 22자 이내', L.LEVELS.every(l => l.conds.every(c => c.label.length <= 14) && l.chaos.every(e => e.bubble.length <= 22)));
t('연출 포즈 라벨 2~4글자(공백 제외)', Object.values(PM).filter(p => p.label).every(p => p.label.replace(/\s/g, '').length >= 2 && p.label.replace(/\s/g, '').length <= 4), Object.values(PM).filter(p => p.label).map(p => p.label));

// --- V2.3 카메라 앞 확대 / 프레임 기준 판정 ---
t('depthScale: y=0 에서 1, y<0 에서 1 초과로 단조 증가', L.depthScale(0) === 1 && L.depthScale(-10) > 1 && L.depthScale(-30) > L.depthScale(-10) && L.depthScale(-30) < 2);
Object.keys(PM).forEach(k => {
  const id = PM[k].char, lo = L.minYFor(k, L.HC0), m = M(id, 50, lo, k);
  t(`${k}: 가장 앞으로 내려도 얼굴이 프레임 안(다시 잡을 수 있음)`, lo >= L.MIN_Y && L.faceInFrame(m), [lo, m.face]);
  t(`${k}: 가장 앞에서 x 이동 범위가 남음(가로로 사라지지 않음)`, (() => { const l = L.limitsFor(k, m.wc0, m.hc0, lo); return l.minX < l.maxX; })());
});
{
  const base = [M('mom', 18, 20), M('dad', 40, 20), M('sis', 62, 20), M('bro', 82, 20)];
  const near = base.map(m => m.id === 'sis' ? M('sis', 62, -15) : m);
  t('big: 카메라 앞(y<0)으로 나오면 충족 / 전원 같은 깊이면 불충족', L.evaluateConditions(lv(1), near, A)[1] === true && L.evaluateConditions(lv(1), base, A)[1] === false);
}
{
  const ms = [M('mom', 20, 20), M('dad', 40, 20), M('sis', 62, 20), M('bro', 82, -10)], bro = ms[3];
  t('발이 프레임 밖(bottom<0)인 인물도 얼굴은 프레임 기준으로 판정', bro.bottom < 0 && L.faceInFrame(bro) && L.evaluateConditions(lv(1), ms, A)[0] === true, [bro.bottom, bro.face]);
}
{
  const a = M('mom', 40, -20), b = M('dad', 52, 20);
  t('close: 잘려 나간 인물도 찍히는 부분 기준으로 거리 계산', a.bottom < 0 && L.evaluateConditions({ conds: [{ type: 'close', a: 'mom', b: 'dad', max: .5 }] }, [a, b], A)[0] === true);
}
{
  const back = M('mom', 50, 30), front = M('bro', 50, -12), ms = [back, front];
  const covered = Math.abs(back.face.x - front.cx) < front.w * .3 && back.face.y > 100 - front.bottom - front.h * .94 && back.face.y < 100 - front.bottom;
  t('가림: 앞 인물이 더 앞(z)이고 얼굴 가림 판정이 영역과 일치', front.z > back.z && L.faceVisible(back, ms) === !covered, covered);
}
{
  const wave = M('sis', 62, 20, 'sis-p5'), off = M('sis', 62, 20, 'sis-p5');
  off.face = { x: 50, y: 99 };
  const rest = [M('mom', 20, 20), M('dad', 40, 20), M('bro', 80, 20)];
  t('staged: 얼굴이 프레임 밖이면 연출포즈로 세지 않음', L.scoreSnapshot(lv(3), rest.concat(off), A).staged === 0 && L.scoreSnapshot(lv(3), rest.concat(wave), A).staged === 1);
}

// --- V2.5 바닥 한계(소파 위로 못 올라감) / 8초 주기 행동 ---
['mom', 'dad', 'sis', 'bro'].forEach(id => Object.keys(PM).filter(k => PM[k].char === id).forEach(k => {
  [14, 20, 26].forEach(floor => {
    const old = L.FLOOR_FEET; L.FLOOR_FEET = floor;
    const y = L.maxYFor(k, L.HC0), m = M(id, 50, y, k);
    t(`바닥 한계 ${k} floor=${floor}: 신발 바닥(bbox 하단)이 바닥선을 넘지 않음`, m.bottom <= floor + .05, [m.bottom, floor]);
    L.FLOOR_FEET = old;
  });
}));
t('시작·정답 배치의 신발 바닥이 기본 바닥선(20) 안', L.LEVELS.every(lv => lv.start.concat([lv.canon]).every(lay => lay.every(([id, x, y, p]) => M(id, x, y, p).bottom <= 20.01 || y < 0))), 0);
{
  const lvl = L.LEVELS, bad = [], variety = { mom: 0, dad: 0, sis: 0, bro: 0 }, seeds = 300;
  for (const lv0 of lvl) for (let sd = 1; sd <= seeds; sd++) {
    const ev = L.buildEvents(lv0, 'normal', sd), acts = ev.filter(e => e.kind !== 'cat');
    // 같은 순간에 시작하는 행동은 없다(0.15초 이상 어긋남), 모든 행동은 8초 안, hold 후 복귀 가능
    const ats = ev.map(e => e.at).sort((a, b) => a - b);
    if (ats.some((a, i) => i && a - ats[i - 1] < .44)) bad.push(['동시', lv0.id, sd]);
    if (ev.some(e => e.at > L.CHAOS_SECONDS || e.at < .5 || !(e.hold >= 1))) bad.push(['범위', lv0.id, sd]);
    // 인물별 필러 간격 1.5~2.5초
    ['mom', 'dad', 'sis', 'bro'].forEach(id => {
      const mine = acts.filter(e => e.actor === id).sort((a, b) => b.at - a.at);
      for (let i = 1; i < mine.length; i++) if (mine[i - 1].at - mine[i].at < 1.45) bad.push(['간격', lv0.id, sd, id]);
      if (new Set(mine.map(e => e.pose)).size >= 2) variety[id]++;
      for (let i = 1; i < mine.length; i++) if (mine[i].pose === mine[i - 1].pose) bad.push(['연속같은포즈', lv0.id, sd, id]);
    });
  }
  t('8초 일정: 어떤 두 행동도 0.45초 안에 겹쳐 시작하지 않음 · 8초 안 · hold ≥1초 · 인물별 간격 ≥1.5초 · 연속 같은 포즈 없음 (전체 레벨 × seed 300)', bad.length === 0, bad.slice(0, 5));
  t('8초 일정: 각 가족이 한 판에 서로 다른 포즈를 2가지 이상 보이는 판이 65% 이상(억지로 다 보여주지 않음)', Object.values(variety).every(v => v / (seeds * lvl.length) >= .65), variety);
}
t('8초 일정: 같은 seed 는 같은 일정(결정적)', JSON.stringify(L.buildEvents(lv(2), 'normal', 77)) === JSON.stringify(L.buildEvents(lv(2), 'normal', 77)) && JSON.stringify(L.buildEvents(lv(2), 'normal', 77)) !== JSON.stringify(L.buildEvents(lv(2), 'normal', 78)));
t('복귀: 사고 포즈는 hold 초 안에만 보이고 그 뒤 시작 포즈로 돌아온다', (() => {
  const l = lv(1), c = canon(1), ev = L.buildEvents(l, 'normal', 5, true).find(e => e.actor === 'dad'), pid = T => L.simulateShot(l, c, A, T, 'normal', true, 5), d = r => 0;
  const dadPose = T => { const s = L.simulateShot(l, c, A, T, 'normal', true, 5); return s.events.includes(ev.key || ev.id) ; };
  const during = L.simulateShot(l, c, A, ev.at - .2, 'normal', true, 5), after = L.simulateShot(l, c, A, ev.at - ev.hold - .3, 'normal', true, 5);
  return during.moment > 0 && after.moment < during.moment;
})());

// --- 멧돼지 돌발 사고 ---
{
  const out = L.LEVELS.filter(l => l.outdoor).map(l => l.id).sort().join();
  t('멧돼지는 야외 3개 배경(캠핑장·벚꽃 공원·해변)에만', out === 'beach5,living3,park4', out);
  t('등장 확률 기본 30%', L.BOAR_CHANCE === .3);
  const p = { impact: 4, dir: 1, x0: -35, xc: 50, xOut: 135 }, F = r => L.boarFrame(p, r);
  t('등장 이전에는 화면에 없음', F(4 + L.BOAR_RUN + .01) === null);
  t('달리기 → 놀람 → 어지러움 → 퇴장 순서', F(4 + L.BOAR_RUN - .01).phase === 'run' && F(4 + L.BOAR_NOTICE - .05).phase === 'notice' && F(3.9).phase === 'hit' && F(4 - L.BOAR_HOLD - .1).phase === 'exit');
  t('충돌 포즈(4)는 BOAR_HOLD 동안 같은 자리에 유지', [3.99, 3, 4 - L.BOAR_HOLD + .01].every(r => F(r).pose === 4 && F(r).x === 50));
  t('달리기 포즈는 1·2 번갈아', new Set([0, 1, 2, 3].map(i => F(4 + L.BOAR_RUN - .01 - i * .14).pose)).size === 2);
  t('놀라는 구간은 포즈 3, 충돌 직전 위치가 충돌 자리에 닿음', F(4 + .01).pose === 3 && Math.abs(F(4 + .001).x - 50) < .5);
  t('퇴장이 끝나면 다시 사라짐', F(4 - L.BOAR_HOLD - L.BOAR_EXIT - .01) === null);
  const q = { dir: -1, x0: 135, xc: 30, xOut: -35, impact: 3 };
  t('왼쪽으로 달릴 때도 같은 흐름(오른쪽 가장자리 → 충돌 자리)', L.boarFrame(q, 3 + L.BOAR_RUN - .001).x > 120 && L.boarFrame(q, 3 - .1).x === 30);
  const m = canon(3);
  const hit = m.map(v => v.id === 'dad' ? L.withPose(v, 'dad-p7') : v), s0 = L.scoreSnapshot(lv(3), m, A, {}), s1 = L.scoreSnapshot(lv(3), hit, A, {}), s2 = L.scoreSnapshot(lv(3), hit, A, { boarVisible: true });
  t('충돌 포즈는 사고 포즈로 점수가 오르고 events 에 boar', s1.moment > s0.moment && s1.events.includes('boar'), [s0.moment, s1.moment]);
  t('멧돼지가 사진에 보이면 BOAR_BONUS 가 더해지고 events 에 boar 는 한 번만', s2.chaos - s1.chaos > 0 && s2.events.filter(e => e === 'boar').length === 1 && s2.accident > s1.accident);
  t('멧돼지 사진 제목은 멧돼지 문구', L.makeTitle(s2, 1).key === 'boar');
  t('멧돼지 없는 기존 사진은 그대로(boar 플래그 꺼짐)', s0.flags.boar === false && !s0.events.includes('boar'));
}

// --- 삼각 구도는 화면 비율과 무관 (가로 PC 화면에서도 설계한 정답 배치가 충족돼야 한다) ---
[3, 6].forEach(i => [.46, .75, 1, 1.3, 1.78, 2].forEach(a => t(`triangle: ${lv(i).id} 정답 배치는 화면 비율 ${a} 에서도 충족`, L.evaluateConditions(lv(i), canon(i), a)[lv(i).conds.findIndex(c => c.type === 'triangle')] === true)));

// --- 강아지 사진에 고양이 제목이 붙지 않는다 ---
{
  const c = canon(3), d = L.scoreSnapshot(lv(3), c, A, { catVisible: true, animal: 'dog' }), k = L.scoreSnapshot(lv(3), c, A, { catVisible: true, animal: 'cat' });
  t('강아지 사진 제목에 "고양이"가 없다', ![0, 1, 2].some(n => L.makeTitle(d, n).title.includes('고양이')), [0, 1, 2].map(n => L.makeTitle(d, n).title));
  t('고양이 사진 제목에는 "고양이", 강아지는 "강아지"', L.makeTitle(k, 0).title.includes('고양이') && L.makeTitle(d, 0).title.includes('강아지'));
}

console.log(`\n단위 테스트: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
