# 찰칵! 우리 가족 V2 — Claude 제작 패키지

## 목적

현재 버전은 이미지와 상호작용은 있지만 핵심 재미가 모호하다. V2는 기존 발 마커 중심 배치 게임을 버리고 **조건형 구도 퍼즐 × 순간 포착 × 웃긴 실패 수집**으로 바꾼다.

## 확정된 사용자 의도

- 첫 판을 마친 심사위원이 느껴야 할 감정: **망한 사진을 보고 빵 터짐**
- 자유도: **조건만 지키고 자유롭게 연출**
- 투자 원칙: 아이디어 상승폭이 큰 범위만 구현
- 구현 전략: 전체 9레벨을 먼저 고치지 않고 **거실 3레벨 수직 슬라이스**로 재미를 검증

## 읽는 순서

1. `01_CLAUDE_MASTER_PROMPT.md`
2. `02_PRODUCT_SPEC.md`
3. `03_GAME_RULES_SCORING.md`
4. `04_UX_SCREEN_SPEC.md`
5. `05_TECHNICAL_PLAN.md`
6. `06_QA_ACCEPTANCE.md`
7. `07_ASSET_AND_COPY_GUIDE.md`
8. `diagrams/`
9. `mockups/v2_mobile_wireframes.svg`
10. 기존 코드 `../dist/index.html`

## 실행

```bash
python3 -m http.server 4173 --directory dist
```

접속: `http://localhost:4173`

## 중요한 판단

현재 이미지 자산은 대부분 재사용한다. 기존 단일 HTML 구조도 유지한다. 다만 발 마커, 레벨 규칙, 촬영 전후 상태, 점수 계산은 재설계한다. 결과 사진은 사용자가 만든 구도를 그대로 재현해야 한다.
