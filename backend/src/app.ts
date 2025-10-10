// Load environment variables FIRST - before any other imports
import { config } from 'dotenv';
config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { createLogger, requestLogger } from './utils/logger';
import { metricsMiddleware, getSystemHealth } from './utils/monitoring';
import { createSession, getSession, checkRateLimit } from './utils/session';
import { analyzeImages as geminiAnalyze } from './services/gemini';
import { startVideoGeneration, checkVideoStatus } from './services/veo3';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize logger
const logger = createLogger('app');

// Simple in-memory storage for development
interface StoredImage {
  id: string;
  sessionId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  uploadedAt: string;
}

interface AnalysisRequest {
  id: string;
  requestId: string;
  sessionId: string;
  imageIds: string[];
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  createdAt: string;
  result?: {
    content: string;
    format: string;
    generatedImages?: Array<{
      mimeType: string;
      data: string;
    }>;
  };
}

const imageStorage = new Map<string, StoredImage>();
const analysisRequests = new Map<string, AnalysisRequest>();
const videoOperations = new Map<string, any>(); // Veo3 operation 객체 저장

// Request logging middleware (before other middleware)
app.use(requestLogger);

// Metrics collection middleware
app.use(metricsMiddleware);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Basic middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check endpoint (OpenAPI contract compliant)
app.get('/api/v1/health', (req: any, res) => {
  logger.info('Health check requested', {
    correlationId: req.correlationId,
  });
  
  // OpenAPI schema specifies only: status, timestamp, version
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// Session creation endpoint (OpenAPI contract compliant)
app.post('/api/v1/session', (req: any, res): any => {
  logger.info('Session creation requested', {
    correlationId: req.correlationId,
  });
  
  try {
    const session = createSession(req.correlationId);
    
    // Return only the fields specified in OpenAPI schema
    res.status(201).json({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      rateLimits: session.rateLimits,
    });
  } catch (error) {
    logger.error('Session creation failed', {
      correlationId: req.correlationId,
      error: (error as Error).message,
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create session',
    });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file (high limit, we'll validate in code)
    files: 10, // Max 10 files (high limit, we'll validate in code)
    parts: 15, // Max form parts
    fieldSize: 1048576, // 1MB per field
    fields: 15, // Max fields
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${file.mimetype}. Only JPEG, PNG, WebP, and GIF are allowed.`));
    }
  }
});

// Image upload endpoint (OpenAPI contract compliant)
app.post('/api/v1/images', (req: any, res, next): any => {
  upload.array('images', 5)(req, res, (err): any => {
    if (err) {
      logger.error('Multer error in image upload', {
        correlationId: req.correlationId,
        error: err.message,
        code: err.code,
      });

      // Handle multer-specific errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'validation_error',
            message: 'File exceeds maximum size limit of 100MB',
            details: ['One or more files exceed the 100MB size limit']
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Too many files uploaded. Maximum of 5 images allowed.',
            details: ['Maximum 5 files allowed per request']
          });
        }
        if (err.code === 'LIMIT_FIELD_VALUE') {
          return res.status(413).json({
            error: 'payload_too_large',
            message: 'Total payload size exceeds limit'
          });
        }
      }

      // Handle file filter errors
      if (err.message.includes('Unsupported file format')) {
        return res.status(400).json({
          error: 'validation_error',
          message: err.message,
          details: ['Only JPEG, PNG, WebP, and GIF formats are supported']
        });
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process file upload',
      });
    }

    // Continue with normal processing
    next();
  });
}, (req: any, res): any => {
  logger.info('Image upload requested', {
    correlationId: req.correlationId,
    sessionId: req.body?.sessionId,
    fileCount: req.files?.length || 0,
  });

  try {
    // Validate sessionId is provided
    if (!req.body.sessionId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId is required',
        details: ['Missing sessionId field in request body']
      });
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.body.sessionId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId must be a valid UUID format',
        details: ['Invalid sessionId format']
      });
    }

    // Validate session exists
    const session = getSession(req.body.sessionId);
    if (!session) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Session not found or invalid',
        details: ['The provided sessionId does not exist']
      });
    }

    // Validate at least one image is provided
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'No files provided',
        details: ['At least one image is required']
      });
    }

    // Validate maximum number of images
    if (req.files.length > 5) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Too many files uploaded. Maximum of 5 images allowed.',
        details: [`${req.files.length} files provided, maximum allowed: 5`]
      });
    }

    // Calculate total size first
    const totalSizeBytes = req.files.reduce((sum: number, file: any) => sum + file.size, 0);

    // Validate total upload size (100MB limit)
    const maxTotalSize = 104857600; // 100MB exactly
    if (totalSizeBytes > maxTotalSize) {
      return res.status(400).json({
        error: 'validation_error',
        message: `Total upload size of ${Math.round(totalSizeBytes / 1024 / 1024)}MB exceeds maximum allowed size of 100MB`,
        details: [`Total size: ${totalSizeBytes} bytes, limit: ${maxTotalSize} bytes`]
      });
    }

    // Then validate individual file sizes
    const maxFileSize = 104857600; // 100MB exactly
    for (const file of req.files) {
      if (file.size > maxFileSize) {
        return res.status(400).json({
          error: 'validation_error',
          message: `File ${file.originalname} exceeds maximum size limit of 100MB`,
          details: [`File size: ${file.size} bytes, limit: ${maxFileSize} bytes`]
        });
      }
    }

    // Process files and create ImageMetadata objects
    const images = req.files.map((file: any) => {
      const imageId = randomUUID();
      
      // Store image in memory storage
      const storedImage: StoredImage = {
        id: imageId,
        sessionId: req.body.sessionId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
        uploadedAt: new Date().toISOString(),
      };
      
      imageStorage.set(imageId, storedImage);
      
      return {
        id: imageId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        dimensions: {
          width: null, // Would be filled by image processing
          height: null // Would be filled by image processing
        }
      };
    });

    logger.info('Images uploaded successfully', {
      correlationId: req.correlationId,
      sessionId: req.body.sessionId,
      imageCount: images.length,
      totalSizeBytes,
      imageIds: images.map((img: { id: string }) => img.id),
    });

    // Return OpenAPI compliant response
    res.status(201).json({
      images,
      totalSizeBytes,
      sessionId: req.body.sessionId,
    });

  } catch (error) {
    logger.error('Image upload failed', {
      correlationId: req.correlationId,
      sessionId: req.body?.sessionId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process image upload',
    });
  }
});

// Analysis endpoint (OpenAPI contract compliant)
app.post('/api/v1/analyze', async (req: any, res): Promise<any> => {
  logger.info('Analysis request received', {
    correlationId: req.correlationId,
    sessionId: req.body?.sessionId,
    imageCount: req.body?.imageIds?.length || 0,
  });

  try {
    // Validate request body exists and is JSON
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Request body must be valid JSON',
        details: ['Invalid or missing JSON body']
      });
    }

    // Validate sessionId is provided
    if (!req.body.sessionId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId is required',
        details: ['Missing sessionId field in request body']
      });
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.body.sessionId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId must be a valid UUID format',
        details: ['Invalid sessionId format']
      });
    }

    // Validate session exists
    const session = getSession(req.body.sessionId);
    if (!session) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Session not found or invalid',
        details: ['The provided sessionId does not exist']
      });
    }

    // Check rate limits
    const requestRateCheck = checkRateLimit(req.body.sessionId, 'requests', 1, req.correlationId);
    if (!requestRateCheck.allowed) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
        retryAfter: 60,
        limits: requestRateCheck.session?.rateLimits || session.rateLimits,
        timestamp: new Date().toISOString()
      });
    }

    // imageIds는 선택적 (텍스트만 분석도 가능)
    const imageIds = req.body.imageIds || [];

    // Validate imageIds if provided
    if (imageIds.length > 0) {
      // Validate imageIds is array
      if (!Array.isArray(imageIds)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'imageIds must be an array',
          details: ['imageIds field must be an array of UUID strings']
        });
      }

      if (imageIds.length > 5) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Maximum 5 imageIds allowed per request',
          details: [`Received ${imageIds.length} imageIds, maximum allowed is 5`]
        });
      }

      // Validate each imageId format and existence
      for (const imageId of imageIds) {
        if (!uuidRegex.test(imageId)) {
          return res.status(400).json({
            error: 'validation_error',
            message: `ImageId ${imageId} must be a valid UUID format`,
            details: ['Invalid imageId format']
          });
        }

        // Check if image exists in storage
        const storedImage = imageStorage.get(imageId);
        if (!storedImage) {
          return res.status(400).json({
            error: 'validation_error',
            message: `Image with id ${imageId} not found`,
            details: ['One or more imageIds do not exist']
          });
        }

        // Verify image belongs to the session
        if (storedImage.sessionId !== req.body.sessionId) {
          return res.status(400).json({
            error: 'validation_error',
            message: `Image with id ${imageId} does not belong to this session`,
            details: ['Images can only be analyzed within their upload session']
          });
        }
      }
    }

    // Validate prompt is provided
    if (!req.body.prompt) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'prompt is required',
        details: ['Missing prompt field in request body']
      });
    }

    // Validate prompt is string and not empty
    if (typeof req.body.prompt !== 'string' || req.body.prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'prompt must be a non-empty string',
        details: ['Prompt field must contain text']
      });
    }

    // Validate prompt length
    if (req.body.prompt.length > 2000) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'prompt exceeds maximum length of 2000 characters',
        details: [`Prompt length: ${req.body.prompt.length}, maximum allowed: 2000`]
      });
    }

    // Prepare image data for Gemini API (if images provided)
    const imageData = imageIds.map((imageId: string) => {
      const storedImage = imageStorage.get(imageId)!;
      return {
        id: storedImage.id,
        mimeType: storedImage.mimeType,
        buffer: storedImage.buffer,
        originalName: storedImage.originalName,
      };
    });

    // Call Gemini API (텍스트만 또는 텍스트+이미지)
    const geminiResult = await geminiAnalyze({
      prompt: req.body.prompt,
      images: imageData,
      correlationId: req.correlationId,
    });

    // Create analysis request
    const analysisId = randomUUID();
    const requestId = randomUUID();

    // Build result object conditionally to satisfy exactOptionalPropertyTypes
    const resultObj: any = {
      content: geminiResult.content,
      format: geminiResult.format,
    };

    if (geminiResult.generatedImages && geminiResult.generatedImages.length > 0) {
      resultObj.generatedImages = geminiResult.generatedImages;
    }

    const analysisRequest: AnalysisRequest = {
      id: analysisId,
      requestId: requestId,
      sessionId: req.body.sessionId,
      imageIds: imageIds,
      prompt: req.body.prompt,
      status: 'completed',
      createdAt: new Date().toISOString(),
      result: resultObj
    };

    analysisRequests.set(requestId, analysisRequest);

    logger.info('Analysis completed', {
      correlationId: req.correlationId,
      sessionId: req.body.sessionId,
      requestId: requestId,
      imageCount: imageIds.length,
      promptLength: req.body.prompt.length,
      tokensUsed: geminiResult.tokensUsed,
      generatedImagesCount: geminiResult.generatedImages?.length || 0,
    });

    // Return completed analysis (200 response)
    const response: any = {
      id: analysisId,
      requestId: requestId,
      status: 'completed',
      content: analysisRequest.result!.content,
      format: analysisRequest.result!.format,
    };

    if (geminiResult.generatedImages && geminiResult.generatedImages.length > 0) {
      response.generatedImages = geminiResult.generatedImages;
    }

    res.status(200).json(response);

  } catch (error) {
    logger.error('Analysis request failed', {
      correlationId: req.correlationId,
      sessionId: req.body?.sessionId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process analysis request',
    });
  }
});

// Analysis status/result retrieval endpoint (OpenAPI contract compliant)
app.get('/api/v1/analyze/:requestId', (req: any, res): any => {
  logger.info('Analysis status/result requested', {
    correlationId: req.correlationId,
    requestId: req.params.requestId,
  });

  try {
    const requestId = req.params.requestId;

    // Validate requestId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'requestId must be a valid UUID format',
        details: ['Invalid requestId format']
      });
    }

    // Check if analysis request exists
    const analysisRequest = analysisRequests.get(requestId);
    if (!analysisRequest) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Analysis request not found',
      });
    }

    logger.info('Analysis status retrieved', {
      correlationId: req.correlationId,
      requestId: requestId,
      status: analysisRequest.status,
    });

    // Return completed analysis (200 response) - for testing, all are immediately completed
    if (analysisRequest.status === 'completed' && analysisRequest.result) {
      res.status(200).json({
        id: analysisRequest.id,
        requestId: analysisRequest.requestId,
        status: analysisRequest.status,
        content: analysisRequest.result.content,
        format: analysisRequest.result.format,
      });
    } else {
      // Return status information (202 response) for processing/pending requests
      res.status(202).json({
        requestId: analysisRequest.requestId,
        status: analysisRequest.status,
        estimatedCompletionTime: new Date(Date.now() + 30000).toISOString(), // 30 seconds estimate
        progressPercent: analysisRequest.status === 'pending' ? 0 : 
                        analysisRequest.status === 'processing' ? 50 : 100,
      });
    }

  } catch (error) {
    logger.error('Analysis status request failed', {
      correlationId: req.correlationId,
      requestId: req.params.requestId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve analysis status',
    });
  }
});

// Session history endpoint (OpenAPI contract compliant)
app.get('/api/v1/session/:sessionId/history', (req: any, res): any => {
  logger.info('Session history requested', {
    correlationId: req.correlationId,
    sessionId: req.params.sessionId,
    limit: req.query.limit,
  });

  try {
    const sessionId = req.params.sessionId;
    const limit = req.query.limit;

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId must be a valid UUID format',
      });
    }

    // Validate session exists
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Session not found',
      });
    }

    // Validate limit parameter if provided
    let parsedLimit = 10; // Default limit
    if (limit !== undefined) {
      const limitNum = parseInt(limit as string, 10);
      
      if (isNaN(limitNum)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'limit parameter must be a valid number',
        });
      }
      
      if (limitNum < 1 || limitNum > 50) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'limit parameter must be between 1 and 50',
        });
      }
      
      parsedLimit = limitNum;
    }

    // Get all analysis requests for this session
    const sessionAnalyses: AnalysisRequest[] = [];
    for (const [requestId, analysisRequest] of analysisRequests.entries()) {
      if (analysisRequest.sessionId === sessionId) {
        sessionAnalyses.push(analysisRequest);
      }
    }

    // Sort by creation time (newest first)
    sessionAnalyses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const totalCount = sessionAnalyses.length;
    const paginatedAnalyses = sessionAnalyses.slice(0, parsedLimit);
    const hasMore = totalCount > parsedLimit;

    // Convert to AnalysisResponse format
    const analyses = paginatedAnalyses.map(analysis => ({
      id: analysis.id,
      requestId: analysis.requestId,
      status: analysis.status,
      content: analysis.result?.content || '',
      format: analysis.result?.format || 'plaintext',
    }));

    logger.info('Session history retrieved', {
      correlationId: req.correlationId,
      sessionId: sessionId,
      totalCount,
      returnedCount: analyses.length,
      hasMore,
    });

    // Return HistoryResponse
    res.status(200).json({
      sessionId: sessionId,
      analyses: analyses,
      totalCount: totalCount,
      hasMore: hasMore,
    });

  } catch (error) {
    logger.error('Session history request failed', {
      correlationId: req.correlationId,
      sessionId: req.params.sessionId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve session history',
    });
  }
});

// Export analysis result endpoint (OpenAPI contract compliant)
app.get('/api/v1/export/:requestId', (req: any, res): any => {
  logger.info('Export analysis result requested', {
    correlationId: req.correlationId,
    requestId: req.params.requestId,
    format: req.query.format,
  });

  try {
    const requestId = req.params.requestId;
    const format = (req.query.format as string || 'json').toLowerCase();

    // Validate requestId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'requestId must be a valid UUID format',
      });
    }

    // Validate format parameter
    const supportedFormats = ['json', 'markdown', 'txt'];
    if (!supportedFormats.includes(format)) {
      return res.status(400).json({
        error: 'validation_error',
        message: `Format '${format}' is not supported. Supported formats: ${supportedFormats.join(', ')}`,
      });
    }

    // Check if analysis request exists
    const analysisRequest = analysisRequests.get(requestId);
    if (!analysisRequest) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Analysis request not found',
      });
    }

    // Ensure analysis is completed
    if (analysisRequest.status !== 'completed' || !analysisRequest.result) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Analysis result not found or not completed',
      });
    }

    const analysisResult = {
      id: analysisRequest.id,
      requestId: analysisRequest.requestId,
      status: analysisRequest.status,
      content: analysisRequest.result.content,
      format: analysisRequest.result.format,
    };

    logger.info('Export analysis result retrieved', {
      correlationId: req.correlationId,
      requestId: requestId,
      format: format,
      contentLength: analysisResult.content.length,
    });

    // Return based on requested format
    if (format === 'json') {
      // JSON format (default)
      res.status(200)
        .header('Content-Type', 'application/json')
        .json(analysisResult);
    } else if (format === 'markdown') {
      // Markdown format
      const markdownContent = `# Analysis Result

**Request ID**: ${analysisResult.requestId}
**Status**: ${analysisResult.status}
**Format**: ${analysisResult.format}

## Content

${analysisResult.content}

---
*Generated on ${new Date().toISOString()}*`;

      res.status(200)
        .header('Content-Type', 'text/markdown')
        .header('Content-Disposition', `attachment; filename="analysis-${requestId}.md"`)
        .send(markdownContent);
    } else if (format === 'txt') {
      // Plain text format
      const textContent = `Analysis Result
===============

Request ID: ${analysisResult.requestId}
Status: ${analysisResult.status}
Format: ${analysisResult.format}

Content:
${analysisResult.content}

Generated on ${new Date().toISOString()}`;

      res.status(200)
        .header('Content-Type', 'text/plain')
        .header('Content-Disposition', `attachment; filename="analysis-${requestId}.txt"`)
        .send(textContent);
    }

  } catch (error) {
    logger.error('Export analysis result failed', {
      correlationId: req.correlationId,
      requestId: req.params.requestId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export analysis result',
    });
  }
});

// Metrics endpoint for monitoring
app.get('/api/v1/metrics', (req: any, res) => {
  logger.info('Metrics requested', {
    correlationId: req.correlationId,
  });

  const systemHealth = getSystemHealth();

  res.json({
    timestamp: new Date().toISOString(),
    system: systemHealth,
    correlationId: req.correlationId,
  });
});

// ========== Veo3 Video Generation Endpoints ==========

// Video generation start endpoint
app.post('/api/v1/videos/generate', async (req: any, res): Promise<any> => {
  logger.info('Video generation request received', {
    correlationId: req.correlationId,
    sessionId: req.body?.sessionId,
    hasImage: !!req.body?.imageId,
  });

  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Request body must be valid JSON',
        details: ['Invalid or missing JSON body']
      });
    }

    // Validate sessionId
    if (!req.body.sessionId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId is required',
        details: ['Missing sessionId field in request body']
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.body.sessionId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'sessionId must be a valid UUID format',
        details: ['Invalid sessionId format']
      });
    }

    // Validate session exists
    const session = getSession(req.body.sessionId);
    if (!session) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Session not found or invalid',
        details: ['The provided sessionId does not exist']
      });
    }

    // Check rate limits
    const requestRateCheck = checkRateLimit(req.body.sessionId, 'requests', 1, req.correlationId);
    if (!requestRateCheck.allowed) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
        retryAfter: 60,
        limits: requestRateCheck.session?.rateLimits || session.rateLimits,
        timestamp: new Date().toISOString()
      });
    }

    // Validate prompt
    if (!req.body.prompt) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'prompt is required',
        details: ['Missing prompt field in request body']
      });
    }

    if (typeof req.body.prompt !== 'string' || req.body.prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'prompt must be a non-empty string',
        details: ['Prompt field must contain text']
      });
    }

    if (req.body.prompt.length > 2000) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'prompt exceeds maximum length of 2000 characters',
        details: [`Prompt length: ${req.body.prompt.length}, maximum allowed: 2000`]
      });
    }

    // Prepare image data if provided
    let imageData: { mimeType: string; data: string } | undefined;
    if (req.body.imageId) {
      if (!uuidRegex.test(req.body.imageId)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'imageId must be a valid UUID format',
          details: ['Invalid imageId format']
        });
      }

      const storedImage = imageStorage.get(req.body.imageId);
      if (!storedImage) {
        return res.status(400).json({
          error: 'validation_error',
          message: `Image with id ${req.body.imageId} not found`,
          details: ['The provided imageId does not exist']
        });
      }

      if (storedImage.sessionId !== req.body.sessionId) {
        return res.status(400).json({
          error: 'validation_error',
          message: `Image with id ${req.body.imageId} does not belong to this session`,
          details: ['Images can only be used within their upload session']
        });
      }

      imageData = {
        mimeType: storedImage.mimeType,
        data: storedImage.buffer.toString('base64'),
      };
    }

    // Validate optional parameters
    const model = req.body.model || 'veo-3.0-generate-001';
    if (!['veo-3.0-generate-001', 'veo-3.0-fast-generate-001', 'veo-2.0-generate-001'].includes(model)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'model must be one of: "veo-3.0-generate-001", "veo-3.0-fast-generate-001", "veo-2.0-generate-001"',
        details: ['Invalid model value']
      });
    }

    const aspectRatio = req.body.aspectRatio || '16:9';
    if (!['16:9', '9:16'].includes(aspectRatio)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'aspectRatio must be either "16:9" or "9:16"',
        details: ['Invalid aspectRatio value']
      });
    }

    const resolution = req.body.resolution || '720p';
    if (!['720p', '1080p'].includes(resolution)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'resolution must be either "720p" or "1080p"',
        details: ['Invalid resolution value']
      });
    }

    // Start video generation
    const generationOptions: any = {
      prompt: req.body.prompt,
      model: model as 'veo-3.0-generate-001' | 'veo-3.0-fast-generate-001' | 'veo-2.0-generate-001',
      aspectRatio: aspectRatio as '16:9' | '9:16',
      resolution: resolution as '720p' | '1080p',
      correlationId: req.correlationId,
    };

    if (req.body.negativePrompt) {
      generationOptions.negativePrompt = req.body.negativePrompt;
    }

    if (imageData) {
      generationOptions.image = imageData;
    }

    const result = await startVideoGeneration(generationOptions);

    // Operation 객체 저장 (상태 확인 시 사용)
    if (result.operation) {
      videoOperations.set(result.operationId, result.operation);
    }

    logger.info('Video generation started', {
      correlationId: req.correlationId,
      sessionId: req.body.sessionId,
      operationId: result.operationId,
      status: result.status,
    });

    res.status(202).json({
      operationId: result.operationId,
      status: result.status,
      estimatedCompletionTime: result.estimatedCompletionTime,
      message: 'Video generation started. Use the operation ID to check status.',
    });

  } catch (error) {
    logger.error('Video generation request failed', {
      correlationId: req.correlationId,
      sessionId: req.body?.sessionId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start video generation',
    });
  }
});

// Video generation status endpoint
app.get('/api/v1/videos/status/:operationId', async (req: any, res): Promise<any> => {
  logger.info('Video status check requested', {
    correlationId: req.correlationId,
    operationId: req.params.operationId,
  });

  try {
    // URL 디코딩 처리 (operationId에 슬래시가 포함되어 있을 수 있음)
    const operationId = decodeURIComponent(req.params.operationId);

    if (!operationId || operationId.trim().length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'operationId is required',
        details: ['Missing operationId parameter']
      });
    }

    // 저장된 operation 객체 찾기
    const storedOperation = videoOperations.get(operationId);
    if (!storedOperation) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Video operation not found',
        details: ['The provided operationId does not exist or has expired']
      });
    }

    // Check video status (저장된 operation 전달)
    const result = await checkVideoStatus(storedOperation, req.correlationId);

    // 업데이트된 operation 저장
    if (result.operation) {
      videoOperations.set(result.operationId, result.operation);
    }

    logger.info('Video status retrieved', {
      correlationId: req.correlationId,
      operationId: operationId,
      status: result.status,
    });

    if (result.status === 'completed') {
      res.status(200).json({
        operationId: result.operationId,
        status: result.status,
        videoUrl: result.videoUrl,
        mimeType: result.mimeType,
      });
    } else if (result.status === 'failed') {
      res.status(200).json({
        operationId: result.operationId,
        status: result.status,
        error: result.error,
      });
    } else {
      res.status(202).json({
        operationId: result.operationId,
        status: result.status,
        estimatedCompletionTime: result.estimatedCompletionTime,
      });
    }

  } catch (error) {
    logger.error('Video status check failed', {
      correlationId: req.correlationId,
      operationId: req.params.operationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check video status',
    });
  }
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Backend server started', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      healthCheck: `http://localhost:${PORT}/api/v1/health`,
    });
  });
}

export default app;
