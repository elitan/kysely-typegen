-- Test database schema for SQLite

-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata JSON,
  age INTEGER,
  balance REAL
);

-- Posts table
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  published_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived'))
);

-- Comments table
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table with BLOB type
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  content BLOB,
  checksum BLOB
);

-- Table with various numeric types
CREATE TABLE metrics (
  id INTEGER PRIMARY KEY,
  int_val INTEGER,
  real_val REAL,
  numeric_val NUMERIC,
  text_val TEXT,
  blob_val BLOB
);

-- Create a view
CREATE VIEW active_users AS
SELECT id, email, username, created_at
FROM users
WHERE is_active = 1;

-- Create view with join
CREATE VIEW user_posts AS
SELECT
  u.id AS user_id,
  u.username,
  p.id AS post_id,
  p.title
FROM users u
JOIN posts p ON u.id = p.user_id;
