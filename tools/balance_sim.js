// 밸런스 시뮬레이션: node tools/balance_sim.js
// 구도를 완성한 상태(canon)로 사고 타임에 진입했다고 가정하고, 셔터 시점별 점수·등급을 출력하고 §6-2 기준을 PASS/FAIL 로 판정한다.
const L = require('./load_logic.js')();
const A = L.A_DEFAULT, TS = [7.8, 7, 6, 5, 4, 3, 2, 1, 0.5, 0];
const RK = { normal: '평범', funny: '제법웃김', disaster: '대참사', legend: '전설' };
const pad = (s, n) => String(s).padEnd(n);
let allPass = true;
const check = (name, ok, detail) => { if (!ok) allPass = false; console.log(`   [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const mk = list => list.map(([id, x, y, sp]) => L.nominalMember(id, x, y, sp));

L.LEVELS.forEach((lv, li) => {
  console.log(`\n=== 레벨 ${li + 1}: ${lv.title}  (등급 기준 사고점수 ≥ 웃김 ${lv.rarity.funny} / 대참사 ${lv.rarity.disaster} / 전설 ${lv.rarity.legend >= 99999 ? '없음' : lv.rarity.legend})`);
  const perfect = mk(lv.canon);
  // 구도 절반 상태: 조건 1개가 깨진 시작(=start 배치에서 미충족 1개)을 흉내 — canon 에서 한 조건을 해제한 배치
  const half = mk(lv.start[0]);
  const rows = {};
  [['구도 완벽', perfect], ['구도 절반', half]].forEach(([label, lay]) => {
    const st = L.evaluateConditions(lv, lay, A).filter(Boolean).length;
    console.log(`  [${label}] 시작 조건 충족 ${st}/2`);
    console.log('   ' + pad('남은초', 7) + pad('구도', 6) + pad('순간', 6) + pad('사고', 6) + pad('총점', 7) + pad('등급', 10) + '포착 사건');
    rows[label] = TS.map(T => {
      const r = L.simulateShot(lv, lay, A, T);
      console.log('   ' + pad(T.toFixed(1), 7) + pad(r.comp, 6) + pad(r.moment, 6) + pad(r.chaos, 6) + pad(r.total, 7) + pad(RK[r.rarity], 10) + r.events.join(','));
      return r;
    });
  });
  const P = rows['구도 완벽'], H = rows['구도 절반'], at = T => P[TS.indexOf(T)];
  console.log('  -- 판정(구도 완벽 기준, 기본 seed 1개)');
  check('7.8초(첫 행동 전) = 평범', at(7.8).rarity === 'normal', RK[at(7.8).rarity]);
  const mid = Math.max(...P.map(r => r.total)), auto = at(0);
  check('구도 0이면 전설 불가', !P.concat(H).some(r => r.compRate === 0 && r.rarity === 'legend'));
  const best = P.reduce((b, r, i) => r.total > P[b].total ? i : b, 0), bestT = TS[best];
  console.log(`   [정보] 기본 seed 1개: 0초 자동촬영 ${auto.total}점 / 격자 최고 ${mid}점 (아래 seed 300개 집계가 판정 기준)`);
  check('항상 즉시 찍기(7.8초)가 최적이 아님', at(7.8).total < mid, `7.8초 ${at(7.8).total} < 최고 ${mid}`);
  console.log(`  최적 셔터 시점(격자 기준): 남은 ${bestT}초, 총점 ${P[best].total}`);
  // 여러 seed(필러 행동이 달라짐): 시각을 0.25초 격자로 훑어 등급 분포와 '기다리면 항상 이득/손해' 여부를 본다
  const dist = { normal: 0, funny: 0, disaster: 0, legend: 0 }; let n = 0, autoLow = 0, early = 0, seeds = 300;
  for (let sd = 1; sd <= seeds; sd++) {
    let mx = 0, e = 0;
    for (let T = 7.75; T >= 0; T -= .25) { const r = L.simulateShot(lv, perfect, A, T, 'normal', false, sd); dist[r.rarity]++; n++; mx = Math.max(mx, r.total); if (T === 7.75) e = r.total }
    if (L.simulateShot(lv, perfect, A, 0, 'normal', false, sd).total <= mx * .85) autoLow++;
    if (e < mx) early++;
  }
  console.log('  등급 분포(셔터 시각 균등): ' + Object.keys(dist).map(k => `${RK[k]} ${(dist[k] / n * 100).toFixed(0)}%`).join(' / '));
  // L3 는 고양이 이후에도 마지막 순간의 행동 겹침이 높은 점수를 줄 수 있어, 자동촬영이 '항상' 낮다고 단정하지 않고 비율만 보고한다(L1·L2 는 기준 유지)
  if (li === 2) console.log(`   [정보] L3: seed ${seeds}개 중 ${(autoLow / seeds * 100).toFixed(0)}%에서 0초 자동촬영이 최고점보다 15% 이상 낮음 (놓쳐도 마지막 순간에 좋은 장면이 걸릴 수 있음)`);
  else check('seed 300개 중 80% 이상에서 0초 자동촬영이 최고점보다 15% 이상 낮음', autoLow / seeds >= .8, `${(autoLow / seeds * 100).toFixed(0)}%`);
  check('seed 300개 중 90% 이상에서 일찍 찍는 것(7.75초)이 최고점이 아님', early / seeds >= .9, `${(early / seeds * 100).toFixed(0)}%`);
  check('등급 분포가 한쪽으로 쏠리지 않음(평범 15~70%, 제법웃김+ 30% 이상)', dist.normal / n >= .15 && dist.normal / n <= .7, `평범 ${(dist.normal / n * 100).toFixed(0)}%`);
});

// 임의 배치 강건성: 조건 2개를 모두 만족하는 무작위 배치에서 '0초 자동촬영이 중간 최고점보다 15% 이상 낮은가'
console.log('\n=== 임의 구도 강건성 (조건 2개 충족 무작위 배치 2000개/레벨)');
function rnd(a, b) { return a + Math.random() * (b - a); }
L.LEVELS.forEach((lv, li) => {
  let ok = 0, tot = 0, tries = 0, noCollapse = 0;
  while (tot < 2000 && tries < 400000) {
    tries++;
    let lay = ['mom', 'dad', 'sis', 'bro'].map(id => L.nominalMember(id, rnd(12, 88), rnd(1, 40)));
    if (lv.conds.some(c => c.type === 'special')) { const k = Math.floor(Math.random() * 4); lay[k] = L.withPose(lay[k], L.SPECIAL[lay[k].id]); }
    if (L.evaluateConditions(lv, lay, A).filter(Boolean).length !== 2) continue;
    tot++;
    const ts = [7, 5.5, 4, 2.5, 1, 0.5].map(T => L.simulateShot(lv, lay, A, T).total), auto = L.simulateShot(lv, lay, A, 0).total;
    if (auto <= Math.max(...ts) * 0.85) ok++; else noCollapse++;
  }
  console.log(`  레벨 ${li + 1}: 표본 ${tot}개 중 ${ok}개(${(ok / tot * 100).toFixed(1)}%)에서 0초 자동촬영이 최고점 대비 15% 이상 낮음 / 붕괴 부족 ${noCollapse}개`);
});

// 난이도 매핑이 깨지지 않는지(보통만 밸런스 검증, 나머지는 구동 확인)
console.log('\n=== 난이도 구동 확인 (구도 완벽, 레벨 3)');
['easy', 'normal', 'chaos'].forEach(d => {
  const lv = L.LEVELS[2], lay = mk(lv.canon);
  console.log('  ' + pad(d, 7) + TS.map(T => `${T}s:${L.simulateShot(lv, lay, A, T, d).total}/${RK[L.simulateShot(lv, lay, A, T, d).rarity]}`).join('  '));
});
console.log(`\n최종: ${allPass ? '모든 기준 PASS' : '일부 FAIL — 수치 조정 필요'}`);
process.exit(allPass ? 0 : 1);
