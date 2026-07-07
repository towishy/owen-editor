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
