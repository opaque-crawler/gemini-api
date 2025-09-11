# Data Model: Google Gemini Multi-Image Analysis Web App

**Date**: 2025-09-10  
**Status**: Complete  
**Based on**: Feature specification and research findings

## Core Entities

### Image Entity
**Purpose**: Represents an uploaded image file with metadata and validation state

```typescript
interface Image {
  id: string;                    // Unique identifier (UUID)
  originalName: string;          // User's filename
  mimeType: string;             // MIME type (image/jpeg, image/png, etc.)
  sizeBytes: number;            // File size in bytes
  dimensions: {
    width: number;
    height: number;
  };
  uploadedAt: Date;             // Timestamp of upload
  tempFilePath: string;         // Server temporary file location
  status: 'uploading' | 'ready' | 'processing' | 'error';
  validationErrors?: string[];   // Any validation issues
}
```

**Validation Rules**:
- `mimeType`: Must be one of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
- `sizeBytes`: Must be ≤ 5MB (5,242,880 bytes)
- `dimensions`: Both width and height must be > 0
- `originalName`: Must not contain path separators, max 255 characters
- `tempFilePath`: Must be within designated temp directory

**State Transitions**:
- uploading → ready (successful upload and validation)
- uploading → error (validation failure or upload error)
- ready → processing (included in analysis request)
- processing → ready (analysis complete, available for reuse)

### Prompt Entity
**Purpose**: Represents user's text instruction for image analysis

```typescript
interface Prompt {
  id: string;                   // Unique identifier (UUID)
  content: string;              // User's prompt text
  createdAt: Date;              // Timestamp of creation
  language?: string;            // Detected/specified language code
  tokenCount?: number;          // Estimated token count
  sanitized: boolean;           // Has been content-filtered
}
```

**Validation Rules**:
- `content`: Must be 1-2000 characters, non-empty after trim
- `language`: ISO 639-1 language code if specified
- `tokenCount`: Estimated using GPT tokenizer for budget planning
- Content filtering: Remove harmful/inappropriate content

### AnalysisRequest Entity
**Purpose**: Represents a complete analysis request with images and prompt

```typescript
interface AnalysisRequest {
  id: string;                   // Unique identifier (UUID)
  sessionId: string;            // Browser session identifier
  imageIds: string[];           // References to Image entities
  promptId: string;             // Reference to Prompt entity
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  createdAt: Date;              // Request timestamp
  completedAt?: Date;           // Completion timestamp
  totalSizeBytes: number;       // Sum of all image file sizes
  estimatedTokens: number;      // Token count estimation
}
```

**Validation Rules**:
- `imageIds`: 1-5 valid image IDs, all images must be in 'ready' state
- `totalSizeBytes`: Must be ≤ 20MB (API constraint)
- `estimatedTokens`: Must be within rate limit allowance
- `sessionId`: Valid session from browser

**State Transitions**:
- pending → processing (sent to Gemini API)
- processing → completed (successful response)
- processing → failed (API error, timeout)
- processing → partial (some images failed, some succeeded)

### AnalysisResult Entity
**Purpose**: Represents the AI-generated analysis response

```typescript
interface AnalysisResult {
  id: string;                   // Unique identifier (UUID)
  requestId: string;            // Reference to AnalysisRequest
  content: string;              // AI-generated analysis text
  format: 'markdown' | 'plaintext';  // Content format
  imageAnalyses: ImageAnalysis[]; // Per-image breakdown
  metadata: {
    model: string;              // Gemini model used
    tokensUsed: number;         // Actual tokens consumed
    processingTimeMs: number;   // Response time
    generatedAt: Date;          // API response timestamp
  };
  confidence?: number;          // API confidence score if available
  safetyRatings?: SafetyRating[]; // Content safety assessment
}
```

**Validation Rules**:
- `content`: Non-empty string, max 10,000 characters
- `format`: Must be valid format type
- `imageAnalyses`: Length must match number of processed images
- `metadata.tokensUsed`: Must be positive integer
- `metadata.processingTimeMs`: Must be positive integer

### ImageAnalysis Entity (Nested)
**Purpose**: Analysis results specific to individual images

```typescript
interface ImageAnalysis {
  imageId: string;              // Reference to Image entity
  analysis: string;             // Image-specific analysis text
  confidence?: number;          // Confidence score for this image
  detectedObjects?: string[];   // List of detected objects/entities
  status: 'success' | 'failed' | 'skipped';
  error?: string;               // Error message if failed
}
```

### UserSession Entity
**Purpose**: Maintains state for browser session

```typescript
interface UserSession {
  id: string;                   // Session identifier
  createdAt: Date;              // Session start time
  lastActivityAt: Date;         // Last request timestamp
  analysisHistory: string[];    // List of AnalysisRequest IDs
  preferences?: {
    language?: string;          // Preferred UI language
    exportFormat?: string;      // Preferred export format
  };
  rateLimitState: {
    requestCount: number;       // Requests in current minute
    tokenCount: number;         // Tokens used in current minute
    resetAt: Date;              // Rate limit reset timestamp
  };
}
```

## Data Relationships

### Primary Relationships
```
UserSession (1) ←→ (many) AnalysisRequest
AnalysisRequest (1) ←→ (many) Image
AnalysisRequest (1) ←→ (1) Prompt
AnalysisRequest (1) ←→ (0..1) AnalysisResult
AnalysisResult (1) ←→ (many) ImageAnalysis
ImageAnalysis (1) ←→ (1) Image
```

### Dependency Flow
```
Image Upload → Image Entity (validation)
User Input → Prompt Entity (sanitization)
Submit Request → AnalysisRequest Entity (aggregation)
API Processing → AnalysisResult Entity (response parsing)
Results Display → ImageAnalysis entities (per-image details)
```

## Storage Strategy

### Temporary Files (Images)
- **Location**: `/tmp/nano-images/[session-id]/`
- **TTL**: 1 hour from upload
- **Cleanup**: Automatic via cron job + request completion
- **Format**: Original format preserved during processing

### Session Data
- **Storage**: In-memory session store (development) / Redis (production)
- **TTL**: 24 hours from last activity
- **Persistence**: None - stateless across server restarts

### Results Caching
- **Key**: Hash of (imageIds + promptId)
- **TTL**: 1 hour for identical requests
- **Storage**: In-memory cache (development) / Redis (production)

## Validation Framework

### Pre-Upload Validation (Client)
```typescript
validateImage(file: File): ValidationResult {
  const errors: string[] = [];
  
  // Size validation
  if (file.size > 5_242_880) {
    errors.push('Image must be smaller than 5MB');
  }
  
  // Format validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    errors.push('Unsupported image format');
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Server-Side Validation
```typescript
validateAnalysisRequest(request: AnalysisRequest): ValidationResult {
  const errors: string[] = [];
  
  // Image count validation
  if (request.imageIds.length === 0) {
    errors.push('At least one image required');
  }
  if (request.imageIds.length > 5) {
    errors.push('Maximum 5 images allowed');
  }
  
  // Total size validation
  if (request.totalSizeBytes > 20_971_520) {
    errors.push('Total request size exceeds 20MB limit');
  }
  
  // Rate limit validation
  // ... implementation details
  
  return { valid: errors.length === 0, errors };
}
```

## Error Handling States

### Image Processing Errors
- **Upload Failure**: Network interruption, server error
- **Validation Failure**: Invalid format, size exceeded
- **Processing Failure**: API rejection, corruption detected

### Analysis Request Errors
- **Rate Limit Exceeded**: Too many requests, token limit reached
- **API Error**: Service unavailable, authentication failure
- **Timeout**: Request exceeded maximum processing time
- **Partial Failure**: Some images processed, others failed

### Data Consistency
- **Orphaned Images**: Cleanup via TTL expiration
- **Failed Requests**: Status tracking prevents indefinite processing state
- **Session Expiry**: Graceful degradation with client-side storage

## Performance Considerations

### Memory Management
- Stream image uploads directly to temp files
- Process images individually to limit memory usage
- Clean up temporary data immediately after API response

### Database Queries (Future)
- Index on `sessionId` for user history retrieval
- Index on `createdAt` for cleanup operations
- Composite index on (`imageIds`, `promptId`) for cache lookups

## Security & Privacy

### Data Protection
- No persistent image storage - all data deleted after processing
- Session isolation - users cannot access other sessions' data
- API key never exposed to client-side code

### Input Sanitization
- Prompt content filtered for harmful material
- File upload restricted to image MIME types only
- Path traversal protection on all file operations

**Status**: Ready for contract generation and testing implementation