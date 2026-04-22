import { pgTable, varchar, serial, timestamp, boolean, integer, text, jsonb, numeric, index, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    openid: varchar("openid", { length: 100 }).notNull().unique(),
    nickname: varchar("nickname", { length: 100 }),
    avatar: varchar("avatar", { length: 500 }),
    phone: varchar("phone", { length: 20 }),
    bio: text("bio"),
    level: integer("level").default(1).notNull(),
    exp: integer("exp").default(0).notNull(),
    credits: integer("credits").default(0).notNull(),
    settings: jsonb("settings").default({}),
    referral_code: varchar("referral_code", { length: 10 }),
    invited_by: varchar("invited_by", { length: 36 }),
    available_balance: numeric("available_balance", { precision: 10, scale: 2 }).default("0"),
    total_earnings: numeric("total_earnings", { precision: 10, scale: 2 }).default("0"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_openid_idx").on(table.openid),
    index("users_level_idx").on(table.level),
    index("users_referral_code_idx").on(table.referral_code),
  ]
)

// AI分身表
export const avatars = pgTable(
  "avatars",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    avatar_url: varchar("avatar_url", { length: 500 }),
    personality: text("personality"),
    skills: jsonb("skills").default([]),
    config: jsonb("config").default({}),
    level: integer("level").default(1).notNull(),
    exp: integer("exp").default(0).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    is_hosted: boolean("is_hosted").default(false),
    completion_rate: numeric("completion_rate", { precision: 5, scale: 2 }).default("0"),
    total_orders: integer("total_orders").default(0),
    completed_orders: integer("completed_orders").default(0),
    learning_data: jsonb("learning_data").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("avatars_user_id_idx").on(table.user_id),
    index("avatars_status_idx").on(table.status),
    index("avatars_level_idx").on(table.level),
    index("avatars_is_hosted_idx").on(table.is_hosted),
  ]
)

// 对话会话表
export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }),
    context: jsonb("context").default([]),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("conversations_user_id_idx").on(table.user_id),
    index("conversations_avatar_id_idx").on(table.avatar_id),
    index("conversations_created_at_idx").on(table.created_at),
  ]
)

// 消息表
export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    conversation_id: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversation_id),
    index("messages_created_at_idx").on(table.created_at),
  ]
)

// 任务表
export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).references(() => avatars.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    progress: integer("progress").default(0).notNull(),
    result: jsonb("result").default({}),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_user_id_idx").on(table.user_id),
    index("tasks_avatar_id_idx").on(table.avatar_id),
    index("tasks_status_idx").on(table.status),
    index("tasks_type_idx").on(table.type),
    index("tasks_created_at_idx").on(table.created_at),
  ]
)

// 社交动态表
export const posts = pgTable(
  "posts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).references(() => avatars.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    images: jsonb("images").default([]),
    videos: jsonb("videos").default([]),
    tags: jsonb("tags").default([]),
    likes_count: integer("likes_count").default(0).notNull(),
    comments_count: integer("comments_count").default(0).notNull(),
    shares_count: integer("shares_count").default(0).notNull(),
    is_public: boolean("is_public").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("posts_user_id_idx").on(table.user_id),
    index("posts_avatar_id_idx").on(table.avatar_id),
    index("posts_created_at_idx").on(table.created_at),
    index("posts_is_public_idx").on(table.is_public),
  ]
)

// 评论表
export const comments = pgTable(
  "comments",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    post_id: varchar("post_id", { length: 36 }).notNull().references(() => posts.id, { onDelete: "cascade" }),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).references(() => avatars.id, { onDelete: "set null" }),
    parent_id: varchar("parent_id", { length: 36 }).references((): any => comments.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    likes_count: integer("likes_count").default(0).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("comments_post_id_idx").on(table.post_id),
    index("comments_user_id_idx").on(table.user_id),
    index("comments_avatar_id_idx").on(table.avatar_id),
    index("comments_parent_id_idx").on(table.parent_id),
  ]
)

// 点赞表
export const likes = pgTable(
  "likes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).references(() => avatars.id, { onDelete: "set null" }),
    target_type: varchar("target_type", { length: 20 }).notNull(),
    target_id: varchar("target_id", { length: 36 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("likes_user_id_idx").on(table.user_id),
    index("likes_avatar_id_idx").on(table.avatar_id),
    index("likes_target_idx").on(table.target_type, table.target_id),
  ]
)

// 关注表
export const follows = pgTable(
  "follows",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    follower_id: varchar("follower_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    following_id: varchar("following_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("follows_follower_id_idx").on(table.follower_id),
    index("follows_following_id_idx").on(table.following_id),
  ]
)

// 通知表
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(), // message, like, follow, system
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    is_read: boolean("is_read").default(false).notNull(),
    data: jsonb("data").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.user_id),
    index("notifications_is_read_idx").on(table.is_read),
    index("notifications_created_at_idx").on(table.created_at),
  ]
)

// B端订单表
export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).references(() => avatars.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    requirements: jsonb("requirements").default({}),
    budget: numeric("budget", { precision: 10, scale: 2 }),
    status: varchar("status", { length: 20 }).default("open").notNull(),
    result: jsonb("result").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("orders_user_id_idx").on(table.user_id),
    index("orders_avatar_id_idx").on(table.avatar_id),
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.created_at),
  ]
)

// 收益记录表
export const earnings = pgTable(
  "earnings",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(), // order_income, referral_bonus, withdrawal
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, completed, failed
    description: text("description"),
    order_id: varchar("order_id", { length: 36 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    settled_at: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => [
    index("earnings_user_id_idx").on(table.user_id),
    index("earnings_type_idx").on(table.type),
    index("earnings_status_idx").on(table.status),
    index("earnings_created_at_idx").on(table.created_at),
  ]
)

// 提现记录表
export const withdrawals = pgTable(
  "withdrawals",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    method: varchar("method", { length: 20 }).notNull(), // wechat, alipay, bank
    account_info: jsonb("account_info").default({}),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, processing, completed, failed
    failure_reason: text("failure_reason"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    processed_at: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("withdrawals_user_id_idx").on(table.user_id),
    index("withdrawals_status_idx").on(table.status),
    index("withdrawals_created_at_idx").on(table.created_at),
  ]
)

// 邀请记录表
export const referrals = pgTable(
  "referrals",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    inviter_id: varchar("inviter_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    invitee_id: varchar("invitee_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).default("registered").notNull(), // registered, active, rewarded
    reward_amount: numeric("reward_amount", { precision: 10, scale: 2 }).default("0"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    rewarded_at: timestamp("rewarded_at", { withTimezone: true }),
  },
  (table) => [
    index("referrals_inviter_id_idx").on(table.inviter_id),
    index("referrals_invitee_id_idx").on(table.invitee_id),
    index("referrals_status_idx").on(table.status),
    index("referrals_created_at_idx").on(table.created_at),
  ]
)

// 订单执行步骤表
export const orderExecutions = pgTable(
  "order_executions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    step_number: integer("step_number").notNull(),
    step_name: varchar("step_name", { length: 100 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, in_progress, completed, failed
    result: jsonb("result").default({}),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_executions_order_id_idx").on(table.order_id),
    index("order_executions_status_idx").on(table.status),
  ]
)

// 分身进化记录表
export const avatarEvolution = pgTable(
  "avatar_evolution",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    level_from: integer("level_from").notNull(),
    level_to: integer("level_to").notNull(),
    exp_gained: integer("exp_gained").notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    rewards: jsonb("rewards").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("avatar_evolution_avatar_id_idx").on(table.avatar_id),
    index("avatar_evolution_created_at_idx").on(table.created_at),
  ]
)

// 平台配置表 - 存储用户的第三方平台授权信息
export const platformConfigs = pgTable(
  "platform_configs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    platform_type: varchar("platform_type", { length: 30 }).notNull(), // wechat_mp, xiaohongshu, bilibili, weibo, douyin, wechat_video
    config_data: jsonb("config_data").default({}), // 存储加密后的配置信息
    status: varchar("status", { length: 20 }).default("active").notNull(), // active, expired, unconfigured
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("platform_configs_user_id_idx").on(table.user_id),
    index("platform_configs_platform_type_idx").on(table.platform_type),
  ]
)

// 分身账号基础数据表 - 记录分身在各平台的粉丝、曝光、作品数等基础数据
export const avatarAccounts = pgTable(
  "avatar_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 30 }).notNull(), // douyin, wechat, xiaohongshu, bilibili, weibo, etc.
    account_name: varchar("account_name", { length: 100 }), // 账号名称
    followers: integer("followers").default(0).notNull(), // 粉丝数
    total_exposure: integer("total_exposure").default(0).notNull(), // 总曝光量
    total_works: integer("total_works").default(0).notNull(), // 作品数量
    avg_likes_per_work: integer("avg_likes_per_work").default(0).notNull(), // 每作品平均点赞数
    avg_comments_per_work: integer("avg_comments_per_work").default(0).notNull(), // 每作品平均评论数
    avg_shares_per_work: integer("avg_shares_per_work").default(0).notNull(), // 每作品平均转发数
    engagement_rate: numeric("engagement_rate", { precision: 5, scale: 2 }).default("0"), // 互动率 = (likes + comments + shares) / exposure
    last_updated_at: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("avatar_accounts_avatar_id_idx").on(table.avatar_id),
    index("avatar_accounts_platform_idx").on(table.platform),
    index("avatar_accounts_followers_idx").on(table.followers),
    index("avatar_accounts_total_exposure_idx").on(table.total_exposure),
  ]
)

// 订单效果统计表 - 记录订单完成后的实际效果，用于历史数据分析
export const orderResults = pgTable(
  "order_results",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 30 }).notNull(), // 执行订单的平台
    task_description: text("task_description"), // 任务描述
    actual_exposure: integer("actual_exposure").default(0).notNull(), // 实际曝光量
    actual_likes: integer("actual_likes").default(0).notNull(), // 实际点赞数
    actual_comments: integer("actual_comments").default(0).notNull(), // 实际评论数
    actual_shares: integer("actual_shares").default(0).notNull(), // 实际转发数
    actual_views: integer("actual_views").default(0).notNull(), // 实际阅读/播放量
    completion_time_hours: numeric("completion_time_hours", { precision: 5, scale: 2 }).default("0"), // 完成时间（小时）
    quality_score: integer("quality_score").default(0).notNull(), // 质量评分（0-100）
    customer_rating: integer("customer_rating"), // 客户评分（1-5）
    notes: text("notes"), // 备注说明
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_results_order_id_idx").on(table.order_id),
    index("order_results_avatar_id_idx").on(table.avatar_id),
    index("order_results_platform_idx").on(table.platform),
    index("order_results_actual_exposure_idx").on(table.actual_exposure),
    index("order_results_created_at_idx").on(table.created_at),
  ]
)

// 分身技能表
export const avatarSkills = pgTable(
  "avatar_skills",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    skill_type: varchar("skill_type", { length: 50 }).notNull(), // writing, image_gen, video_gen, publishing, etc.
    skill_level: integer("skill_level").default(1).notNull(),
    usage_count: integer("usage_count").default(0).notNull(),
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("avatar_skills_avatar_id_idx").on(table.avatar_id),
    index("avatar_skills_skill_type_idx").on(table.skill_type),
  ]
)

// Agent任务日志表
export const agentTaskLogs = pgTable(
  "agent_task_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    task_id: varchar("task_id", { length: 36 }).notNull(),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    step_index: integer("step_index").notNull(),
    step_type: varchar("step_type", { length: 20 }).notNull(), // think, action, observe, result
    content: text("content"),
    tool_name: varchar("tool_name", { length: 100 }),
    tool_params: jsonb("tool_params").default({}),
    tool_result: jsonb("tool_result").default({}),
    requires_config: boolean("requires_config").default(false),
    config_platform: varchar("config_platform", { length: 30 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_task_logs_task_id_idx").on(table.task_id),
    index("agent_task_logs_avatar_id_idx").on(table.avatar_id),
    index("agent_task_logs_created_at_idx").on(table.created_at),
  ]
)

// 系统健康检查表
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
})

// Schema导出
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({ coerce: { date: true } })

export const insertUserSchema = createCoercedInsertSchema(users)
export const insertAvatarSchema = createCoercedInsertSchema(avatars)
export const insertConversationSchema = createCoercedInsertSchema(conversations)
export const insertMessageSchema = createCoercedInsertSchema(messages)
export const insertTaskSchema = createCoercedInsertSchema(tasks)
export const insertPostSchema = createCoercedInsertSchema(posts)
export const insertCommentSchema = createCoercedInsertSchema(comments)
export const insertLikeSchema = createCoercedInsertSchema(likes)
export const insertFollowSchema = createCoercedInsertSchema(follows)
export const insertOrderSchema = createCoercedInsertSchema(orders)
export const insertAvatarAccountSchema = createCoercedInsertSchema(avatarAccounts)
export const insertOrderResultSchema = createCoercedInsertSchema(orderResults)

// 分身长期记忆表
export const avatarMemories = pgTable(
  "avatar_memories",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    memory_type: varchar("memory_type", { length: 50 }).notNull(), // conversation, learning, preference, experience
    content: text("content").notNull(),
    embedding: jsonb("embedding"), // 向量存储（JSON 格式存储数组）
    metadata: jsonb("metadata").default("{}"),
    access_count: integer("access_count").default(0).notNull(),
    last_accessed_at: timestamp("last_accessed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("avatar_memories_avatar_id_idx").on(table.avatar_id),
    index("avatar_memories_memory_type_idx").on(table.memory_type),
  ]
)

// 分身对话上下文表
export const avatarContexts = pgTable(
  "avatar_contexts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    context_type: varchar("context_type", { length: 50 }).notNull(), // current, recent, important
    context_data: jsonb("context_data").notNull(),
    priority: integer("priority").default(0).notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("avatar_contexts_avatar_id_idx").on(table.avatar_id),
    index("avatar_contexts_context_type_idx").on(table.context_type),
    index("avatar_contexts_priority_idx").on(table.priority),
  ]
)

// 分身 Agent 配置表
export const avatarAgentConfigs = pgTable(
  "avatar_agent_configs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    system_prompt: text("system_prompt").notNull(),
    role_prompt: text("role_prompt"),
    temperature: numeric("temperature", { precision: 3, scale: 2 }).default("0.7"),
    max_tokens: integer("max_tokens").default(2000),
    enabled_tools: jsonb("enabled_tools").default("[]").notNull(),
    knowledge_bases: jsonb("knowledge_bases").default("[]").notNull(),
    reasoning_mode: varchar("reasoning_mode", { length: 50 }).default("react").notNull(), // react, chain_of_thought, few_shot
    learning_enabled: boolean("learning_enabled").default(true).notNull(),
    memory_config: jsonb("memory_config").default("{}").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("avatar_agent_configs_avatar_id_unique").on(table.avatar_id)
  ]
)

// 分身学习记录表
export const avatarLearningRecords = pgTable(
  "avatar_learning_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    learning_type: varchar("learning_type", { length: 50 }).notNull(), // feedback, observation, interaction, task_completion
    input_data: jsonb("input_data").notNull(),
    output_data: jsonb("output_data").notNull(),
    feedback_score: integer("feedback_score"), // 1-5
    learned_knowledge: text("learned_knowledge"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("avatar_learning_records_avatar_id_idx").on(table.avatar_id),
    index("avatar_learning_records_learning_type_idx").on(table.learning_type),
    index("avatar_learning_records_created_at_idx").on(table.created_at),
  ]
)

export const insertAvatarMemorySchema = createCoercedInsertSchema(avatarMemories)
export const insertAvatarContextSchema = createCoercedInsertSchema(avatarContexts)
export const insertAvatarAgentConfigSchema = createCoercedInsertSchema(avatarAgentConfigs)
export const insertAvatarLearningRecordSchema = createCoercedInsertSchema(avatarLearningRecords)

// 作品链接表 - 存储用户发布的作品链接和抓取到的详细信息
export const publishedWorks = pgTable(
  "published_works",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    avatar_id: varchar("avatar_id", { length: 36 }).notNull().references(() => avatars.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 30 }).notNull(), // douyin, xiaohongshu, wechat_mp, etc.
    work_title: varchar("work_title", { length: 500 }), // 作品标题
    work_url: varchar("work_url", { length: 1000 }).notNull(), // 作品链接
    author_nickname: varchar("author_nickname", { length: 200 }), // 作者昵称
    cover_image: varchar("cover_image", { length: 1000 }), // 封面图URL
    description: text("description"), // 作品描述
    extra_data: jsonb("extra_data").default({}), // 额外的作品数据（TikHub返回的完整数据）
    status: varchar("status", { length: 20 }).default("verified").notNull(), // verified, unverified, failed
    feedback_image: varchar("feedback_image", { length: 1000 }), // 用户上传的反馈截图
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("published_works_order_id_idx").on(table.order_id),
    index("published_works_avatar_id_idx").on(table.avatar_id),
    index("published_works_platform_idx").on(table.platform),
    index("published_works_work_url_idx").on(table.work_url),
    index("published_works_created_at_idx").on(table.created_at),
  ]
)

export const insertPublishedWorkSchema = createCoercedInsertSchema(publishedWorks)

// 类型导出
export type User = typeof users.$inferSelect
export type InsertUser = z.infer<typeof insertUserSchema>
export type Avatar = typeof avatars.$inferSelect
export type InsertAvatar = z.infer<typeof insertAvatarSchema>
export type Conversation = typeof conversations.$inferSelect
export type InsertConversation = z.infer<typeof insertConversationSchema>
export type Message = typeof messages.$inferSelect
export type InsertMessage = z.infer<typeof insertMessageSchema>
export type Task = typeof tasks.$inferSelect
export type InsertTask = z.infer<typeof insertTaskSchema>
export type Post = typeof posts.$inferSelect
export type InsertPost = z.infer<typeof insertPostSchema>
export type Comment = typeof comments.$inferSelect
export type InsertComment = z.infer<typeof insertCommentSchema>
export type Like = typeof likes.$inferSelect
export type InsertLike = z.infer<typeof insertLikeSchema>
export type Follow = typeof follows.$inferSelect
export type InsertFollow = z.infer<typeof insertFollowSchema>
export type Order = typeof orders.$inferSelect
export type InsertOrder = z.infer<typeof insertOrderSchema>
export type AvatarAccount = typeof avatarAccounts.$inferSelect
export type InsertAvatarAccount = z.infer<typeof insertAvatarAccountSchema>
export type OrderResult = typeof orderResults.$inferSelect
export type InsertOrderResult = z.infer<typeof insertOrderResultSchema>
export type AvatarMemory = typeof avatarMemories.$inferSelect
export type InsertAvatarMemory = z.infer<typeof insertAvatarMemorySchema>
export type AvatarContext = typeof avatarContexts.$inferSelect
export type InsertAvatarContext = z.infer<typeof insertAvatarContextSchema>
export type AvatarAgentConfig = typeof avatarAgentConfigs.$inferSelect
export type InsertAvatarAgentConfig = z.infer<typeof insertAvatarAgentConfigSchema>
export type AvatarLearningRecord = typeof avatarLearningRecords.$inferSelect
export type InsertAvatarLearningRecord = z.infer<typeof insertAvatarLearningRecordSchema>
export type PublishedWork = typeof publishedWorks.$inferSelect
export type InsertPublishedWork = z.infer<typeof insertPublishedWorkSchema>
