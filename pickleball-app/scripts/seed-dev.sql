-- =============================================================
-- Pickleball App — Dev DB Seed
-- Runs automatically on first container start via
--   /docker-entrypoint-initdb.d/01-seed.sql
-- To reset: npm run db:reset  (destroys volume, recreates)
-- =============================================================

-- Users (NextAuth credentials table)
CREATE TABLE IF NOT EXISTS users (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  email   TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Active tournament state (single row, id='1')
CREATE TABLE IF NOT EXISTS tournament (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL DEFAULT 'main_session',
  state      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Archived tournament history
CREATE TABLE IF NOT EXISTS tournament_history (
  id             BIGSERIAL PRIMARY KEY,
  session_slug   TEXT NOT NULL DEFAULT 'main_session',
  archive_reason TEXT,
  state          JSONB NOT NULL,
  archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_history_archived_at
  ON tournament_history (archived_at DESC);

-- =============================================================
-- Seed data
-- =============================================================

-- Dev admin user  (email: dev@pickleball.local  /  password: dev1234)
INSERT INTO users (name, email, password)
VALUES (
  'Dev Admin',
  'dev@pickleball.local',
  '$2b$12$rh3C.YEvX4zWZPX4/C1BAe4jpW/4aiGS3ANlwVAfQr6FCBTIvE.3i'
)
ON CONFLICT (email) DO NOTHING;

-- Empty tournament slot so getTournamentState() doesn't return null
INSERT INTO tournament (id, slug, state, created_at)
VALUES ('1', 'main_session', '{}', NOW())
ON CONFLICT (id) DO NOTHING;
