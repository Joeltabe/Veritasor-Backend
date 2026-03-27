/**
 * Integration tests for attestations and analytics APIs.
 *
 * Auth notes:
 *  - /api/attestations  uses middleware/auth.ts which checks for x-user-id header
 *  - /api/analytics/*   uses requireBusinessAuth (Bearer + x-business-id header)
 */
import { test, describe } from 'vitest'
import assert from 'node:assert'
import request from 'supertest'
import { app } from '../../src/app.js'

// ---------------------------------------------------------------------------
// Attestations auth: middleware/auth.ts reads `x-user-id` header (no JWT).
// ---------------------------------------------------------------------------

/** Auth header for attestation routes — just needs a non-empty x-user-id. */
const authHeader = { 'x-user-id': 'test-user-id' }

// ---------------------------------------------------------------------------
// Attestations – Authentication guard (unauthenticated requests)
// ---------------------------------------------------------------------------

test('GET /api/attestations returns 401 when unauthenticated', async () => {
  const res = await request(app).get('/api/attestations')
  assert.strictEqual(res.status, 401)
})

test('GET /api/attestations/:id returns 401 when unauthenticated', async () => {
  const res = await request(app).get('/api/attestations/abc-123')
  assert.strictEqual(res.status, 401)
})

test('POST /api/attestations returns 401 when unauthenticated', async () => {
  const res = await request(app)
    .post('/api/attestations')
    .set('Idempotency-Key', 'test-key')
    .send({ period: '2024-01', merkleRoot: 'abc', version: '1.0.0' })
  assert.strictEqual(res.status, 401)
})

test('DELETE /api/attestations/:id/revoke returns 401 when unauthenticated', async () => {
  const res = await request(app).delete('/api/attestations/xyz-456/revoke')
  assert.strictEqual(res.status, 401)
})

// ---------------------------------------------------------------------------
// Attestations – Authenticated behaviour
// ---------------------------------------------------------------------------

test('GET /api/attestations with x-user-id and explicit businessId returns 200', async () => {
  const res = await request(app)
    .get('/api/attestations')
    .set(authHeader)
    .query({ businessId: 'biz_1' })
  assert.strictEqual(res.status, 200)
  assert.strictEqual(res.body?.status, 'success')
  assert.ok(Array.isArray(res.body?.data))
  assert.ok(typeof res.body?.pagination === 'object')
  assert.ok(typeof res.body.pagination.total === 'number')
})

test('GET /api/attestations response data items have expected shape', async () => {
  const res = await request(app)
    .get('/api/attestations')
    .set(authHeader)
    .query({ businessId: 'biz_1' })
  assert.strictEqual(res.status, 200)
  for (const item of res.body.data as any[]) {
    assert.strictEqual(typeof item.id, 'string')
    assert.strictEqual(typeof item.businessId, 'string')
    assert.strictEqual(typeof item.period, 'string')
    assert.strictEqual(typeof item.attestedAt, 'string')
  }
})

test('GET /api/attestations with no businessId returns 4xx/5xx (no DB in test env)', async () => {
  // Without a configured DB, businessRepository.getByUserId throws → 500.
  // With a DB, it would return null → 404 BUSINESS_NOT_FOUND.
  const res = await request(app).get('/api/attestations').set(authHeader)
  assert.ok(res.status === 404 || res.status === 500, `Expected 404 or 500, got ${res.status}`)
})

test('DELETE /api/attestations/:id/revoke returns 4xx/5xx when no DB configured', async () => {
  // Without a configured DB, businessRepository.getByUserId throws → 500.
  // With a DB, no linked business would → 404 BUSINESS_NOT_FOUND.
  const res = await request(app)
    .delete('/api/attestations/nonexistent-id/revoke')
    .set(authHeader)
  assert.ok(res.status === 404 || res.status === 500, `Expected 404 or 500, got ${res.status}`)
})

// ---------------------------------------------------------------------------
// Analytics – Revenue Report Time Window Controls
// ---------------------------------------------------------------------------

/**
 * Auth headers for the analytics routes.
 * requireBusinessAuth requires both Bearer token AND x-business-id header.
 * biz_1 has seeded attestations for periods 2025-10 and 2025-11.
 */
const bizAuthHeader = {
  Authorization: 'Bearer test-token',
  'x-business-id': 'biz_1',
}

describe('GET /api/analytics/revenue – time window controls', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/analytics/revenue').query({ period: '2025-10' })
    assert.strictEqual(res.status, 401)
  })

  test('returns 400 when no query params supplied', async () => {
    const res = await request(app).get('/api/analytics/revenue').set(bizAuthHeader)
    assert.strictEqual(res.status, 400)
    assert.ok(res.body?.error)
  })

  test('returns 400 when period has invalid format (not YYYY-MM)', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ period: '2025/10' })
    assert.strictEqual(res.status, 400)
  })

  test('returns 400 when from has invalid format', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ from: 'October-2025', to: '2025-12' })
    assert.strictEqual(res.status, 400)
  })

  test('returns 400 when to has invalid format', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ from: '2025-10', to: 'Dec-2025' })
    assert.strictEqual(res.status, 400)
  })

  test('returns 400 when from is after to (logical ordering violation)', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ from: '2025-12', to: '2025-01' })
    assert.strictEqual(res.status, 400)
    assert.ok(res.body?.error?.toLowerCase().includes('later'))
  })

  test('returns 400 when range exceeds 24 months', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ from: '2020-01', to: '2025-12' })
    assert.strictEqual(res.status, 400)
    assert.ok(res.body?.error?.toLowerCase().includes('maximum'))
  })

  test('returns 404 when valid period has no matching data', async () => {
    // biz_1 has no attestations for 2099-01
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ period: '2099-01' })
    assert.strictEqual(res.status, 404)
    assert.ok(res.body?.error)
  })

  test('returns 200 with correct report shape for a valid single period', async () => {
    // biz_1 has seeded data for 2025-10 and 2025-11
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ period: '2025-10' })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(typeof res.body.period, 'string')
    assert.strictEqual(typeof res.body.total, 'number')
    assert.strictEqual(typeof res.body.net, 'number')
    assert.strictEqual(res.body.currency, 'USD')
    assert.ok(Array.isArray(res.body.breakdown))
    // net must be less than total (5% fee applied)
    assert.ok(res.body.net < res.body.total)
    // Each breakdown item must have attestationId and attestedAt
    for (const item of res.body.breakdown) {
      assert.strictEqual(typeof item.attestationId, 'string')
      assert.strictEqual(typeof item.attestedAt, 'string')
    }
  })

  test('returns 200 with correct report shape for a valid from/to range', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ from: '2025-10', to: '2025-11' })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.body.period, '2025-10 to 2025-11')
    assert.ok(Array.isArray(res.body.breakdown))
    assert.ok(res.body.breakdown.length > 0)
  })

  test('from === to is treated as a single-period range and returns 200', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue')
      .set(bizAuthHeader)
      .query({ from: '2025-11', to: '2025-11' })
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body.breakdown))
  })
})

describe('GET /api/analytics/periods', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/analytics/periods')
    assert.strictEqual(res.status, 401)
  })

  test('returns 200 with sorted array of period strings when authenticated', async () => {
    const res = await request(app).get('/api/analytics/periods').set(bizAuthHeader)
    assert.strictEqual(res.status, 200)
    assert.ok(Array.isArray(res.body?.periods))
    // Periods should be sorted descending (most recent first)
    const periods: string[] = res.body.periods
    for (let i = 1; i < periods.length; i++) {
      assert.ok(
        periods[i - 1] >= periods[i],
        `Expected descending order but got: ${periods[i - 1]} before ${periods[i]}`,
      )
    }
  })
})

