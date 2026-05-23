import { relations } from "drizzle-orm/relations";
import { posts, comments, users, avatars, conversations, messages, orders, orderResults, follows, avatarEvolution, likes, notifications, orderExecutions, earnings, withdrawals, referrals, platformConfigs, avatarAccounts, avatarSkills, avatarFriends, agentTaskLogs, subscriptionPlans, userSubscriptions, avatarMemories, avatarContexts, avatarAgentConfigs, avatarLearningRecords, publishedWorks } from "./schema";

export const commentsRelations = relations(comments, ({one, many}) => ({
	post: one(posts, {
		fields: [comments.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [comments.userId],
		references: [users.id]
	}),
	comment: one(comments, {
		fields: [comments.parentId],
		references: [comments.id],
		relationName: "comments_parentId_comments_id"
	}),
	comments: many(comments, {
		relationName: "comments_parentId_comments_id"
	}),
	avatar: one(avatars, {
		fields: [comments.avatarId],
		references: [avatars.id]
	}),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	comments: many(comments),
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
	avatar: one(avatars, {
		fields: [posts.avatarId],
		references: [avatars.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	comments: many(comments),
	conversations: many(conversations),
	user: one(users, {
		fields: [users.invitedBy],
		references: [users.id],
		relationName: "users_invitedBy_users_id"
	}),
	users: many(users, {
		relationName: "users_invitedBy_users_id"
	}),
	follows_followerId: many(follows, {
		relationName: "follows_followerId_users_id"
	}),
	follows_followingId: many(follows, {
		relationName: "follows_followingId_users_id"
	}),
	posts: many(posts),
	orders: many(orders),
	likes: many(likes),
	notifications: many(notifications),
	earnings: many(earnings),
	withdrawals: many(withdrawals),
	referrals_inviterId: many(referrals, {
		relationName: "referrals_inviterId_users_id"
	}),
	referrals_inviteeId: many(referrals, {
		relationName: "referrals_inviteeId_users_id"
	}),
	platformConfigs: many(platformConfigs),
}));

export const avatarsRelations = relations(avatars, ({many}) => ({
	comments: many(comments),
	conversations: many(conversations),
	orderResults: many(orderResults),
	avatarEvolutions: many(avatarEvolution),
	posts: many(posts),
	orders: many(orders),
	orderExecutions: many(orderExecutions),
	earnings: many(earnings),
	avatarAccounts: many(avatarAccounts),
	avatarSkills: many(avatarSkills),
	avatarFriends_avatarId: many(avatarFriends, {
		relationName: "avatarFriends_avatarId_avatars_id"
	}),
	avatarFriends_friendAvatarId: many(avatarFriends, {
		relationName: "avatarFriends_friendAvatarId_avatars_id"
	}),
	agentTaskLogs: many(agentTaskLogs),
	avatarMemories: many(avatarMemories),
	avatarContexts: many(avatarContexts),
	avatarAgentConfigs: many(avatarAgentConfigs),
	avatarLearningRecords: many(avatarLearningRecords),
	publishedWorks: many(publishedWorks),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	user: one(users, {
		fields: [conversations.userId],
		references: [users.id]
	}),
	avatar: one(avatars, {
		fields: [conversations.avatarId],
		references: [avatars.id]
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const orderResultsRelations = relations(orderResults, ({one}) => ({
	order: one(orders, {
		fields: [orderResults.orderId],
		references: [orders.id]
	}),
	avatar: one(avatars, {
		fields: [orderResults.avatarId],
		references: [avatars.id]
	}),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	orderResults: many(orderResults),
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	avatar: one(avatars, {
		fields: [orders.avatarId],
		references: [avatars.id]
	}),
	orderExecutions: many(orderExecutions),
	earnings: many(earnings),
	publishedWorks: many(publishedWorks),
}));

export const followsRelations = relations(follows, ({one}) => ({
	user_followerId: one(users, {
		fields: [follows.followerId],
		references: [users.id],
		relationName: "follows_followerId_users_id"
	}),
	user_followingId: one(users, {
		fields: [follows.followingId],
		references: [users.id],
		relationName: "follows_followingId_users_id"
	}),
}));

export const avatarEvolutionRelations = relations(avatarEvolution, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarEvolution.avatarId],
		references: [avatars.id]
	}),
}));

export const likesRelations = relations(likes, ({one}) => ({
	user: one(users, {
		fields: [likes.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const orderExecutionsRelations = relations(orderExecutions, ({one}) => ({
	order: one(orders, {
		fields: [orderExecutions.orderId],
		references: [orders.id]
	}),
	avatar: one(avatars, {
		fields: [orderExecutions.avatarId],
		references: [avatars.id]
	}),
}));

export const earningsRelations = relations(earnings, ({one}) => ({
	user: one(users, {
		fields: [earnings.userId],
		references: [users.id]
	}),
	avatar: one(avatars, {
		fields: [earnings.avatarId],
		references: [avatars.id]
	}),
	order: one(orders, {
		fields: [earnings.orderId],
		references: [orders.id]
	}),
}));

export const withdrawalsRelations = relations(withdrawals, ({one}) => ({
	user: one(users, {
		fields: [withdrawals.userId],
		references: [users.id]
	}),
}));

export const referralsRelations = relations(referrals, ({one}) => ({
	user_inviterId: one(users, {
		fields: [referrals.inviterId],
		references: [users.id],
		relationName: "referrals_inviterId_users_id"
	}),
	user_inviteeId: one(users, {
		fields: [referrals.inviteeId],
		references: [users.id],
		relationName: "referrals_inviteeId_users_id"
	}),
}));

export const platformConfigsRelations = relations(platformConfigs, ({one}) => ({
	user: one(users, {
		fields: [platformConfigs.userId],
		references: [users.id]
	}),
}));

export const avatarAccountsRelations = relations(avatarAccounts, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarAccounts.avatarId],
		references: [avatars.id]
	}),
}));

export const avatarSkillsRelations = relations(avatarSkills, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarSkills.avatarId],
		references: [avatars.id]
	}),
}));

export const avatarFriendsRelations = relations(avatarFriends, ({one}) => ({
	avatar_avatarId: one(avatars, {
		fields: [avatarFriends.avatarId],
		references: [avatars.id],
		relationName: "avatarFriends_avatarId_avatars_id"
	}),
	avatar_friendAvatarId: one(avatars, {
		fields: [avatarFriends.friendAvatarId],
		references: [avatars.id],
		relationName: "avatarFriends_friendAvatarId_avatars_id"
	}),
}));

export const agentTaskLogsRelations = relations(agentTaskLogs, ({one}) => ({
	avatar: one(avatars, {
		fields: [agentTaskLogs.avatarId],
		references: [avatars.id]
	}),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({one}) => ({
	subscriptionPlan: one(subscriptionPlans, {
		fields: [userSubscriptions.planId],
		references: [subscriptionPlans.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({many}) => ({
	userSubscriptions: many(userSubscriptions),
}));

export const avatarMemoriesRelations = relations(avatarMemories, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarMemories.avatarId],
		references: [avatars.id]
	}),
}));

export const avatarContextsRelations = relations(avatarContexts, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarContexts.avatarId],
		references: [avatars.id]
	}),
}));

export const avatarAgentConfigsRelations = relations(avatarAgentConfigs, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarAgentConfigs.avatarId],
		references: [avatars.id]
	}),
}));

export const avatarLearningRecordsRelations = relations(avatarLearningRecords, ({one}) => ({
	avatar: one(avatars, {
		fields: [avatarLearningRecords.avatarId],
		references: [avatars.id]
	}),
}));

export const publishedWorksRelations = relations(publishedWorks, ({one}) => ({
	order: one(orders, {
		fields: [publishedWorks.orderId],
		references: [orders.id]
	}),
	avatar: one(avatars, {
		fields: [publishedWorks.avatarId],
		references: [avatars.id]
	}),
}));