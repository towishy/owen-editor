# Owen Editor Agent Instructions

이 저장소는 Obsidian용 Owen Editor 플러그인 프로젝트다.

## Knowledge Source

VS Code에서는 이 프로젝트와 `C:\OWEN\github\wiki`를 멀티 루트 워크스페이스로 함께 연다.

- `C:\OWEN\github\wiki`를 디자인·지식 참고 루트로 상시 취급한다.
- UI/UX, 접근성, 반응형 또는 컴포넌트 작업 전 `lib/ui-foundation/`, `lib/ui-lab/src/`, 관련 `lib/ui-foundation/REFERENCE-STUDY-*.md`를 작업 용어로 검색하고 해당 소스를 확인한다.
- 사용자가 명시적으로 요청하지 않으면 `C:\OWEN\github\wiki`의 파일은 읽기 전용으로 유지한다.
- `C:\OWEN\github\wiki`에 접근할 수 없으면 추측으로 대체하지 않고, 검증하지 못한 사실을 완료 보고에 명시한다.

문서/Obsidian/Owen Graphite/UI 관련 작업은 먼저 wiki를 참조한다.

```powershell
Push-Location C:\OWEN\github\wiki
.\.venv\Scripts\python.exe scripts\wiki-query.py "Obsidian Owen Editor 기능명" --limit 7 --json
Pop-Location
```

<!-- ui-portal-usage:start -->
## Owen UI Portal 사용

- UI/UX, frontend, component, 접근성, 반응형 또는 시각 자산 작업을 계획하거나 편집하기 전 companion WIKI의 UI Portal을 task-specific 자산 선택의 기본 라우터로 사용한다.
- WIKI 루트는 멀티루트 workspace의 `wiki`, sibling `../wiki`, 현재 플랫폼의 알려진 WIKI 경로 순서로 찾으며 하나의 절대 경로만 가정하지 않는다.
- 구현용 선택은 WIKI 루트에서 `node scripts/ui-portal/query-assets.mjs brief "<한 문장의 output job>" --limit 5`를 실행하고 Task Profile, Context Pack, exact Asset ID, `ownerPath`/`ownerApi`, maturity와 validation을 확인한다. broad Registry를 모델 컨텍스트에 넣거나 Asset ID를 추측하지 않는다.
- 시각 검토는 WIKI의 `process: UI Portal Controller`를 실행·재사용하고 VS Code 내장 브라우저에서 `/uiportal query="<작업>"` 또는 `http://127.0.0.1:4172/portal/`을 연다.
- Portal은 라우팅·증거 surface이고 Foundation의 `DESIGN.md`와 owning source가 최종 계약이다. WIKI는 명시적 요청이 없으면 읽기 전용으로 유지하며, 접근할 수 없으면 미검증 범위를 보고한다.
<!-- ui-portal-usage:end -->

## UI Direction

UI 작업 전 sibling workspace folder `wiki`의 `wiki/concepts/ui-design-system-knowledge.md`를 우선 참조한다.
디자인/프론트엔드 작업을 시작하기 전 `C:\OWEN\github\wiki\lib\ui-foundation`의 `README.md`, `DESIGN.md`, `tokens/`, `src/` 컴포넌트 계약을 읽고 현재 프로젝트에 맞게 적용한다.

기본 조합:

- Extend-UI / shadcn component structure
- Owen Graphite Liquid Glass visual surface
- Reicon for richer icon options
- Border Beam only for focused emphasis
- Boneyard only for data-heavy app skeleton loading

Obsidian 플러그인 UI는 Owen Graphite와 충돌하지 않는 조용한 도구형 UI를 우선한다.

## Project Commands

```powershell
npm run dev
npm run build
npm run lint:obsidian
npm run release:check
npm run sync:obsidian
npm run update:obsidian
```

## Local Rules

- Obsidian API, manifest, command registration 변경 시 실제 Obsidian 동작을 고려한다.
- Owen Graphite 스타일과 겹치는 UI는 theme CSS를 침범하지 않도록 scope를 좁힌다.
- 릴리스 전 `npm run release:check`를 우선 실행한다.

## Localization Contract

- 사용자 노출 UI의 기본 언어는 영어(`en`)다.
- 기능을 추가하거나 변경할 때 영어와 한국어(`ko`) 문자열을 같은 변경에서 함께 구현한다. 설정, 명령, 메뉴, 버튼, tooltip, aria-label, modal, notice, 상태·오류 문구를 빠뜨리지 않는다.
- 사용자 노출 문자열을 기능 코드에 직접 하드코딩하지 않고 typed i18n catalog와 번역 함수를 사용한다.
- 내부 ID, command ID, CSS class, Markdown syntax, 파일 경로, 사용자 데이터, 원시 오류 detail은 번역하지 않는다.
- 기본 preference는 `auto`다. Obsidian locale이 `ko` 계열이면 한국어, 그 외에는 영어를 사용하며, 사용자가 고른 `en`/`ko` override가 자동값보다 우선한다.
- 영어/한국어 key parity, 영어 fallback, 보간, 자동 locale 해석, override 우선순위를 자동 검사에 포함하고 릴리스 전에 통과시킨다.

<!-- ui-foundation-design-guide:start -->
## UI Foundation Lab 디자인 가이드

- 모든 UI 설계·구현 전에 [UI-FOUNDATION-DESIGN-GUIDE.md](UI-FOUNDATION-DESIGN-GUIDE.md)를 먼저 읽는다.
- UI Foundation Lab 왼쪽 패널의 26개 UI를 모두 `Priority 1` 디자인 후보로 취급한다.
- `Priority 1` 안에서는 Clear glass search, controls, workflow를 가장 먼저 검토한다.
- 나머지 Lab specimen을 검토한 뒤에만 앱 전용 신규 디자인이나 외부 reference를 고려한다.
- 이 프로젝트의 기존 제품 제약과 더 엄격한 접근성·runtime 규칙은 그대로 유지한다.
<!-- ui-foundation-design-guide:end -->
