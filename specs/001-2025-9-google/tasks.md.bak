# Tasks: Google Gemini Multi-Image Analysis Web App

**Input**: Design documents from `/specs/001-2025-9-google/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Loaded: JavaScript/TypeScript web app with React frontend + Express backend
   → ✅ Extract: Node.js 18+, React 18+, Express.js, Gemini API SDK, Multer
2. Load optional design documents:
   → ✅ data-model.md: Image, Prompt, AnalysisRequest, AnalysisResult, UserSession entities
   → ✅ contracts/: 7 API endpoints (health, session, images, analyze, export, history)
   → ✅ research.md: Gemini API integration decisions, file constraints, security
3. Generate tasks by category:
   → Setup: project init, dependencies, Docker, environment config
   → Tests: 7 contract tests + 8 integration scenarios from quickstart
   → Core: 5 entity models + services + API routes + React components
   → Integration: Gemini API, file upload, middleware, logging
   → Polish: unit tests, performance validation, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel execution
   → Same file = sequential (no [P])
   → Tests before implementation (strict TDD)
5. Number tasks sequentially (T001-T044)
6. Generate dependency graph and parallel execution examples
7. Validate task completeness: ✅ All contracts tested, entities modeled, endpoints implemented
8. Return: SUCCESS (44 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute from repository root

---

## Phase 3.1: Setup & Infrastructure

- [x] T001 Create project structure per implementation plan
  - Create `backend/` and `frontend/` directories at repository root
  - Initialize basic directory structure as specified in plan.md
  - Create placeholder README files for each project

- [x] T002 Initialize backend Node.js project with dependencies
  - Run `npm init` in `backend/` directory
  - Install Express.js, @google/genai, multer, winston, cors, helmet
  - Configure TypeScript with strict mode, Jest for testing
  - Set up package.json scripts: dev, test, build

- [x] T003 Initialize frontend React project with dependencies  
  - Run `create-react-app frontend --template typescript`
  - Install react-dropzone, axios for API client
  - Configure Cypress for E2E testing
  - Set up package.json scripts: start, test, test:e2e

- [x] T004 [P] Configure development environment and tooling
  - Create Docker Compose setup for development
  - Configure ESLint, Prettier for both frontend and backend
  - Set up environment variable templates (.env.example)
  - Create VS Code workspace settings

- [x] T005 [P] Set up logging and monitoring infrastructure
  - Configure Winston logger in `backend/src/utils/logger.ts`
  - Set up structured logging format with request correlation IDs
  - Create log rotation and cleanup policies
  - Add error tracking and performance monitoring setup

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### API Contract Tests (Parallel - Different Files)
- [x] T006 [P] Contract test GET /api/v1/health in `backend/tests/contract/health.test.ts`
  - Test health check response format and status codes
  - Validate OpenAPI schema compliance
  - Must fail initially (no endpoint exists)

- [x] T007 [P] Contract test POST /api/v1/session in `backend/tests/contract/session.test.ts`
  - Test session creation request/response format
  - Validate session ID generation and rate limit initialization
  - Must fail initially (no endpoint exists)

- [x] T008 [P] Contract test POST /api/v1/images in `backend/tests/contract/images.test.ts`
  - Test multipart file upload with validation
  - Test file size limits, format validation, error responses
  - Must fail initially (no endpoint exists)

- [x] T009 [P] Contract test POST /api/v1/analyze in `backend/tests/contract/analyze.test.ts`
  - Test analysis request format with imageIds and prompt
  - Test response format with analysis results
  - Must fail initially (no endpoint exists)

- [x] T010 [P] Contract test GET /api/v1/analyze/{requestId} in `backend/tests/contract/analyze-status.test.ts`
  - Test analysis status polling
  - Test completed analysis result retrieval
  - Must fail initially (no endpoint exists)

- [x] T011 [P] Contract test GET /api/v1/session/{sessionId}/history in `backend/tests/contract/history.test.ts`
  - Test session history retrieval with pagination
  - Test history filtering and sorting
  - Must fail initially (no endpoint exists)

- [x] T012 [P] Contract test GET /api/v1/export/{requestId} in `backend/tests/contract/export.test.ts`
  - Test export format options (JSON, markdown, txt)
  - Test export file generation and download
  - Must fail initially (no endpoint exists)

### Integration Test Scenarios (Parallel - Different Files)
- [x] T013 [P] Integration test: Basic multi-image analysis in `backend/tests/integration/basic-analysis.test.ts`
  - Upload 2 test images, submit analysis prompt
  - Validate complete flow from upload to results
  - Must fail initially (no services exist)

- [x] T014 [P] Integration test: Comparative analysis in `frontend/tests/integration/comparative-analysis.test.ts`
  - Test UI flow for comparing multiple images
  - Validate prompt-specific analysis results
  - Must fail initially (no components exist)

- [x] T015 [P] Integration test: File size limits in `backend/tests/integration/file-limits.test.ts`
  - Test client and server-side validation
  - Test error handling for oversized files
  - Must fail initially (no validation exists)

- [ ] T016 [P] Integration test: Unsupported formats in `frontend/tests/integration/format-validation.test.ts`
  - Test file format rejection
  - Test error messaging and recovery
  - Must fail initially (no validation exists)

- [x] T017 [P] Integration test: Rate limiting in `backend/tests/integration/rate-limits.test.ts`
  - Test request throttling and queue behavior
  - Test rate limit error responses
  - Must fail initially (no rate limiting exists)

- [x] T018 [P] Integration test: Session persistence in `frontend/tests/integration/session-persistence.test.ts`
  - Test analysis history across page reloads
  - Test result export functionality
  - Must fail initially (no session management exists)

- [x] T019 [P] Integration test: Error recovery in `frontend/tests/integration/error-recovery.test.ts`
  - Test network interruption handling
  - Test API error recovery and retry
  - Must fail initially (no error handling exists)

- [ ] T020 [P] Integration test: Performance benchmarks in `backend/tests/integration/performance.test.ts`
  - Test upload speed (<3s), analysis time (<10s)
  - Test concurrent user support (10 users)
  - Must fail initially (no implementation exists)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Backend Data Models (Parallel - Different Files)
- [ ] T021 [P] Image model in `backend/src/models/Image.ts`
  - Implement Image interface with validation rules
  - Add status transitions and file metadata handling
  - Include TypeScript types from data-model.md

- [ ] T022 [P] Prompt model in `backend/src/models/Prompt.ts`
  - Implement Prompt interface with content filtering
  - Add language detection and token counting
  - Include sanitization and validation methods

- [ ] T023 [P] AnalysisRequest model in `backend/src/models/AnalysisRequest.ts`
  - Implement request aggregation and validation
  - Add status management and progress tracking
  - Include size and token limit enforcement

- [ ] T024 [P] AnalysisResult model in `backend/src/models/AnalysisResult.ts`
  - Implement result parsing and formatting
  - Add per-image analysis breakdown
  - Include confidence scoring and metadata

- [ ] T025 [P] UserSession model in `backend/src/models/UserSession.ts`
  - Implement session management and rate limiting
  - Add history tracking and cleanup policies
  - Include preference storage and activity monitoring

### Backend Services (Sequential - Same Files Have Dependencies)
- [ ] T026 FileService implementation in `backend/src/services/FileService.ts`
  - Depends on T021 (Image model)
  - Implement file upload, validation, temporary storage
  - Add cleanup policies and malware scanning

- [ ] T027 GeminiService implementation in `backend/src/services/GeminiService.ts`
  - Depends on T022, T024 (Prompt, AnalysisResult models)
  - Implement Gemini API integration and error handling
  - Add retry logic and response parsing

- [ ] T028 SessionService implementation in `backend/src/services/SessionService.ts`
  - Depends on T025 (UserSession model)
  - Implement session creation, management, cleanup
  - Add rate limiting and history management

- [ ] T029 AnalysisService implementation in `backend/src/services/AnalysisService.ts`
  - Depends on T021-T027 (all models and services)
  - Orchestrate complete analysis workflow
  - Add request validation and result processing

### Backend API Routes (Sequential - Shared Middleware Dependencies)
- [ ] T030 Health check endpoint in `backend/src/api/health.ts`
  - Implement GET /api/v1/health
  - Add system status and dependency checks
  - Include version information and uptime

- [ ] T031 Session management endpoints in `backend/src/api/session.ts`
  - Depends on T028 (SessionService)
  - Implement POST /api/v1/session and history endpoint
  - Add session validation middleware

- [ ] T032 Image upload endpoints in `backend/src/api/images.ts`
  - Depends on T026 (FileService)
  - Implement POST /api/v1/images with Multer integration
  - Add file validation and error handling

- [ ] T033 Analysis endpoints in `backend/src/api/analyze.ts`
  - Depends on T027, T029 (GeminiService, AnalysisService)
  - Implement POST /api/v1/analyze and GET status endpoint
  - Add request queuing and progress tracking

- [ ] T034 Export endpoints in `backend/src/api/export.ts`
  - Depends on T024 (AnalysisResult model)
  - Implement GET /api/v1/export with format options
  - Add file generation and streaming

### Frontend Components (Parallel - Independent UI Components)
- [ ] T035 [P] ImageUpload component in `frontend/src/components/ImageUpload.tsx`
  - Implement drag-and-drop interface with react-dropzone
  - Add preview, progress indicators, validation feedback
  - Include file size and format validation

- [ ] T036 [P] PromptInput component in `frontend/src/components/PromptInput.tsx`
  - Implement text input with character counting
  - Add real-time validation and suggestions
  - Include language detection and formatting

- [ ] T037 [P] ResultsDisplay component in `frontend/src/components/ResultsDisplay.tsx`
  - Implement analysis result rendering with markdown support
  - Add per-image analysis breakdown
  - Include export and sharing functionality

- [ ] T038 [P] LoadingSpinner component in `frontend/src/components/LoadingSpinner.tsx`
  - Implement progress indicators with estimated completion time
  - Add cancellation support and error states
  - Include animation and accessibility features

### Frontend Services and Hooks (Parallel - Independent Utilities)
- [ ] T039 [P] API client service in `frontend/src/services/apiClient.ts`
  - Implement axios-based API client with error handling
  - Add request interceptors for session management
  - Include retry logic and timeout configuration

- [ ] T040 [P] File validation service in `frontend/src/services/fileValidator.ts`
  - Implement client-side file validation
  - Add MIME type checking and size validation
  - Include error message generation

- [ ] T041 [P] Custom hooks in `frontend/src/hooks/useAnalysis.ts`
  - Implement analysis state management
  - Add session persistence and history tracking
  - Include error handling and retry logic

---

## Phase 3.4: Integration & Middleware

- [ ] T042 Express.js server setup in `backend/src/app.ts`
  - Depends on T030-T034 (all API routes)
  - Configure middleware: CORS, helmet, rate limiting
  - Add error handling and request logging
  - Set up graceful shutdown and health monitoring

- [ ] T043 React app integration in `frontend/src/App.tsx`
  - Depends on T035-T041 (all components and services)
  - Implement main page layout and routing
  - Add global error boundary and loading states
  - Configure context providers for state management

---

## Phase 3.5: Polish & Validation

- [ ] T044 [P] Unit tests and documentation in `backend/tests/unit/` and `frontend/tests/unit/`
  - Add comprehensive unit test coverage (>80%)
  - Create API documentation and developer guides
  - Add performance monitoring and optimization
  - Update README files with setup and usage instructions

---

## Dependencies

**Setup Dependencies**:
- T001 → T002, T003 (project structure before init)
- T002, T003 → T004, T005 (packages before tooling)

**Test Dependencies**:
- T004, T005 → T006-T020 (infrastructure before tests)
- All tests (T006-T020) must complete before ANY implementation

**Implementation Dependencies**:
- Models (T021-T025) → Services (T026-T029)
- Services (T026-T029) → API Routes (T030-T034)  
- T026 → T032 (FileService before image upload endpoint)
- T027, T029 → T033 (Analysis services before analysis endpoint)
- T028 → T031 (SessionService before session endpoint)
- Components (T035-T038) can run in parallel
- Services/Hooks (T039-T041) can run in parallel

**Integration Dependencies**:
- T030-T034 → T042 (all routes before server setup)
- T035-T041 → T043 (all frontend pieces before app integration)
- T042, T043 → T044 (complete integration before polish)

---

## Parallel Execution Examples

### Phase 3.2 Test Generation (All Parallel)
```bash
# Launch all contract tests together (different files):
Task: "Contract test GET /api/v1/health in backend/tests/contract/health.test.ts"
Task: "Contract test POST /api/v1/session in backend/tests/contract/session.test.ts"
Task: "Contract test POST /api/v1/images in backend/tests/contract/images.test.ts"
Task: "Contract test POST /api/v1/analyze in backend/tests/contract/analyze.test.ts"

# Launch all integration tests together:
Task: "Integration test: Basic multi-image analysis in backend/tests/integration/basic-analysis.test.ts"
Task: "Integration test: File size limits in backend/tests/integration/file-limits.test.ts"
Task: "Integration test: Rate limiting in backend/tests/integration/rate-limits.test.ts"
```

### Phase 3.3 Model Creation (All Parallel)
```bash
# Launch all data models together (independent files):
Task: "Image model in backend/src/models/Image.ts"
Task: "Prompt model in backend/src/models/Prompt.ts"  
Task: "AnalysisRequest model in backend/src/models/AnalysisRequest.ts"
Task: "AnalysisResult model in backend/src/models/AnalysisResult.ts"
Task: "UserSession model in backend/src/models/UserSession.ts"
```

### Phase 3.3 Frontend Components (All Parallel)  
```bash
# Launch all UI components together (independent files):
Task: "ImageUpload component in frontend/src/components/ImageUpload.tsx"
Task: "PromptInput component in frontend/src/components/PromptInput.tsx"
Task: "ResultsDisplay component in frontend/src/components/ResultsDisplay.tsx" 
Task: "LoadingSpinner component in frontend/src/components/LoadingSpinner.tsx"
```

---

## Task Validation Checklist

**Contract Coverage**: ✅
- [x] GET /api/v1/health → T006
- [x] POST /api/v1/session → T007  
- [x] POST /api/v1/images → T008
- [x] POST /api/v1/analyze → T009
- [x] GET /api/v1/analyze/{requestId} → T010
- [x] GET /api/v1/session/{sessionId}/history → T011
- [x] GET /api/v1/export/{requestId} → T012

**Entity Coverage**: ✅
- [x] Image → T021
- [x] Prompt → T022
- [x] AnalysisRequest → T023
- [x] AnalysisResult → T024
- [x] UserSession → T025

**Service Coverage**: ✅
- [x] FileService → T026
- [x] GeminiService → T027
- [x] SessionService → T028
- [x] AnalysisService → T029

**Integration Test Coverage**: ✅
- [x] Quickstart Scenario 1 (Basic Analysis) → T013
- [x] Quickstart Scenario 2 (Comparative Analysis) → T014
- [x] Quickstart Scenario 3 (File Size Limits) → T015
- [x] Quickstart Scenario 4 (Unsupported Formats) → T016
- [x] Quickstart Scenario 5 (Empty Prompts) → Part of T009 contract test
- [x] Quickstart Scenario 6 (Rate Limiting) → T017
- [x] Quickstart Scenario 7 (Session Persistence) → T018
- [x] Quickstart Scenario 8 (Error Recovery) → T019

**Constitutional Compliance**: ✅
- [x] TDD enforced: All tests (T006-T020) before implementation (T021+)
- [x] Library-first: FileService and GeminiService as reusable libraries
- [x] CLI support: Can add CLI wrappers for T026-T029 services  
- [x] Real dependencies: T017, T020 test actual Gemini API
- [x] Parallel optimization: 19 tasks marked [P] for parallel execution

---

## Notes

- **[P] Tasks**: 19 tasks can run in parallel (different files, no dependencies)
- **TDD Compliance**: Tests T006-T020 MUST fail before implementing T021+
- **File Structure**: Follows web app structure from plan.md (backend/ and frontend/)
- **Real API Testing**: Integration tests use actual Gemini API with test keys
- **Performance Targets**: T020 validates <3s upload, <10s analysis requirements
- **Security**: Input validation in T008, T009; API key management in T027
- **Error Handling**: Comprehensive error recovery testing in T019
- **Documentation**: T044 includes API docs, README updates, developer guides

**Total Tasks**: 44 tasks with clear dependencies and parallel execution opportunities