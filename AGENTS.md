# Owen Editor Agent Instructions

이 저장소는 Obsidian용 Owen Editor 플러그인 프로젝트다.

## Knowledge Source

VS Code에서는 이 프로젝트와 `C:\OWEN\github\wiki`를 멀티 루트 워크스페이스로 함께 연다.

문서/Obsidian/Owen Graphite/UI 관련 작업은 먼저 wiki를 참조한다.

```powershell
Push-Location C:\OWEN\github\wiki
.\.venv\Scripts\python.exe scripts\wiki-query.py "Obsidian Owen Editor 기능명" --limit 7 --json
Pop-Location
```

## UI Direction

UI 작업 전 sibling workspace folder `wiki`의 `wiki/concepts/ui-design-system-knowledge.md`를 우선 참조한다.

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
