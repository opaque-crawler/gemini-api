import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { createLogger, requestLogger } from './utils/logger';
import { metricsMiddleware, getSystemHealth } from './utils/monitoring';
import { createSession, getSession } from './utils/session';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize logger
const logger = createLogger('app');

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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.post('/api/v1/session', (req: any, res) => {
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
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create session',
    });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB per file
    files: parseInt(process.env.MAX_FILES || '5'), // Max 5 files
    parts: 10, // Max form parts
    fieldSize: 1048576, // 1MB per field
    fields: 10, // Max fields
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
            message: 'File size exceeds limit',
            details: ['One or more files exceed the 5MB size limit']
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Too many files',
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
        message: 'At least one image is required',
        details: ['No images provided in request']
      });
    }

    // Validate maximum number of images
    if (req.files.length > 5) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Maximum 5 images allowed per request',
        details: [`Received ${req.files.length} images, maximum allowed is 5`]
      });
    }

    // Calculate total size first
    let totalSizeBytes = 0;
    for (const file of req.files) {
      totalSizeBytes += file.size;
    }

    // Validate total payload size first (20MB limit)
    const maxTotalSize = 20971520; // 20MB
    if (totalSizeBytes > maxTotalSize) {
      return res.status(413).json({
        error: 'payload_too_large',
        message: 'Total payload size exceeds 20MB limit'
      });
    }

    // Then validate individual file sizes
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB
    for (const file of req.files) {
      if (file.size > maxFileSize) {
        return res.status(400).json({
          error: 'validation_error',
          message: `File ${file.originalname} exceeds maximum size limit of 5MB`,
          details: [`File size: ${file.size} bytes, limit: ${maxFileSize} bytes`]
        });
      }
    }

    // Process files and create ImageMetadata objects
    const images = req.files.map((file: any) => ({
      id: randomUUID(),
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      dimensions: {
        width: null, // Would be filled by image processing
        height: null // Would be filled by image processing
      }
    }));

    logger.info('Images uploaded successfully', {
      correlationId: req.correlationId,
      sessionId: req.body.sessionId,
      imageCount: images.length,
      totalSizeBytes,
      imageIds: images.map((img: any) => img.id),
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
