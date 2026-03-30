/**
 * Idempotency middleware: when client sends Idempotency-Key, we store the
 * response for that key and return the same response on duplicate requests within TTL.
 * Key = scope + user (or anonymous/IP) + idempotency key.
 */

import type { Request, Response, NextFunction } from 'express'

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key'
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface IdempotencyEntry {
  status: number
  body: unknown
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyEntry | undefined>
  set(key: string, entry: IdempotencyEntry, ttlMs: number): Promise<void>
}

const memoryStore = new Map<string, { entry: IdempotencyEntry; expiresAt: number }>()

export const inMemoryIdempotencyStore: IdempotencyStore = {
  async get(key: string): Promise<IdempotencyEntry | undefined> {
    const row = memoryStore.get(key)
    if (!row) return undefined
    if (Date.now() > row.expiresAt) {
      memoryStore.delete(key)
      return undefined
    }
    return row.entry
  },
  async set(key: string, entry: IdempotencyEntry, ttlMs: number): Promise<void> {
    memoryStore.set(key, { entry, expiresAt: Date.now() + ttlMs })
  },
}

export interface IdempotencyOptions {
  store?: IdempotencyStore
  scope: string
  ttlMs?: number
  /** Return a string that identifies the user (e.g. res.locals.userId, req.ip). Default: req.ip ?? 'anonymous' */
  getUserKey?: (req: Request) => string
}

/**
 * Middleware: require Idempotency-Key header; on first request run the route and cache
 * status + body; on duplicate request return cached response without running the route.
 */
export function idempotencyMiddleware(options: IdempotencyOptions) {
  const store = options.store ?? inMemoryIdempotencyStore
  const scope = options.scope
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const getUserKey = options.getUserKey ?? ((req: Request) => req.ip ?? 'anonymous')

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.headers[IDEMPOTENCY_KEY_HEADER]
    const keyValue = typeof rawKey === 'string' ? rawKey.trim() : Array.isArray(rawKey) ? rawKey[0]?.trim() : undefined

    if (!keyValue) {
      res.status(400).json({ error: 'Missing Idempotency-Key header' })
      return
    }

    const userKey = getUserKey(req)
    const storeKey = `idempotency:${scope}:${userKey}:${keyValue}`

    const cached = await store.get(storeKey)
    if (cached) {
      res.status(cached.status).json(cached.body)
      return
    }

    const originalJson = res.json.bind(res)
    const originalStatus = res.status.bind(res)
    let statusCode = 200

    res.status = function (code: number) {
      statusCode = code
      return originalStatus(code)
    }
    res.json = function (body: unknown) {
      store.set(storeKey, { status: statusCode, body }, ttlMs).catch(() => {})
      return originalJson(body)
    }

    next()
  }
}
