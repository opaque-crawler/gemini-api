import winston from 'winston';
import path from 'path';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const correlationId = meta.correlationId || 'N/A';
    const metaStr = Object.keys(meta).length > (meta.correlationId ? 1 : 0) 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    return `${timestamp} [${correlationId}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');

// Logger configuration
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true,
    }),
    
    // HTTP access log file
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 7,
      tailable: true,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    })
  );
}

// Helper functions for structured logging
export const createLogger = (service: string) => {
  return {
    error: (message: string, meta?: any) =>
      logger.error(message, { service, ...meta }),
    warn: (message: string, meta?: any) =>
      logger.warn(message, { service, ...meta }),
    info: (message: string, meta?: any) =>
      logger.info(message, { service, ...meta }),
    http: (message: string, meta?: any) =>
      logger.http(message, { service, ...meta }),
    debug: (message: string, meta?: any) =>
      logger.debug(message, { service, ...meta }),
  };
};

// Request correlation ID generator
export const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const correlationId = generateCorrelationId();
  req.correlationId = correlationId;
  
  const start = Date.now();
  
  // Log request start
  logger.http('HTTP Request', {
    correlationId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;
    
    logger.http('HTTP Response', {
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Error logging helper
export const logError = (error: Error, correlationId?: string, meta?: any) => {
  logger.error('Application Error', {
    correlationId,
    message: error.message,
    stack: error.stack,
    ...meta,
  });
};

// Performance monitoring helper
export const logPerformance = (operation: string, duration: number, correlationId?: string, meta?: any) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger.log(level, 'Performance Metric', {
    correlationId,
    operation,
    duration: `${duration}ms`,
    ...meta,
  });
};

export default logger;