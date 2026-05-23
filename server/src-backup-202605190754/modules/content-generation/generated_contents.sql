-- 创建生成内容表
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES order_dispatch_requests(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  hashtags JSONB DEFAULT '[]'::jsonb,
  image_suggestions JSONB DEFAULT '[]'::jsonb,
  video_suggestions JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_generated_content_order_id ON generated_content(order_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_request_id ON generated_content(request_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_avatar_id ON generated_content(avatar_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_status ON generated_content(status);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_generated_content_updated_at
    BEFORE UPDATE ON generated_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
