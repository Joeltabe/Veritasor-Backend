import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Logs incoming requests and corresponding responses.
 * Includes HTTP method, path, optional request id, status and duration.
 * Body is purposely omitted to avoid sensitive data.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();

  // Once the response has finished being sent, compute duration and log.
  res.on('finish', () => {
    const [sec, nano] = process.hrtime(start);
    const durationMs = sec * 1e3 + nano / 1e6;
    const requestId = req.headers['x-request-id'] || '';

    const parts = [
      req.method,
      req.path,
      requestId && `reqId=${requestId}`,
      `status=${res.statusCode}`,
      `${durationMs.toFixed(3)}ms`,
    ].filter(Boolean);

    logger.info(parts.join(' '));
  });

  next();
}
