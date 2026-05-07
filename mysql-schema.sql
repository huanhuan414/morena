-- MySQL Schema for Morena App
-- Database: mrl

USE mrl;

-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS withdrawal_requests;
DROP TABLE IF EXISTS earnings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS order_executions;
DROP TABLE IF EXISTS order_results;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS avatar_evolution;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS avatars;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS health_check;

-- Users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    openid VARCHAR(100) NOT NULL UNIQUE,
    nickname VARCHAR(100),
    avatar VARCHAR(500),
    phone VARCHAR(20),
    bio TEXT,
    level INT DEFAULT 1 NOT NULL,
    exp INT DEFAULT 0 NOT NULL,
    credits INT DEFAULT 0 NOT NULL,
    settings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,
    referral_code VARCHAR(20) UNIQUE,
    invited_by VARCHAR(36),
    balance DECIMAL(10,2) DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0
);

-- Avatars table
CREATE TABLE avatars (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),
    personality TEXT,
    skills TEXT,
    config TEXT,
    level INT DEFAULT 1 NOT NULL,
    exp INT DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,
    completion_rate DECIMAL(5,2) DEFAULT 100,
    total_orders INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    learning_data TEXT,
    is_hosted TINYINT(1) DEFAULT 0,
    latitude DECIMAL(10,2),
    longitude DECIMAL(10,2),
    location_text VARCHAR(255),
    appearance_style VARCHAR(100),
    speaking_style VARCHAR(100),
    photo_analysis TEXT,
    INDEX idx_avatars_user_id (user_id),
    INDEX idx_avatars_status (status),
    INDEX idx_avatars_level (level)
);

-- Health check table
CREATE TABLE health_check (
    id INT AUTO_INCREMENT PRIMARY KEY,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE conversations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    avatar_id VARCHAR(36) NOT NULL,
    title VARCHAR(200),
    context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,
    INDEX idx_conversations_user_id (user_id),
    INDEX idx_conversations_avatar_id (avatar_id),
    INDEX idx_conversations_created_at (created_at)
);

-- Messages table
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_messages_conversation_id (conversation_id),
    INDEX idx_messages_created_at (created_at)
);

-- Comments table
CREATE TABLE comments (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36),
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    avatar_id VARCHAR(36),
    INDEX idx_comments_post_id (post_id),
    INDEX idx_comments_user_id (user_id),
    INDEX idx_comments_avatar_id (avatar_id),
    INDEX idx_comments_parent_id (parent_id)
);

-- Follows table
CREATE TABLE follows (
    id VARCHAR(36) PRIMARY KEY,
    follower_id VARCHAR(36) NOT NULL,
    following_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_follows_follower_id (follower_id),
    INDEX idx_follows_following_id (following_id)
);

-- Avatar Evolution table
CREATE TABLE avatar_evolution (
    id VARCHAR(36) PRIMARY KEY,
    avatar_id VARCHAR(36) NOT NULL,
    level_from INT NOT NULL,
    level_to INT NOT NULL,
    exp_gained INT NOT NULL,
    source VARCHAR(50) NOT NULL,
    rewards TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_avatar_evolution_avatar_id (avatar_id),
    INDEX idx_avatar_evolution_created_at (created_at)
);

-- Posts table
CREATE TABLE posts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    avatar_id VARCHAR(36),
    content TEXT NOT NULL,
    images TEXT,
    videos TEXT,
    tags TEXT,
    likes_count INT DEFAULT 0 NOT NULL,
    comments_count INT DEFAULT 0 NOT NULL,
    shares_count INT DEFAULT 0 NOT NULL,
    is_public TINYINT(1) DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,
    is_ai_generated TINYINT(1) DEFAULT 0,
    INDEX idx_posts_user_id (user_id),
    INDEX idx_posts_avatar_id (avatar_id),
    INDEX idx_posts_created_at (created_at),
    INDEX idx_posts_is_public (is_public)
);

-- Orders table
CREATE TABLE orders (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    avatar_id VARCHAR(36),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    requirements TEXT,
    budget DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'open' NOT NULL,
    result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    latitude DECIMAL(10,2),
    longitude DECIMAL(10,2),
    location_text VARCHAR(255),
    content_type VARCHAR(50),
    platforms TEXT,
    target_audience TEXT,
    expected_quantity INT DEFAULT 1,
    deadline TIMESTAMP NULL,
    INDEX idx_orders_user_id (user_id),
    INDEX idx_orders_avatar_id (avatar_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created_at (created_at)
);

-- Order Results table
CREATE TABLE order_results (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    avatar_id VARCHAR(36) NOT NULL,
    platform VARCHAR(30) NOT NULL,
    task_description TEXT,
    actual_exposure INT DEFAULT 0 NOT NULL,
    actual_likes INT DEFAULT 0 NOT NULL,
    actual_comments INT DEFAULT 0 NOT NULL,
    actual_shares INT DEFAULT 0 NOT NULL,
    actual_views INT DEFAULT 0 NOT NULL,
    completion_time_hours DECIMAL(5,2) DEFAULT 0,
    quality_score INT DEFAULT 0 NOT NULL,
    customer_rating INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    screenshots TEXT,
    INDEX idx_order_results_order_id (order_id),
    INDEX idx_order_results_avatar_id (avatar_id),
    INDEX idx_order_results_platform (platform)
);

-- Order Executions table
CREATE TABLE order_executions (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    avatar_id VARCHAR(36) NOT NULL,
    executor_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    result TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_order_executions_order_id (order_id),
    INDEX idx_order_executions_avatar_id (avatar_id),
    INDEX idx_order_executions_status (status)
);

-- Tasks table
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    avatar_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',
    params TEXT,
    progress INT DEFAULT 0,
    result TEXT,
    logs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    INDEX idx_tasks_user_id (user_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_created_at (created_at)
);

-- Likes table
CREATE TABLE likes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    avatar_id VARCHAR(36),
    INDEX idx_likes_user_id (user_id),
    INDEX idx_likes_target (target_type, target_id),
    INDEX idx_likes_avatar_id (avatar_id)
);

-- Notifications table
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0 NOT NULL,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_is_read (is_read),
    INDEX idx_notifications_created_at (created_at)
);

-- Earnings table
CREATE TABLE earnings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36),
    avatar_id VARCHAR(36),
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_earnings_user_id (user_id),
    INDEX idx_earnings_order_id (order_id),
    INDEX idx_earnings_status (status)
);

-- Withdrawal Requests table
CREATE TABLE withdrawal_requests (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    payment_method VARCHAR(50),
    payment_account VARCHAR(100),
    transaction_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at TIMESTAMP NULL,
    INDEX idx_withdrawal_user_id (user_id),
    INDEX idx_withdrawal_status (status)
);

-- Insert health check record
INSERT INTO health_check (id) VALUES (1);
