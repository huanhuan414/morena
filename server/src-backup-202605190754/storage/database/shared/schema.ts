import { pgTable, index, foreignKey, pgPolicy, varchar, text, integer, timestamp, serial, jsonb, unique, numeric, boolean, uuid, uniqueIndex, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// PostgreSQL gen_random_uuid() function
const gen_random_uuid = () => sql`gen_random_uuid()`



export const comments = pgTable("comments", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	postId: varchar("post_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	parentId: varchar("parent_id", { length: 36 }),
	content: text().notNull(),
	likesCount: integer("likes_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }),
}, (table) => [
	index("comments_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("comments_parent_id_idx").using("btree", table.parentId.asc().nullsLast().op("text_ops")),
	index("comments_post_id_idx").using("btree", table.postId.asc().nullsLast().op("text_ops")),
	index("comments_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "comments_post_id_posts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "comments_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "comments_parent_id_comments_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "comments_avatar_id_fkey"
		}).onDelete("set null"),
	pgPolicy("comments_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("comments_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("comments_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("comments_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const conversations = pgTable("conversations", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	title: varchar({ length: 200 }),
	context: jsonb().default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("conversations_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("conversations_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("conversations_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "conversations_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "conversations_avatar_id_avatars_id_fk"
		}).onDelete("cascade"),
	pgPolicy("conversations_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("conversations_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("conversations_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("conversations_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const messages = pgTable("messages", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	conversationId: varchar("conversation_id", { length: 36 }).notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("messages_conversation_id_idx").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("messages_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
	pgPolicy("messages_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("messages_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("messages_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("messages_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	openid: varchar({ length: 100 }).notNull(),
	nickname: varchar({ length: 100 }),
	avatar: varchar({ length: 500 }),
	phone: varchar({ length: 20 }),
	bio: text(),
	level: integer().default(1).notNull(),
	exp: integer().default(0).notNull(),
	credits: integer().default(0).notNull(),
	settings: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	referralCode: varchar("referral_code", { length: 20 }),
	invitedBy: varchar("invited_by", { length: 36 }),
	balance: numeric({ precision: 10, scale:  2 }).default('0'),
	totalEarnings: numeric("total_earnings", { precision: 10, scale:  2 }).default('0'),
}, (table) => [
	index("users_level_idx").using("btree", table.level.asc().nullsLast().op("int4_ops")),
	index("users_openid_idx").using("btree", table.openid.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [table.id],
			name: "users_invited_by_fkey"
		}),
	unique("users_openid_unique").on(table.openid),
	unique("users_referral_code_key").on(table.referralCode),
	pgPolicy("users_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("users_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("users_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("users_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const orderResults = pgTable("order_results", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	platform: varchar({ length: 30 }).notNull(),
	taskDescription: text("task_description"),
	actualExposure: integer("actual_exposure").default(0).notNull(),
	actualLikes: integer("actual_likes").default(0).notNull(),
	actualComments: integer("actual_comments").default(0).notNull(),
	actualShares: integer("actual_shares").default(0).notNull(),
	actualViews: integer("actual_views").default(0).notNull(),
	completionTimeHours: numeric("completion_time_hours", { precision: 5, scale:  2 }).default('0'),
	qualityScore: integer("quality_score").default(0).notNull(),
	customerRating: integer("customer_rating"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	screenshots: jsonb().default([]),
}, (table) => [
	index("order_results_actual_exposure_idx").using("btree", table.actualExposure.asc().nullsLast().op("int4_ops")),
	index("order_results_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("order_results_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("order_results_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("order_results_platform_idx").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_results_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "order_results_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const avatars = pgTable("avatars", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	avatarUrl: varchar("avatar_url", { length: 500 }),
	personality: text(),
	skills: jsonb().default([]),
	config: jsonb().default({}),
	level: integer().default(1).notNull(),
	exp: integer().default(0).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	completionRate: numeric("completion_rate", { precision: 5, scale:  2 }).default('100'),
	totalOrders: integer("total_orders").default(0),
	completedOrders: integer("completed_orders").default(0),
	learningData: jsonb("learning_data").default({}),
	isHosted: boolean("is_hosted").default(false),
	latitude: numeric(),
	longitude: numeric(),
	locationText: varchar("location_text"),
	appearanceStyle: varchar("appearance_style"),
	speakingStyle: varchar("speaking_style"),
	photoAnalysis: jsonb("photo_analysis"),
}, (table) => [
	index("avatars_level_idx").using("btree", table.level.asc().nullsLast().op("int4_ops")),
	index("avatars_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("avatars_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("avatars_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("avatars_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("avatars_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("avatars_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const follows = pgTable("follows", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	followerId: varchar("follower_id", { length: 36 }).notNull(),
	followingId: varchar("following_id", { length: 36 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("follows_follower_id_idx").using("btree", table.followerId.asc().nullsLast().op("text_ops")),
	index("follows_following_id_idx").using("btree", table.followingId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.followerId],
			foreignColumns: [users.id],
			name: "follows_follower_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.followingId],
			foreignColumns: [users.id],
			name: "follows_following_id_users_id_fk"
		}).onDelete("cascade"),
	pgPolicy("follows_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("follows_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("follows_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("follows_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const avatarEvolution = pgTable("avatar_evolution", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	levelFrom: integer("level_from").notNull(),
	levelTo: integer("level_to").notNull(),
	expGained: integer("exp_gained").notNull(),
	source: varchar({ length: 50 }).notNull(),
	rewards: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("avatar_evolution_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("avatar_evolution_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_evolution_avatar_id_avatars_id_fk"
		}).onDelete("cascade"),
	pgPolicy("avatar_evolution_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("avatar_evolution_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("avatar_evolution_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("avatar_evolution_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const posts = pgTable("posts", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }),
	content: text().notNull(),
	images: jsonb().default([]),
	videos: jsonb().default([]),
	tags: jsonb().default([]),
	likesCount: integer("likes_count").default(0).notNull(),
	commentsCount: integer("comments_count").default(0).notNull(),
	sharesCount: integer("shares_count").default(0).notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	isAiGenerated: boolean("is_ai_generated").default(false),
}, (table) => [
	index("posts_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("posts_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("posts_is_public_idx").using("btree", table.isPublic.asc().nullsLast().op("bool_ops")),
	index("posts_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "posts_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "posts_avatar_id_avatars_id_fk"
		}).onDelete("set null"),
	pgPolicy("posts_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("posts_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("posts_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("posts_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const orders = pgTable("orders", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }),
	title: varchar({ length: 200 }).notNull(),
	description: text(),
	requirements: jsonb().default({}),
	budget: numeric({ precision: 10, scale:  2 }),
	status: varchar({ length: 20 }).default('open').notNull(),
	result: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	latitude: numeric(),
	longitude: numeric(),
	locationText: varchar("location_text"),
	contentType: varchar("content_type", { length: 50 }),
	platforms: text().array(),
	targetAudience: text("target_audience"),
	expectedQuantity: integer("expected_quantity").default(1),
	deadline: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("orders_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("orders_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("orders_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("orders_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "orders_avatar_id_avatars_id_fk"
		}).onDelete("set null"),
	pgPolicy("orders_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("orders_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("orders_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("orders_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const tasks = pgTable("tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	avatarId: uuid("avatar_id"),
	title: text().notNull(),
	description: text(),
	taskType: text("task_type").default('general'),
	priority: text().default('normal'),
	status: text().default('pending'),
	params: jsonb().default({}),
	progress: integer().default(0),
	result: jsonb(),
	logs: jsonb().default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_tasks_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_tasks_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_tasks_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("Allow all access to tasks", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const likes = pgTable("likes", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	targetType: varchar("target_type", { length: 20 }).notNull(),
	targetId: varchar("target_id", { length: 36 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	avatarId: varchar("avatar_id"),
}, (table) => [
	index("likes_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("likes_target_idx").using("btree", table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("text_ops")),
	index("likes_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "likes_user_id_users_id_fk"
		}).onDelete("cascade"),
	pgPolicy("likes_允许公开读取", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("likes_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("likes_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("likes_允许公开删除", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const notifications = pgTable("notifications", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	type: varchar({ length: 20 }).notNull(),
	title: varchar({ length: 200 }).notNull(),
	content: text().notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	data: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notifications_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("notifications_is_read_idx").using("btree", table.isRead.asc().nullsLast().op("bool_ops")),
	index("notifications_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
]);

export const orderExecutions = pgTable("order_executions", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	stepType: varchar("step_type", { length: 50 }).notNull(),
	stepName: varchar("step_name", { length: 200 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	result: jsonb().default({}),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	stepNumber: integer("step_number").default(1).notNull(),
	description: text(),
}, (table) => [
	index("idx_order_executions_avatar_id").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("idx_order_executions_order_id").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("idx_order_executions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("order_executions_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("order_executions_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_executions_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "order_executions_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const earnings = pgTable("earnings", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }),
	orderId: varchar("order_id", { length: 36 }),
	type: varchar({ length: 20 }).notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("earnings_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("earnings_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "earnings_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "earnings_avatar_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "earnings_order_id_fkey"
		}).onDelete("set null"),
]);

export const withdrawals = pgTable("withdrawals", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	method: varchar({ length: 20 }).notNull(),
	accountInfo: jsonb("account_info").default({}),
	transactionId: varchar("transaction_id", { length: 100 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("withdrawals_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "withdrawals_user_id_fkey"
		}).onDelete("cascade"),
]);

export const referrals = pgTable("referrals", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	inviterId: varchar("inviter_id", { length: 36 }).notNull(),
	inviteeId: varchar("invitee_id", { length: 36 }).notNull(),
	inviteeOpenid: varchar("invitee_openid", { length: 100 }),
	status: varchar({ length: 20 }).default('registered').notNull(),
	rewardAmount: numeric("reward_amount", { precision: 10, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	rewardedAt: timestamp("rewarded_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("referrals_invitee_id_idx").using("btree", table.inviteeId.asc().nullsLast().op("text_ops")),
	index("referrals_inviter_id_idx").using("btree", table.inviterId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.inviterId],
			foreignColumns: [users.id],
			name: "referrals_inviter_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.inviteeId],
			foreignColumns: [users.id],
			name: "referrals_invitee_id_fkey"
		}).onDelete("cascade"),
	unique("referrals_invitee_id_key").on(table.inviteeId),
]);

export const platformConfigs = pgTable("platform_configs", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	platformType: varchar("platform_type", { length: 30 }).notNull(),
	configData: jsonb("config_data").default({}),
	status: varchar({ length: 20 }).default('active').notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("platform_configs_platform_type_idx").using("btree", table.platformType.asc().nullsLast().op("text_ops")),
	index("platform_configs_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("platform_configs_user_platform_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.platformType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "platform_configs_user_id_fkey"
		}).onDelete("cascade"),
]);

export const avatarAccounts = pgTable("avatar_accounts", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	platform: varchar({ length: 30 }).notNull(),
	accountName: varchar("account_name", { length: 100 }),
	followers: integer().default(0).notNull(),
	totalExposure: integer("total_exposure").default(0).notNull(),
	totalWorks: integer("total_works").default(0).notNull(),
	avgLikesPerWork: integer("avg_likes_per_work").default(0).notNull(),
	avgCommentsPerWork: integer("avg_comments_per_work").default(0).notNull(),
	avgSharesPerWork: integer("avg_shares_per_work").default(0).notNull(),
	engagementRate: numeric("engagement_rate", { precision: 5, scale:  2 }).default('0'),
	lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appid: varchar(),
	appkey: varchar(),
	accountUrl: text("account_url"),
	extraInfo: jsonb("extra_info"),
}, (table) => [
	index("avatar_accounts_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("avatar_accounts_followers_idx").using("btree", table.followers.asc().nullsLast().op("int4_ops")),
	index("avatar_accounts_platform_idx").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	index("avatar_accounts_total_exposure_idx").using("btree", table.totalExposure.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_accounts_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const avatarSkills = pgTable("avatar_skills", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	skillType: varchar("skill_type", { length: 50 }).notNull(),
	skillLevel: integer("skill_level").default(1).notNull(),
	usageCount: integer("usage_count").default(0).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("avatar_skills_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	uniqueIndex("avatar_skills_avatar_skill_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops"), table.skillType.asc().nullsLast().op("text_ops")),
	index("avatar_skills_skill_type_idx").using("btree", table.skillType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_skills_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const avatarFriends = pgTable("avatar_friends", {
	id: serial().primaryKey().notNull(),
	avatarId: varchar("avatar_id").notNull(),
	friendAvatarId: varchar("friend_avatar_id").notNull(),
	status: varchar().default('pending'),
	matchReason: text("match_reason"),
	compatibilityScore: numeric("compatibility_score", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	conversationId: varchar("conversation_id"),
	benefits: text(),
}, (table) => [
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_friends_avatar_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.friendAvatarId],
			foreignColumns: [avatars.id],
			name: "avatar_friends_friend_avatar_id_fkey"
		}).onDelete("cascade"),
	unique("avatar_friends_avatar_id_friend_avatar_id_key").on(table.avatarId, table.friendAvatarId),
]);

export const agentTaskLogs = pgTable("agent_task_logs", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	taskId: varchar("task_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	stepIndex: integer("step_index").notNull(),
	stepType: varchar("step_type", { length: 20 }).notNull(),
	content: text(),
	toolName: varchar("tool_name", { length: 100 }),
	toolParams: jsonb("tool_params").default({}),
	toolResult: jsonb("tool_result").default({}),
	requiresConfig: boolean("requires_config").default(false),
	configPlatform: varchar("config_platform", { length: 30 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_task_logs_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("agent_task_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("agent_task_logs_task_id_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "agent_task_logs_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	price: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	durationDays: integer("duration_days").notNull(),
	maxAvatars: integer("max_avatars").default(1).notNull(),
	canReceiveOrders: boolean("can_receive_orders").default(false).notNull(),
	orderPriority: integer("order_priority").default(0).notNull(),
	features: jsonb().default({}),
	displayOrder: integer("display_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_subscription_plans_display_order").using("btree", table.displayOrder.asc().nullsLast().op("int4_ops")),
	index("idx_subscription_plans_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
]);

export const userSubscriptions = pgTable("user_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	planId: uuid("plan_id").notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }).notNull(),
	status: varchar({ length: 50 }).default('active').notNull(),
	paymentId: varchar("payment_id", { length: 255 }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	autoRenew: boolean("auto_renew").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_subscriptions_plan_id").using("btree", table.planId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_subscriptions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_user_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "user_subscriptions_plan_id_fkey"
		}),
	pgPolicy("允许所有人读取用户订阅", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("允许所有人插入用户订阅", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("允许所有人更新用户订阅", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("允许所有人删除用户订阅", { as: "permissive", for: "delete", to: ["public"] }),
]);

export const avatarSubscriptions = pgTable("avatar_subscriptions", {
	id: varchar({ length: 255 }).default(sql`(gen_random_uuid())::character varying(255)`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	avatarId: varchar("avatar_id", { length: 255 }).notNull(),
	subscriptionId: varchar("subscription_id", { length: 255 }),
	subscriptionLevel: varchar("subscription_level", { length: 50 }).default('free').notNull(),
	canReceiveOrders: boolean("can_receive_orders").default(false),
	orderPriority: integer("order_priority").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_avatar_subscriptions_avatar_id").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("idx_avatar_subscriptions_subscription_id").using("btree", table.subscriptionId.asc().nullsLast().op("text_ops")),
	index("idx_avatar_subscriptions_subscription_level").using("btree", table.subscriptionLevel.asc().nullsLast().op("text_ops")),
	index("idx_avatar_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("允许所有人读取分身订阅", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("允许所有人插入分身订阅", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("允许所有人更新分身订阅", { as: "permissive", for: "update", to: ["public"] }),
]);

export const avatarMemories = pgTable("avatar_memories", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	memoryType: varchar("memory_type", { length: 50 }).notNull(),
	content: text().notNull(),
	embedding: jsonb(),
	metadata: jsonb().default({}),
	accessCount: integer("access_count").default(0).notNull(),
	lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("avatar_memories_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("avatar_memories_memory_type_idx").using("btree", table.memoryType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_memories_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const avatarContexts = pgTable("avatar_contexts", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	contextType: varchar("context_type", { length: 50 }).notNull(),
	contextData: jsonb("context_data").notNull(),
	priority: integer().default(0).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("avatar_contexts_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("avatar_contexts_context_type_idx").using("btree", table.contextType.asc().nullsLast().op("text_ops")),
	index("avatar_contexts_priority_idx").using("btree", table.priority.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_contexts_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const avatarAgentConfigs = pgTable("avatar_agent_configs", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	systemPrompt: text("system_prompt").notNull(),
	rolePrompt: text("role_prompt"),
	temperature: numeric({ precision: 3, scale:  2 }).default('0.7'),
	maxTokens: integer("max_tokens").default(2000),
	enabledTools: jsonb("enabled_tools").default([]).notNull(),
	knowledgeBases: jsonb("knowledge_bases").default([]).notNull(),
	reasoningMode: varchar("reasoning_mode", { length: 50 }).default('react').notNull(),
	learningEnabled: boolean("learning_enabled").default(true).notNull(),
	memoryConfig: jsonb("memory_config").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("avatar_agent_configs_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_agent_configs_avatar_id_fkey"
		}).onDelete("cascade"),
	unique("avatar_agent_configs_avatar_id_key").on(table.avatarId),
]);

export const avatarLearningRecords = pgTable("avatar_learning_records", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	learningType: varchar("learning_type", { length: 50 }).notNull(),
	inputData: jsonb("input_data").notNull(),
	outputData: jsonb("output_data").notNull(),
	feedbackScore: integer("feedback_score"),
	learnedKnowledge: text("learned_knowledge"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("avatar_learning_records_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("avatar_learning_records_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("avatar_learning_records_learning_type_idx").using("btree", table.learningType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "avatar_learning_records_avatar_id_fkey"
		}).onDelete("cascade"),
]);

export const skills = pgTable("skills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	category: text().notNull(),
	price: numeric({ precision: 10, scale:  2 }).default('0.00').notNull(),
	icon: text(),
	tags: jsonb().default([]),
	capabilities: jsonb().default({}),
	requirements: text(),
	status: text().default('active'),
	rating: numeric({ precision: 3, scale:  2 }).default('0.00'),
	ratingCount: integer("rating_count").default(0),
	purchaseCount: integer("purchase_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	toolName: text("tool_name"),
	type: text().default('prebuilt'),
}, (table) => [
	check("skills_type_check", sql`type = ANY (ARRAY['prebuilt'::text, 'custom'::text, 'paid'::text])`),
]);

export const avatarBlocks = pgTable("avatar_blocks", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "avatar_blocks_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	avatarId: varchar("avatar_id").notNull(),
	blockedAvatarId: varchar("blocked_avatar_id").notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("unique_block").on(table.avatarId, table.blockedAvatarId),
	check("not_self_block", sql`(avatar_id)::text <> (blocked_avatar_id)::text`),
]);

export const orderDispatchRequests = pgTable("order_dispatch_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	avatarId: uuid("avatar_id").notNull(),
	userId: uuid("user_id").notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	score: integer().default(0),
	matchReasons: text("match_reasons").array(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	generatedContent: text("generated_content"),
	confirmedContent: text("confirmed_content"),
	publishStatus: jsonb("publish_status"),
	publishFeedback: jsonb("publish_feedback"),
});

export const generatedContent = pgTable("generated_content", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	requestId: uuid("request_id").notNull(),
	avatarId: uuid("avatar_id").notNull(),
	platform: text().notNull(),
	title: text(),
	content: text().notNull(),
	hashtags: jsonb().default([]),
	imageSuggestions: jsonb("image_suggestions").default([]),
	videoSuggestions: jsonb("video_suggestions").default([]),
	status: text().default('draft'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_generated_content_avatar_id").using("btree", table.avatarId.asc().nullsLast().op("uuid_ops")),
	index("idx_generated_content_order_id").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
	index("idx_generated_content_request_id").using("btree", table.requestId.asc().nullsLast().op("uuid_ops")),
	index("idx_generated_content_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const avatarFollows = pgTable("avatar_follows", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	avatarId: uuid("avatar_id").notNull(),
	targetAvatarId: uuid("target_avatar_id").notNull(),
	followLevel: varchar("follow_level", { length: 50 }).default('normal'),
	followReason: text("follow_reason"),
	interactionScore: numeric("interaction_score", { precision: 5, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("avatar_follows_avatar_id_target_avatar_id_key").on(table.avatarId, table.targetAvatarId),
]);

export const avatarAffinity = pgTable("avatar_affinity", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	avatarId: uuid("avatar_id").notNull(),
	targetAvatarId: uuid("target_avatar_id").notNull(),
	affinityScore: numeric("affinity_score", { precision: 5, scale:  2 }).default('0'),
	trustScore: numeric("trust_score", { precision: 5, scale:  2 }).default('0'),
	sharedInterests: jsonb("shared_interests"),
	personalityCompatibility: numeric("personality_compatibility", { precision: 5, scale:  2 }).default('0'),
	potentialValue: text("potential_value"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("avatar_affinity_avatar_id_target_avatar_id_key").on(table.avatarId, table.targetAvatarId),
]);

export const publishedWorks = pgTable("published_works", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	avatarId: varchar("avatar_id", { length: 36 }).notNull(),
	platform: varchar({ length: 30 }).notNull(),
	workTitle: varchar("work_title", { length: 500 }),
	workUrl: varchar("work_url", { length: 1000 }).notNull(),
	authorNickname: varchar("author_nickname", { length: 200 }),
	coverImage: varchar("cover_image", { length: 1000 }),
	description: text(),
	extraData: jsonb("extra_data").default({}),
	status: varchar({ length: 20 }).default('verified').notNull(),
	feedbackImage: varchar("feedback_image", { length: 1000 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("published_works_avatar_id_idx").using("btree", table.avatarId.asc().nullsLast().op("text_ops")),
	index("published_works_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("published_works_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("published_works_platform_idx").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	index("published_works_work_url_idx").using("btree", table.workUrl.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "published_works_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.avatarId],
			foreignColumns: [avatars.id],
			name: "published_works_avatar_id_fkey"
		}).onDelete("cascade"),
]);
