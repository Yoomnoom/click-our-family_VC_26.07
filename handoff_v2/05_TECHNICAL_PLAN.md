# 기술 구현 계획

## 구조 원칙

- 기존 단일 `dist/index.html` 유지
- 외부 라이브러리 추가 금지
- 이미지 경로 유지
- 단계별 작은 함수로 분리

## 신규 데이터 구조 예시

```js
const v2Levels = [{
  id: 'living_triangle',
  scene: '거실',
  title: '우리 집 삼각형',
  background: 'assets/living-room.png',
  conditions: [
    { id: 'faces3', label: '얼굴 3개 보이기', type: 'visibleFaces', min: 3 },
    { id: 'triangle', label: '삼각 구도 만들기', type: 'triangleFaces' },
    { id: 'oneLarge', label: '한 명 크게', type: 'relativeScale', minRatio: 1.12 }
  ],
  chaos: [
    { at: 2.4, actor: 'dad', action: 'sleep' },
    { at: 1.2, actor: 'bro', action: 'jump' }
  ]
}];
```

## 신규 상태

```js
let phase = 'briefing';
let conditionState = {};
let chaosRemaining = 3;
let capturedEvents = [];
let captureTimestamp = 0;
```

## 필요한 함수

- `evaluateConditions()`
- `getCharacterMetrics()`
- `getFacePoint(member)`
- `isMostlyInside(member)`
- `hasTriangleComposition(points)`
- `startChaosPhase()`
- `scheduleChaosEvents(level)`
- `captureSnapshot()`
- `calculateV2Score(snapshot)`
- `getPhotoRarity(score, events)`
- `renderConditionCards()`
- `renderV2Result()`

## 제거 또는 비활성화

- `.target-zone`
- `getPlacement()` 기반 점수
- `slots`, `need`
- 무작위 `chooseEffect()` 결과 훼손
- 발 마커 안착 토스트

## 재사용

- 포인터 드래그 함수
- `applyDepth()`
- `captureMembers()`
- `scenePhoto()`
- `savePhoto()`
- 갤러리 렌더링
- 난이도 선택
- 가족 돌발 이미지와 `performChaos()`

## 모바일 안전

- stage의 `touch-action:none`
- window `pointermove`는 `passive:false`
- `pointerup`과 `pointercancel` 모두 종료
- 캐릭터 actual width/height 기반 경계
- 화면 회전 시 좌표 보정 또는 라운드 재시작 안내

## 저장 마이그레이션

- 기존 앨범 기록은 읽되 V2 기록에는 `version:2` 추가
- 구버전 기록에 없는 rarity/scoreParts는 기본값 처리
- 진행 레벨 키는 `familyPhotoV2Level`로 분리
- 기존 최고점과 혼합하지 않고 `familyPhotoV2Best` 사용

## 구현 순서

1. V2 레벨 데이터
2. 발 마커 제거
3. 조건 판정과 카드
4. 사고 타임
5. 촬영 스냅샷
6. 점수와 등급
7. 결과·앨범 호환
8. 모바일 QA
