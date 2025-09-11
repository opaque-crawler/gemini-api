import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { createLogger, requestLogger } from './utils/logger';
import { metricsMiddleware, getSystemHealth } from './utils/monitoring';

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
