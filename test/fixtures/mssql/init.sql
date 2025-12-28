-- Test database schema for MSSQL
SET QUOTED_IDENTIFIER ON;
GO

USE master;
GO

IF DB_ID('test_db') IS NOT NULL
  DROP DATABASE test_db;
GO

CREATE DATABASE test_db;
GO

USE test_db;
GO

-- Create test schema
CREATE SCHEMA test_schema;
GO

-- Users table
CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  email NVARCHAR(255) NOT NULL UNIQUE,
  username NVARCHAR(100) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  updated_at DATETIME2 NULL,
  is_active BIT NOT NULL DEFAULT 1,
  metadata NVARCHAR(MAX) NULL,
  age INT NULL,
  balance DECIMAL(10, 2) NULL
);
GO

-- Posts table
CREATE TABLE posts (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  title NVARCHAR(255) NOT NULL,
  content NVARCHAR(MAX) NULL,
  published_at DATETIME2 NULL,
  view_count INT NOT NULL DEFAULT 0,
  status NVARCHAR(20) NOT NULL DEFAULT 'draft',
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_posts_status CHECK (status IN ('draft', 'published', 'archived'))
);
GO

-- Comments table
CREATE TABLE comments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content NVARCHAR(MAX) NOT NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_comments_status CHECK (status IN ('pending', 'approved', 'rejected'))
);
GO

-- Table with binary types
CREATE TABLE files (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  content VARBINARY(MAX) NULL,
  thumbnail VARBINARY(MAX) NULL,
  checksum BINARY(32) NULL,
  guid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()
);
GO

-- Table with various numeric types
CREATE TABLE metrics (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  tiny_val TINYINT NULL,
  small_val SMALLINT NULL,
  int_val INT NULL,
  big_val BIGINT NULL,
  float_val FLOAT NULL,
  real_val REAL NULL,
  decimal_val DECIMAL(15, 4) NULL,
  money_val MONEY NULL,
  smallmoney_val SMALLMONEY NULL
);
GO

-- Table with date/time types
CREATE TABLE events (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  event_date DATE NULL,
  event_time TIME NULL,
  event_datetime DATETIME NULL,
  event_datetime2 DATETIME2 NULL,
  event_datetimeoffset DATETIMEOFFSET NULL,
  event_smalldatetime SMALLDATETIME NULL
);
GO

-- Table with special types
CREATE TABLE special_types (
  id INT IDENTITY(1,1) PRIMARY KEY,
  xml_data XML NULL,
  variant_data SQL_VARIANT NULL
);
GO

-- Table with computed column
CREATE TABLE orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price AS (quantity * unit_price) PERSISTED
);
GO

-- Table in test_schema
CREATE TABLE test_schema.tasks (
  id INT IDENTITY(1,1) PRIMARY KEY,
  title NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NULL,
  priority NVARCHAR(20) DEFAULT 'medium',
  assignee_email NVARCHAR(255) NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('low', 'medium', 'high'))
);
GO

-- Create a view in test_schema
CREATE VIEW test_schema.active_tasks AS
SELECT id, title, priority
FROM test_schema.tasks
WHERE priority = 'high';
GO

-- Create a view in dbo
CREATE VIEW active_users AS
SELECT
  id,
  email,
  username,
  created_at
FROM users
WHERE is_active = 1;
GO

-- Create view with join
CREATE VIEW user_posts AS
SELECT
  u.id AS user_id,
  u.username,
  p.id AS post_id,
  p.title
FROM users u
JOIN posts p ON u.id = p.user_id;
GO

PRINT 'MSSQL test database initialized successfully';
GO
