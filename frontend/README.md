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
├── tests/
│   ├── integration/   # 컴포넌트 통합 테스트
│   └── unit/         # 컴포넌트 단위 테스트
└── public/           # 정적 자산
```

## 기술 스택

- **Framework**: React 18+
- **Language**: TypeScript
- **Testing**: Jest, Cypress (E2E)
- **File Upload**: react-dropzone
- **API Client**: Axios
- **Build Tool**: Create React App

## 주요 기능

- **드래그 앤 드롭 업로드**: 최대 5개 이미지 동시 업로드
- **실시간 검증**: 파일 크기 및 형식 검사
- **프롬프트 입력**: 분석을 위한 텍스트 지시사항
- **결과 표시**: 마크다운 형식의 분석 결과
- **내보내기**: JSON, 마크다운 형식으로 결과 다운로드
- **세션 히스토리**: 브라우저 세션 내 분석 이력 관리

## 개발 환경

*개발 환경 설정은 T003 작업에서 구성됩니다.*

## 브라우저 지원

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## 버전

- **프로젝트 버전**: 0.1.0
- **피처 브랜치**: 001-2025-9-google
- **생성일**: 2025-09-10