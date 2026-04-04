import { pgTable, varchar, serial, timestamp, boolean, integer, text, jsonb, numeric, index } from "drizzle-orm/pg-core"
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
