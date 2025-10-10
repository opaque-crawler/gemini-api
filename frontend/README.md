# Google Gemini Multi-Image Analysis - Frontend

React 프론트엔드 애플리케이션으로 사용자가 여러 이미지를 업로드하고 AI 분석 결과를 확인할 수 있는 직관적인 인터페이스를 제공합니다.

## 프로젝트 구조

```
frontend/
├── src/
│   ├── components/     # UI 컴포넌트 (ImageUpload, PromptInput, ResultsDisplay)
│   ├── pages/         # 메인 분석 페이지
│   ├── services/      # API 클라이언트, 파일 검증
│   └── hooks/         # 커스텀 React 훅
├── cypress/
│   ├── e2e/           # E2E 테스트
│   ├── support/       # Cypress 지원 파일
│   └── fixtures/      # 테스트 데이터
└── public/           # 정적 자산
```

## 기술 스택

- **Framework**: React 19.1.1 (Create React App)
- **Language**: TypeScript 4.9.5
- **Testing**: Jest, React Testing Library, Cypress (E2E)
- **File Upload**: react-dropzone 14.3.8
- **API Client**: Axios 1.11.0
- **Build Tool**: React Scripts 5.0.1

## 주요 기능

- **드래그 앤 드롭 업로드**: 최대 5개 이미지 동시 업로드
- **실시간 검증**: 파일 크기 및 형식 검사
- **프롬프트 입력**: 분석을 위한 텍스트 지시사항
- **결과 표시**: 마크다운 형식의 분석 결과
- **내보내기**: JSON, 마크다운 형식으로 결과 다운로드
- **세션 히스토리**: 브라우저 세션 내 분석 이력 관리

## 개발 환경

### 사용 가능한 스크립트

- `npm start`: 개발 서버 시작 (http://localhost:3000)
- `npm run build`: 프로덕션 빌드 생성
- `npm test`: Jest 단위 테스트 실행
- `npm run test:coverage`: 코드 커버리지 포함 테스트
- `npm run test:e2e`: Cypress E2E 테스트 실행
- `npm run test:e2e:open`: Cypress 테스트 GUI 열기

### 환경 요구사항

- Node.js 18+
- npm 또는 yarn

## 브라우저 지원

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## API 통합

백엔드 API 서버와 통신하여 다음 기능을 제공합니다:

- 이미지 업로드 (POST /api/v1/images)
- 분석 요청 (POST /api/v1/analyze)
- 결과 조회 (GET /api/v1/analyze/{requestId})
- 세션 관리 (POST /api/v1/session)

## 버전

- **프로젝트 버전**: 0.1.0
- **피처 브랜치**: 001-2025-9-google
- **생성일**: 2025-09-10
- **업데이트**: 2025-09-11 (T003 완료)
