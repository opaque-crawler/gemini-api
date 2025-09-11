import { createLogger, logError, logPerformance } from './logger';

const logger = createLogger('monitoring');

// Performance monitoring decorator
export function Monitor(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    const correlationId = args[0]?.correlationId || 'unknown';
    
    try {
      logger.debug(`Starting ${target.constructor.name}.${propertyName}`, {
        correlationId,
        args: args.length,
      });
      
      const result = await method.apply(this, args);
      const duration = Date.now() - start;
      
      logPerformance(
        `${target.constructor.name}.${propertyName}`,
        duration,
        correlationId,
        { success: true }
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logError(error as Error, correlationId, {
        method: `${target.constructor.name}.${propertyName}`,
        duration: `${duration}ms`,
      });
      
      logPerformance(
        `${target.constructor.name}.${propertyName}`,
        duration,
        correlationId,
        { success: false, error: (error as Error).message }
      );
      
      throw error;
    }
  };

  return descriptor;
}

// Application metrics tracking
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, any> = new Map();
  private logger = createLogger('metrics');

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // Track request count
  incrementRequestCount(endpoint: string, method: string, statusCode: number) {
    const key = `requests_${method}_${endpoint}_${statusCode}`;
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
  }

  // Track response time
  recordResponseTime(endpoint: string, method: string, duration: number) {
    const key = `response_time_${method}_${endpoint}`;
    const times = this.metrics.get(key) || [];
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
    
    this.metrics.set(key, times);
  }

  // Track memory usage
  recordMemoryUsage() {
    const usage = process.memoryUsage();
    this.metrics.set('memory_usage', {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      timestamp: Date.now(),
    });
  }

  // Get average response time
  getAverageResponseTime(endpoint: string, method: string): number {
    const key = `response_time_${method}_${endpoint}`;
    const times = this.metrics.get(key) || [];
    
    if (times.length === 0) return 0;
    
    const sum = times.reduce((a: number, b: number) => a + b, 0);
    return sum / times.length;
  }

  // Get all metrics
  getAllMetrics() {
    const snapshot = {};
    this.metrics.forEach((value, key) => {
      (snapshot as any)[key] = value;
    });
    return snapshot;
  }

  // Log metrics summary
  logMetricsSummary(correlationId?: string) {
    const metrics = this.getAllMetrics();
    const memoryUsage = (metrics as any).memory_usage;
    const memoryMB = memoryUsage 
      ? Math.round(memoryUsage.heapUsed / 1024 / 1024)
      : 'N/A';
    
    this.logger.info('Metrics Summary', {
      correlationId,
      memoryUsageMB: memoryMB,
      totalMetrics: Object.keys(metrics).length,
      timestamp: new Date().toISOString(),
    });
  }
}

// Express middleware for automatic metrics collection
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const metrics = MetricsCollector.getInstance();
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const endpoint = req.route?.path || req.path;
    
    metrics.incrementRequestCount(endpoint, req.method, res.statusCode);
    metrics.recordResponseTime(endpoint, req.method, duration);
  });
  
  next();
};

// Health check for system resources
export const getSystemHealth = () => {
  const metrics = MetricsCollector.getInstance();
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    },
    uptime: `${Math.round(uptime)}s`,
    processId: process.pid,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    metricsCount: Object.keys(metrics.getAllMetrics()).length,
  };
};

// Error boundary for async functions
export const withErrorHandling = (fn: Function) => {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const correlationId = args[0]?.correlationId || 'unknown';
      logError(error as Error, correlationId, {
        function: fn.name,
        args: args.length,
      });
      throw error;
    }
  };
};