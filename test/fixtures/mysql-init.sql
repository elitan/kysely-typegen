-- Test database schema for MySQL

-- Use the main test database
USE test_db;

-- Create test schema and grant permissions
CREATE DATABASE IF NOT EXISTS test_schema;
GRANT ALL PRIVILEGES ON test_schema.* TO 'test_user'@'%';

-- Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON,
  age INT UNSIGNED,
  balance DECIMAL(10, 2)
) COMMENT = 'Users table';

-- Posts table with enum
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  published_at TIMESTAMP NULL,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments table
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table with geometry types
CREATE TABLE locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  coordinates POINT NOT NULL,
  boundary POLYGON,
  path LINESTRING
);

-- Table with binary types
CREATE TABLE files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content BLOB,
  thumbnail MEDIUMBLOB,
  checksum BINARY(32)
);

-- Table with SET type
CREATE TABLE preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  notifications SET('email', 'sms', 'push') NOT NULL DEFAULT 'email',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table with various numeric types
CREATE TABLE metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tiny_val TINYINT,
  small_val SMALLINT,
  medium_val MEDIUMINT,
  int_val INT,
  big_val BIGINT,
  float_val FLOAT,
  double_val DOUBLE,
  decimal_val DECIMAL(15, 4),
  year_val YEAR
);

-- Table with CHECK constraints (MySQL 8.0.16+)
CREATE TABLE check_test (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status VARCHAR(20),
  priority VARCHAR(20),
  is_verified TINYINT,
  CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'pending')),
  CONSTRAINT chk_priority CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT chk_verified CHECK (is_verified IN (0, 1))
);

-- Table in test_schema
USE test_schema;

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  assignee_email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE check_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  level VARCHAR(20),
  CONSTRAINT chk_level CHECK (level IN ('beginner', 'intermediate', 'advanced'))
);

-- Create a view in test_schema
CREATE VIEW active_tasks AS
SELECT id, title, priority
FROM tasks
WHERE priority = 'high';

-- Switch back to test_db
USE test_db;

-- Create a view
CREATE VIEW active_users AS
SELECT
  id,
  email,
  username,
  created_at
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
