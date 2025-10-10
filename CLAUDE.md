# nano Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-10

## Active Technologies
- **JavaScript/TypeScript**: Node.js 18+, React 18+ (001-2025-9-google)
- **Backend**: Express.js, Google Gemini API SDK, Multer (001-2025-9-google)
- **Frontend**: React, react-dropzone for file uploads (001-2025-9-google)
- **Testing**: Jest (unit), Cypress (E2E), Supertest (API) (001-2025-9-google)

## Project Structure
```
backend/
├── src/
│   ├── models/          # Image, Prompt, AnalysisResult entities
│   ├── services/        # GeminiService, FileService
│   ├── api/            # Express routes and middleware
│   └── lib/            # Core libraries (image-analyzer, file-handler)
├── tests/
│   ├── contract/       # API contract tests
│   ├── integration/    # Service integration tests
│   └── unit/          # Library unit tests
└── cli/               # CLI tools for libraries

frontend/
├── src/
│   ├── components/     # ImageUpload, PromptInput, ResultsDisplay
│   ├── pages/         # Main analysis page
│   ├── services/      # API client, file validation
│   └── hooks/         # Custom React hooks
├── tests/
│   ├── integration/   # Component integration tests
│   └── unit/         # Component unit tests
└── public/           # Static assets
```

## API Specifications
- **OpenAPI**: See `/specs/001-2025-9-google/contracts/api.yaml`
- **Base URL**: `http://localhost:3000/api/v1` (development)
- **Authentication**: Session-based with X-Session-ID header
- **Rate Limits**: 10 RPM, 250K TPM (Gemini Free Tier)

## Key Constraints
- **Images**: Max 5 per request, 5MB per image, 20MB total
- **Formats**: JPEG, PNG, WebP, GIF only
- **Prompts**: 1-2000 characters
- **Storage**: Temporary files only (1-hour TTL)
- **Performance**: <10s analysis time, <3s upload time

## Testing Strategy
- **TDD Approach**: Tests written first, must fail before implementation
- **Contract Tests**: API endpoint validation with OpenAPI specs
- **Integration Tests**: Real Gemini API calls with test data
- **E2E Tests**: Complete user journeys with Cypress

## Commands
```bash
# Backend development
cd backend && npm run dev

# Frontend development  
cd frontend && npm start

# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# API contract validation
npm run test:contracts
```

## Code Style
- **TypeScript**: Strict mode enabled, explicit types preferred
- **React**: Functional components with hooks
- **API**: RESTful conventions, consistent error responses
- **Files**: Kebab-case for files, PascalCase for components
- **Error Handling**: Structured errors with proper HTTP status codes

## Security Guidelines
- **API Keys**: Server-side only, never exposed to client
- **File Uploads**: MIME type validation, malware scanning
- **Input Sanitization**: Prompt content filtering
- **Session Management**: Secure session IDs, automatic cleanup
- **Rate Limiting**: Per-session and global rate limits

## Performance Targets
- **Upload**: <3s per image
- **Analysis**: <10s total processing
- **Memory**: <100MB client-side for 5 images
- **Concurrent Users**: 10 users supported initially

## Deployment
- **Development**: Docker Compose with hot reload
- **Production**: Container registry deployment
- **Environment**: Environment variable configuration
- **Monitoring**: Structured logging with Winston

## Recent Changes
- 001-2025-9-google: Added multi-image analysis web application with Google Gemini API integration

<!-- MANUAL ADDITIONS START -->
<!-- Add any manual configuration or project-specific notes here -->
<!-- MANUAL ADDITIONS END -->