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
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_openid_idx").on(table.openid),
    index("users_level_idx").on(table.level),
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
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("avatars_user_id_idx").on(table.user_id),
    index("avatars_status_idx").on(table.status),
    index("avatars_level_idx").on(table.level),
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
