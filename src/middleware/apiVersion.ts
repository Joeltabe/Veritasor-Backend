import { Request, Response, NextFunction } from 'express'

/**
 * API Version middleware
 * 
 * This middleware tracks and validates API versions.
 * Currently supports v1 (default).
 * 
 * Usage pattern:
 * - Routes mounted under /api/v1* will have apiVersion set to 'v1'
 * - Can be extended to support multiple versions in future
 */
export function apiVersionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract version from path (e.g., /api/v1/health -> v1)
  const pathMatch = req.path.match(/^\/api\/v(\d+)/)
  if (pathMatch) {
    ;(req as any).apiVersion = `v${pathMatch[1]}`
  }
  next()
}

/**
 * Version-aware response header middleware
 * Adds API-Version to response for client awareness
 */
export function versionResponseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiVersion = (req as any).apiVersion ?? 'v1'
  res.setHeader('API-Version', apiVersion)
  next()
}
