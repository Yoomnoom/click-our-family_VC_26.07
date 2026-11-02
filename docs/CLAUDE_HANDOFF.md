# 2026-11-03 갱신: 6레벨 + 완성 화면 이미지 + 앨범 선택 기능

- 레벨 6개(`dist/index.html`의 `LEVELS`): 거실 → 생일 파티 → 캠핑장 → **벚꽃 공원 → 해변 테라스 → 할머니 댁**. 새 3개 조건: L4 얼굴 4개+누나·동생 붙기, L5 엄마는 동생 뒤+특수 자세, L6 삼각 구도+엄마·아빠 붙기(고양이). 레벨 수는 `LEVELS.length`를 쓴다(예전엔 3이 코드에 박혀 있었음).
- 배경 순서는 한 판마다 무작위(`order`, localStorage `familyPhotoV2Order`). 사진 번호(n/6)는 진행 순서이고, 레벨은 `LEVELS[order[n-1]]`. 새 판(1번째 사진 시작·다시 찍기)에서만 새로 섞음. 쉬운 레벨이 앞에 온다는 보장은 없음.
- 동물: 배경이 아니라 **몇 번째 사진인지**로 정함(`animalsFor`): 1번 없음, 2~3번 고양이, 4~5번 강아지, 6번 둘 다. 처음부터 사진 안에 앉아 있다가 사고 때 달려옴(`pets`, `setupPets`). 레벨 데이터의 고양이 사고(캠핑장·할머니 댁)는 게임에서 빼고 `animalEvents`가 넣음(`enterLevel`). 그래서 `balance_sim`·단위 테스트는 예전 레벨 데이터(고양이 포함) 기준이고 실제 게임과 다를 수 있음. 동물 그림은 포즈 1장씩(`photo-cat/dog.png`) — 여러 포즈 그림이 오면 앉기·달리기 등으로 교체 예정.
- 완성 화면: `assets/main/complete-landscape.jpg`·`complete-portrait.jpg` 위에 투명 버튼 2개를 겹침(타이틀과 같은 방식, 좌표는 이미지 대비 %). **그림에 "추억 3장을 모았어요!"와 사진 3장이 들어 있어 6장에 맞게 다시 만들어야 함.**
- 앨범: 선택 다운로드(PNG)·선택 삭제·모두 지우기 추가.
- 확인: `node tools/logic_tests.js` 467 통과, `node tools/balance_sim.js` 전부 PASS, 브라우저로 레벨 5·6 진행과 완성 화면 버튼 동작 확인. **못 한 것: `tools/e2e_check.js`(Playwright 없음, "3장" 가정이 남아 있어 갱신 필요), 세로(모바일) 화면 눈 확인.**
- 캐릭터 그림(509×556)이 앞으로 올 때 최대 1.75배 확대되어 흐려짐 → 고해상도 그림으로 교체 예정.

# Claude 인계 문서 — 찰칵! 우리 가족 (V2.2 · 거실 3레벨 + 새 6포즈)

> 기준 지시문: `handoff_v2/CLAUDE_CODE_PROMPT_V2_2_POSES.md` > `CLAUDE_CODE_PROMPT_V2_1.md` > V2 마스터 프롬프트 (충돌 시 앞쪽이 우선)

## 프로젝트 구조와 실행

- 실행 코드: `dist/index.html` (단일 파일, 외부 라이브러리 없음)
- 이미지: `dist/assets/`
- 도구: `tools/` (밸런스 시뮬레이션·단위 테스트·브라우저 검증)
- 제품 정의: `docs/PRD.md`, 앞으로 만들 것: `docs/ROADMAP.md`
- 배포 설정: `.openai/hosting.json`

```bash
python -m http.server 4173 --directory dist     # http://localhost:4173
node tools/balance_sim.js                       # 밸런스 시뮬레이션 (PASS/FAIL 표)
node tools/logic_tests.js                       # 순수 함수 단위 테스트
# 브라우저 검증(Playwright 별도 설치 필요, 프로젝트에는 미포함)
NODE_PATH=<playwright 설치 폴더>/node_modules node tools/e2e_check.js <스크린샷 폴더>
```

## V2.1 게임 루프

`briefing → staging → ready(0.6s) → chaos(3.0s) → capture → result`

- **staging**: 가족을 자유 드래그. 조건 카드 2개가 실시간 체크된다. 셔터는 언제든 가능.
- 조건 2개 **모두** 충족 + **손가락을 뗀 뒤 0.3초** 유지 → `ready` → 0.6초 "사진 망가지기 3초 전!" → `chaos`.
  드래그 중에는 절대 ready 로 넘어가지 않는다.
- staging 15초 안에 ready 가 안 되면 토스트("가족이 지루해해요!") 후 현재 상태 그대로 chaos 자동 시작.
- **chaos**: 3→2→1. 레벨 데이터의 사고 타임라인이 **결정적으로** 발생한다. 0초에 자동 촬영.
- 조건 1개만 충족한 채 셔터 → 즉시 촬영(사고 없음, 평범). 정상 플레이.
- **capture**: 셔터 순간의 스냅샷(`measure()` 기준 실제 화면 좌표)을 저장 → 이후 사고가 계속돼도 결과는 불변.

## V2.2 변경 요약 (새 6포즈)

- 인물당 6포즈 = **기본 1 + 연출 2(손인사·특수) + 사고 3(단계 1→2→3)**. 24장은 `dist/assets/poses/{id}-p{1~6}.png` (전부 509×556 투명 PNG).
- 인물 상태의 단일 출처는 **`poseId`** (예: `dad-p4`). 정식 메타는 `index.html`의 `POSE_META`(인라인, 런타임 fetch 없음): 역할·점수·얼굴 가림 여부·눈에 보이는 영역(bbox)·얼굴 앵커.
- 얼굴 앵커 확인 이미지: `handoff_v2/pose_verify/verify_*.png` (재생성: `python tools/measure_faces.py && python tools/verify_faces.py`).
- **탭**: `base → wave → special → base` (레벨 1~3 공통, 사고 중 인물은 무시). 레벨 3 "특수 자세"는 `special` 만 인정(wave 불충족).
- **얼굴 보임 판정이 포즈를 반영**: `faceVisible:false` 포즈(엄마 p3 · 아빠 p1 · 누나 p1)는 얼굴 개수·삼각 구도에서 제외 → 사고가 구도 조건을 실제로 깬다.
- **구도 점수** = `(round(80×compRate) + min(20, 7×연출포즈 인원)) × 4`. 연출포즈 = wave/special 이면서 얼굴이 보이는 포즈.
- **점수는 '지금 화면의 포즈 상태' 기준**: 순간 = chaos 포즈 점수 합×배율, 사고 = (두 명 이상 동시 사고 +250, 고양이 +300)×배율. (V2.1의 "사고 이벤트 포착 시각" 판정은 폐기)
- **고양이 연쇄 반응**: 고양이와 가장 가까운 최대 2명(거리 → 인물 ID 순, 결정적)이 반응 포즈로 즉시 전환(엄마 p5·아빠 p2·누나 p2·동생 p1). 동생은 고양이 쪽 9% 이동. 이어서 고양이가 구도를 깨는 한 명을 밀친다(`planMoves` 'always').
- **렌더링**: 컨테이너 `aspect-ratio:509/556`, 포즈별 보정 CSS 전부 제거. 클릭 영역은 현재 포즈의 bbox 크기인 `.hit` 요소. 깊이 배율은 `.pose-wrap`, 0.12초 팝은 `.pose-pop`(측정에서 제외). 이 클래스 이름이 조건 카드의 `.cond.pop` 과 충돌한 적이 있으니 **`.pop` 단독 클래스를 새로 만들지 말 것**.
- **드래그 경계/'화면 안' 판정은 bbox 기준**: `limitsFor()`, `maxYFor()` (순수 함수). 포즈가 바뀌면 bbox 가 바뀐다. 모바일 터치 방어는 그대로.
- 스냅샷에 `poseId`·컨테이너 박스를 기록하고 결과 사진·앨범은 `poseId` 로 이미지를 재구성. 구버전 기록(`pose` 경로+`state`)은 `legacyPortraits/legacyAction` 으로 계속 렌더링 — **`dist/assets/*-v2.png`, `*-action*.png` 삭제 금지**.
- 포즈 프리로드: 24장 + 고양이 + 배경을 `decode()` 까지 로드한 뒤 게임 시작.
- `planMoves` 동률 비교 버그(`b.cost` → `b.c.cost`)를 V2.2 작업 중 수정함. 이동 후보 비용을 바꿀 때 `tools/balance_sim.js` 를 반드시 다시 돌릴 것.

## 사고가 구도를 실제로 무너뜨린다

사고는 포즈 이미지 교체 + **실제 좌표/크기 변경**이다.
사고 인물·시점은 고정이고, 이동 **방향**만 `planMoves()`가 "현재 구도의 약한 고리를 깨는 쪽"으로 결정적으로 고른다
(조건 충족 수 최소 → 동률이면 최소 이동). 한 명으로 안 깨지면 두 명을 연달아 밀친다(레벨 1).
→ 구도를 완성한 채 끝까지 기다리면 구도가 무너져 배율이 깎인다. 일찍 찍기와 기다리기가 모두 최적이 아니게 된다.

## 점수·등급 (순수 함수 `scoreSnapshot`, `rarityOf`) — V2.2

```
compRate = 셔터 순간 충족한 조건 수 / 2                    (0, .5, 1)
구도     = (round(80 × compRate) + min(20, 7 × 연출포즈 인원)) × 4
배율 m   = compRate 1 → 1.0 / .5 → .55 / 0 → .25
순간     = round(지금 chaos 포즈인 인물의 포즈 점수 합 × m)
사고     = round((chaos 포즈 2명 이상 +250, 고양이 포착 +300) × m)
총점     = 구도 + 순간 + 사고
등급     = 사고 점수(순간+사고) 기준 레벨별 테이블 (웃김 60 / 대참사 150 / 전설: L1·L2 없음, L3 230)
           전설은 compRate ≥ .5 + 사건 2개 이상 + 레벨별 기준
```

포즈 점수: 엄마 p3 70 · p4 120 · p5 150 / 아빠 p4 80 · p1 110 · p2 150 / 누나 p1 70 · p2 100 · p3 100 / 동생 p2 70 · p4 100 · p1 130.

## 밸런스 시뮬레이션 실행법

`tools/balance_sim.js` 는 `dist/index.html` 의 `<script id="logic">` 블록을 **그대로** 읽어 실행한다(`tools/load_logic.js`).
게임과 시뮬레이션이 같은 코드를 쓰므로 점수·등급·조건·사고 계획을 바꾸면 반드시 다시 돌릴 것.

- 레벨 1·2·3 × 셔터 시점 {3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0} × (구도 완벽 / 구도 절반)
- §6-2 기준 PASS/FAIL, 무작위 구도 2000개 강건성, 난이도 구동 확인
- FAIL 이면 `LEVELS[].rarity`, `MULT`, 사고 `pts`/`at`, `planMoves` 후보를 조정

## 반드시 유지할 모바일 방어 코드 (제거 금지)

- `.stage{touch-action:none;overscroll-behavior:none}`, `.family-member{touch-action:none}`
- `window.addEventListener('pointermove', moveDrag, {passive:false})` + `preventDefault()`
- `pointerup` **과 `pointercancel` 모두** `endDrag` 로 종료 처리
- 이동 경계는 캐릭터 **실제 크기**(`offsetWidth/offsetHeight`) 기반
- 탭/드래그 구분: 이동 6px 미만 + 250ms 미만이면 탭, 그 외는 드래그. 6px 를 넘기 전에는 위치를 바꾸지 않는다.
- 배치 화면과 결과 사진의 좌표·크기·z-index 일치: `measure()` → `snapshotMembers()` → `scenePhoto()` (결과 화면에서 자동 재정렬 금지)

이 코드를 건드리면 안드로이드에서 인물이 사라지는 문제(과거 이슈)가 재발한다.

## 데이터 / 저장

- 레벨·조건·사고 타임라인: `LEVELS` (logic 블록). 난이도 매핑: `buildEvents(level, difficulty)`.
- 신규 키: `familyPhotoV2Level`(1~3), `familyPhotoV2Best`. 공유 키: `familyPhotoGallery`(최근 12장), `familyPhotoDifficulty`, `familyPhotoMuted`.
- V2 앨범 기록: `version:2, rarity, scoreParts, events, title` 포함. 구버전 기록은 기본값으로 렌더링(`거실 N/9`).
- 앨범 카드의 사진 비율은 기록의 `stageRatio` 로 복원한다.

## (구) V2.1 이미지 자세 대응 — 구버전 앨범 렌더링 참고용

| 인물 | action.png | action2.png |
|---|---|---|
| 아빠 | 웃으며 눈 감고 꾸벅 (**눈 감기**) | 재채기 (추가 사고) |
| 엄마 | 급하게 달려감 (**급한 이동**) | 머리 헝클기 (추가 사고) |
| 누나 | 뒤돌아 폰 보기 (**딴짓**) | 윙크+큰 브이 (**과한 브이**) |
| 동생 | 점프 (**점프**) | 쪼그려 메롱 (**딴짓**) |

## 금지 (V2.1 유지)

- 회원가입·서버·온라인 랭킹·결제, 프레임워크 전환, 외부 라이브러리·외부 오디오 파일
- 발 마커 재도입, 결과 화면 자동 재정렬, 플레이어 행동과 무관한 무작위 손떨림·손가락 가림
- 실패 시 같은 레벨 강제 반복, 긴 튜토리얼, 플레이어를 탓하는 문구·"다시 도전하세요"를 주 CTA 로 사용

## 현재 배포본

https://family-photo-rush.good4056.chatgpt.site (V1 배포본. V2.1 은 아직 배포 전)
