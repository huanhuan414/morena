import { Controller, Get, Post, Delete, Body, Param, Headers, Query } from '@nestjs/common'
import { SocialService } from './social.service'

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('followers')
  async getFollowersAndFollowing(@Headers('x-user-id') userId: string) {
    const result = await this.socialService.getFollowersAndFollowing(userId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  @Post('post')
  async createPost(
    @Headers('x-user-id') userId: string,
    @Body() postData: Record<string, any>
  ) {
    const post = await this.socialService.createPost(userId, postData)
    return {
      code: 200,
      data: post,
      message: '发布成功'
    }
  }

  /**
   * 获取与用户分身相关的帖子
   * 包括：分身发布的、分身点赞的、分身评论过的
   */
  @Get('avatar-posts')
  async getAvatarRelatedPosts(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.socialService.getAvatarRelatedPosts(
      userId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取用户分身今日统计
   */
  @Get('today-stats')
  async getAvatarTodayStats(@Headers('x-user-id') userId: string) {
    const result = await this.socialService.getAvatarTodayStats(userId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取用户分身累计统计
   */
  @Get('total-stats')
  async getAvatarTotalStats(@Headers('x-user-id') userId: string) {
    const result = await this.socialService.getAvatarTotalStats(userId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  @Get('posts')
  async getPosts(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.socialService.getPosts(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
      userId
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  @Get('post/:id')
  async getPost(@Param('id') postId: string) {
    const post = await this.socialService.getPostById(postId)
    return {
      code: 200,
      data: post,
      message: '获取成功'
    }
  }

  @Delete('post/:id')
  async deletePost(
    @Param('id') postId: string,
    @Headers('x-user-id') userId: string
  ) {
    await this.socialService.deletePost(postId, userId)
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }

  @Post('post/:id/like')
  async likePost(
    @Param('id') postId: string,
    @Headers('x-user-id') userId: string,
    @Body('avatar_id') avatarId?: string
  ) {
    const result = await this.socialService.likePost(userId, postId, avatarId)
    return {
      code: 200,
      data: result,
      message: result.liked ? '点赞成功' : '取消点赞'
    }
  }

  @Post('post/:id/comment')
  async createComment(
    @Param('id') postId: string,
    @Headers('x-user-id') userId: string,
    @Body('content') content: string,
    @Body('parent_id') parentId?: string,
    @Body('avatar_id') avatarId?: string
  ) {
    const comment = await this.socialService.createComment(userId, postId, content, parentId, avatarId)
    return {
      code: 200,
      data: comment,
      message: '评论成功'
    }
  }

  @Get('post/:id/comments')
  async getComments(
    @Param('id') postId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const comments = await this.socialService.getComments(
      postId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20
    )
    return {
      code: 200,
      data: comments,
      message: '获取成功'
    }
  }

  @Get('post/:id/likes')
  async getLikes(
    @Param('id') postId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const likes = await this.socialService.getLikes(
      postId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20
    )
    return {
      code: 200,
      data: likes,
      message: '获取成功'
    }
  }

  @Post('follow/:userId')
  async followUser(
    @Param('userId') targetUserId: string,
    @Headers('x-user-id') userId: string
  ) {
    const result = await this.socialService.followUser(userId, targetUserId)
    return {
      code: 200,
      data: result,
      message: result.following ? '关注成功' : '取消关注'
    }
  }

  @Get('user/:userId/posts')
  async getUserPosts(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const posts = await this.socialService.getUserPosts(
      userId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20
    )
    return {
      code: 200,
      data: posts,
      message: '获取成功'
    }
  }

  @Post('post/:id/share')
  async sharePost(
    @Param('id') postId: string,
    @Headers('x-user-id') userId: string
  ) {
    const result = await this.socialService.sharePost(userId, postId)
    return {
      code: 200,
      data: result,
      message: '分享成功'
    }
  }

  /**
   * 获取所有分身的帖子列表
   */
  @Get('all-posts')
  async getAllPosts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: string,
    @Query('filter') filter?: string
  ) {
    const result = await this.socialService.getAllPosts(
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 20,
      sort,
      filter
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }
}
