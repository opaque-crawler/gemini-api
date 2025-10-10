import { randomUUID } from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('session');

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface RateLimits {
  requestsPerMinute: RateLimitInfo;
  tokensPerMinute: RateLimitInfo;
}

export interface Session {
  sessionId: string;
  createdAt: string;
  rateLimits: RateLimits;
}

// Environment configuration for rate limits
const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_REQUESTS || '10'),
  TOKENS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_TOKENS || '250000'),
};

// Simple in-memory session store (for development)
// In production, this would use Redis or database
const sessions = new Map<string, Session>();

/**
 * Generate next minute boundary for rate limit reset
 */
function getNextMinuteBoundary(): string {
  const now = new Date();
  const nextMinute = new Date(now);
  nextMinute.setSeconds(0, 0);
  nextMinute.setMinutes(nextMinute.getMinutes() + 1);
  return nextMinute.toISOString();
}

/**
 * Create initial rate limit configuration
 */
function createInitialRateLimits(): RateLimits {
  const resetAt = getNextMinuteBoundary();
  
  return {
    requestsPerMinute: {
      limit: RATE_LIMITS.REQUESTS_PER_MINUTE,
      remaining: RATE_LIMITS.REQUESTS_PER_MINUTE,
      resetAt,
    },
    tokensPerMinute: {
      limit: RATE_LIMITS.TOKENS_PER_MINUTE,
      remaining: RATE_LIMITS.TOKENS_PER_MINUTE,
      resetAt,
    },
  };
}

/**
 * Create a new user session
 */
export function createSession(correlationId?: string): Session {
  const sessionId = randomUUID();
  const createdAt = new Date().toISOString();
  const rateLimits = createInitialRateLimits();

  const session: Session = {
    sessionId,
    createdAt,
    rateLimits,
  };

  // Store session (in production, this would be persisted)
  sessions.set(sessionId, session);

  logger.info('Session created', {
    correlationId,
    sessionId,
    requestLimits: rateLimits.requestsPerMinute,
    tokenLimits: rateLimits.tokensPerMinute,
  });

  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) || null;
}

/**
 * Update session rate limits
 */
export function updateSessionRateLimits(
  sessionId: string,
  updates: Partial<RateLimits>,
  correlationId?: string
): Session | null {
  const session = sessions.get(sessionId);
  if (!session) {
    logger.warn('Session not found for rate limit update', {
      correlationId,
      sessionId,
    });
    return null;
  }

  // Update rate limits
  if (updates.requestsPerMinute) {
    session.rateLimits.requestsPerMinute = {
      ...session.rateLimits.requestsPerMinute,
      ...updates.requestsPerMinute,
    };
  }

  if (updates.tokensPerMinute) {
    session.rateLimits.tokensPerMinute = {
      ...session.rateLimits.tokensPerMinute,
      ...updates.tokensPerMinute,
    };
  }

  sessions.set(sessionId, session);

  logger.debug('Session rate limits updated', {
    correlationId,
    sessionId,
    rateLimits: session.rateLimits,
  });

  return session;
}

/**
 * Check if rate limit allows request
 */
export function checkRateLimit(
  sessionId: string,
  type: 'requests' | 'tokens',
  amount: number = 1,
  correlationId?: string
): { allowed: boolean; session: Session | null } {
  const session = sessions.get(sessionId);
  if (!session) {
    logger.warn('Session not found for rate limit check', {
      correlationId,
      sessionId,
    });
    return { allowed: false, session: null };
  }

  const now = new Date();
  const limitKey = type === 'requests' ? 'requestsPerMinute' : 'tokensPerMinute';
  const rateLimit = session.rateLimits[limitKey];

  // Check if rate limit window has reset
  const resetTime = new Date(rateLimit.resetAt);
  if (now >= resetTime) {
    // Reset the rate limit
    const newResetAt = getNextMinuteBoundary();
    session.rateLimits[limitKey] = {
      ...rateLimit,
      remaining: rateLimit.limit,
      resetAt: newResetAt,
    };
    
    // Also reset the other rate limit if it's also expired
    const otherKey = type === 'requests' ? 'tokensPerMinute' : 'requestsPerMinute';
    const otherLimit = session.rateLimits[otherKey];
    const otherResetTime = new Date(otherLimit.resetAt);
    if (now >= otherResetTime) {
      session.rateLimits[otherKey] = {
        ...otherLimit,
        remaining: otherLimit.limit,
        resetAt: newResetAt,
      };
    }
  }

  // Check if request is allowed
  const allowed = session.rateLimits[limitKey].remaining >= amount;
  
  if (allowed) {
    session.rateLimits[limitKey].remaining -= amount;
    sessions.set(sessionId, session);
    
    logger.debug('Rate limit check passed', {
      correlationId,
      sessionId,
      type,
      amount,
      remaining: session.rateLimits[limitKey].remaining,
    });
  } else {
    logger.warn('Rate limit exceeded', {
      correlationId,
      sessionId,
      type,
      amount,
      remaining: session.rateLimits[limitKey].remaining,
      limit: session.rateLimits[limitKey].limit,
    });
  }

  return { allowed, session };
}

/**
 * Delete session (cleanup)
 */
export function deleteSession(sessionId: string, correlationId?: string): boolean {
  const existed = sessions.delete(sessionId);
  
  if (existed) {
    logger.info('Session deleted', {
      correlationId,
      sessionId,
    });
  } else {
    logger.warn('Session not found for deletion', {
      correlationId,
      sessionId,
    });
  }

  return existed;
}

/**
 * Get current session count (for monitoring)
 */
export function getSessionCount(): number {
  return sessions.size;
}

/**
 * Clean up expired sessions (for memory management)
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  const expiredSessions: string[] = [];
  
  // Sessions expire after 1 hour of inactivity
  const EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds
  
  sessions.forEach((session, sessionId) => {
    const createdTime = new Date(session.createdAt);
    if (now.getTime() - createdTime.getTime() > EXPIRY_TIME) {
      expiredSessions.push(sessionId);
    }
  });
  
  expiredSessions.forEach(sessionId => {
    sessions.delete(sessionId);
  });
  
  if (expiredSessions.length > 0) {
    logger.info('Cleaned up expired sessions', {
      count: expiredSessions.length,
      remaining: sessions.size,
    });
  }
  
  return expiredSessions.length;
}