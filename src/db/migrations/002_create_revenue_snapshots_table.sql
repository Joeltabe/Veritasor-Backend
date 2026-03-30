-- Migration: 002_create_revenue_snapshots_table
-- Creates revenue_snapshots table (caching/analytics). Idempotent: safe to run once (runner tracks by version).

CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   TEXT NOT NULL,
  period        TEXT NOT NULL,
  total_revenue NUMERIC NOT NULL,
  net_revenue   NUMERIC NOT NULL,
  currency      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
