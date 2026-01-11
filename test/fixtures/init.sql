-- Test database schema

-- Create test schema for multiple schema testing
CREATE SCHEMA IF NOT EXISTS test_schema;

-- Create domain types
CREATE DOMAIN positive_int AS INTEGER CHECK (VALUE >= 0);
CREATE DOMAIN test_schema.email_address AS VARCHAR(255) CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- Create enums in different schemas
CREATE TYPE status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE test_schema.priority_enum AS ENUM ('low', 'medium', 'high');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  scores INTEGER[]
);

COMMENT ON COLUMN users.email IS 'User email address';
COMMENT ON COLUMN users.tags IS 'Array of user tags';

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  published_at TIMESTAMP,
  view_count positive_int NOT NULL DEFAULT 0
);

COMMENT ON COLUMN posts.view_count IS 'Number of times this post was viewed';

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  status status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create table in test schema
CREATE TABLE test_schema.tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority test_schema.priority_enum DEFAULT 'medium',
  assignee_email test_schema.email_address,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE test_schema.tasks IS 'Tasks table in test schema';
COMMENT ON COLUMN test_schema.tasks.priority IS 'Task priority level';

-- Create materialized view
CREATE MATERIALIZED VIEW user_stats AS
SELECT
  u.id,
  u.username,
  COUNT(DISTINCT p.id) AS post_count,
  COUNT(DISTINCT c.id) AS comment_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON u.id = c.user_id
GROUP BY u.id, u.username;

CREATE INDEX ON user_stats (id);

-- Materialized view with array column (for Bug 2 test)
CREATE MATERIALIZED VIEW user_tags_view AS
SELECT
  u.id,
  u.username,
  u.tags
FROM users u;

CREATE INDEX ON user_tags_view (id);

-- Create regular view
CREATE VIEW active_users AS
SELECT
  id,
  email,
  username,
  created_at
FROM users
WHERE is_active = true;

-- Create partitioned table
CREATE TABLE measurements (
  id SERIAL,
  measure_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  sensor_id INTEGER NOT NULL
) PARTITION BY RANGE (measure_date);

-- Create partitions
CREATE TABLE measurements_2024_q1 PARTITION OF measurements
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE measurements_2024_q2 PARTITION OF measurements
  FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- CHECK constraint test fixtures
CREATE DOMAIN status_domain AS TEXT CHECK (VALUE IN ('draft', 'published', 'archived'));

CREATE TABLE check_constraints_test (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed')),
  type TEXT CHECK (type IN ('proxy', 'redirect')),
  priority INT CHECK (priority IN (1, 2, 3, 4, 5)),
  level TEXT CHECK (level = 'low' OR level = 'medium' OR level = 'high'),
  range_col INT CHECK (range_col >= 0),
  regex_col TEXT CHECK (regex_col ~* '^[a-z]+$')
);

CREATE TABLE domain_check_test (
  id SERIAL PRIMARY KEY,
  status status_domain NOT NULL
);
