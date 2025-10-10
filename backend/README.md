# Google Gemini Multi-Image Analysis - Backend

Express.js 백엔드 서버로 Google Gemini API를 통한 다중 이미지 분석 기능을 제공합니다.

## 프로젝트 구조

```
backend/
├── src/
│   ├── models/          # 데이터 모델 (Image, Prompt, AnalysisResult)
│   ├── services/        # 비즈니스 로직 (GeminiService, FileService)
│   ├── api/            # Express 라우터와 미들웨어
│   └── lib/            # 핵심 라이브러리 (image-analyzer, file-handler)
├── tests/
│   ├── contract/       # API 계약 테스트
│   ├── integration/    # 서비스 통합 테스트
│   └── unit/          # 라이브러리 단위 테스트
└── cli/               # 라이브러리용 CLI 도구
```

## 기술 스택

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Testing**: Jest, Supertest
- **API Integration**: Google Gemini API SDK
- **File Upload**: Multer
- **Logging**: Winston

## 개발 환경

_개발 환경 설정은 T002 작업에서 구성됩니다._

## API 엔드포인트

_API 문서는 `/specs/001-2025-9-google/contracts/api.yaml` 참조_

## 버전

- **프로젝트 버전**: 0.1.0
- **피처 브랜치**: 001-2025-9-google
- **생성일**: 2025-09-10
