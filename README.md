# StylePrint

UI reference screenshot에서 디자인 특징을 추출하고, 여러 reference의 스타일 요소를 조합해 React + Tailwind UI 코드를 생성하는 프로토타입입니다.

현재 구조는 **Vite React frontend + Fastify TypeScript backend**로 분리되어 있습니다.

## 구조

```text
apps/
  web/        Vite + React + TypeScript UI
  api/        Fastify + TypeScript API server
packages/
  shared/     frontend/backend 공용 타입
data/         JSON 기반 로컬 저장소
public/
  uploads/    업로드 이미지 저장소
```

## 실행

```bash
npm install
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

개별 실행도 가능합니다.

```bash
npm run dev:api
npm run dev:web
```

## 환경 변수

`.env.local.example`을 참고해 필요한 값을 설정합니다.

```env
V0_API_KEY=
API_PORT=4000
WEB_ORIGIN=http://localhost:5173
```

`V0_API_KEY`가 없으면 typography/layout/mood/code generation은 mock 데이터를 사용합니다.

## 주요 흐름

1. Web에서 screenshot을 base64 data URL로 변환해 API에 업로드합니다.
2. API는 이미지를 `public/uploads`에 저장하고 metadata를 `data/references.json`에 기록합니다.
3. facet extraction은 색상, typography, layout, spacing, component style token을 생성합니다.
4. Web에서 recipe를 선택하면 API가 intent spec으로 정규화합니다.
5. API가 contrast/density/spacing conflict를 평가하고 repair plan을 저장합니다.
6. 생성 요청 시 API가 v0 또는 mock generator로 React + Tailwind 코드를 반환합니다.
7. audit endpoint가 생성 코드에서 facet을 역추출해 intent와 비교합니다.

## API

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | `GET` | API 상태 확인 |
| `/uploads/:filename` | `GET` | 업로드 이미지 제공 |
| `/api/references/upload` | `GET` | reference 목록 조회 |
| `/api/references/upload` | `POST` | reference 이미지 업로드 |
| `/api/references/upload?id=...` | `DELETE` | reference 삭제 |
| `/api/facets/extract` | `POST` | reference에서 facet 추출 |
| `/api/intents/create` | `POST` | 선택한 recipe로 intent 생성 |
| `/api/intents/evaluate` | `POST` | intent 충돌 평가 및 repair 저장 |
| `/api/intents/apply-repair` | `POST` | repair 적용 |
| `/api/generate/v0` | `POST` | UI 코드 생성 |
| `/api/audit/analyze` | `POST` | 생성 코드 audit |

## 검증

```bash
npm run typecheck
npm run build
```

`npm run build`는 backend/frontend 타입체크 후 Vite production build를 수행합니다.

## 현재 한계

- 색상 추출은 서버에서 실제 픽셀 분석이 아니라 base64 hash 기반 mock 로직입니다.
- 저장소는 JSON 파일 기반이라 다중 사용자/배포 환경에는 SQLite/PostgreSQL/S3/R2 같은 저장소가 필요합니다.
- 인증과 사용자별 데이터 분리는 아직 없습니다.
