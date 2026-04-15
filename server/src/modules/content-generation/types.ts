export interface GeneratedContent {
  id?: string
  order_id: string
  request_id: string
  avatar_id: string
  platform: string
  content: string
  hashtags: string[]
  image_suggestions: string[]
  video_suggestions: string[]
  title?: string
  status: 'draft' | 'approved' | 'published'
  created_at: string
}
