#!/usr/bin/env python3
"""
压缩分享图片脚本
将图片压缩到符合微信小程序分享图片要求（≤128KB）
"""

from PIL import Image
import os

# 图片路径
input_path = r'C:\Users\xiao\Desktop\微信图片_20260609194032_6864_6_副本.png'
output_path = r'C:\Users\xiao\Desktop\projrct\morena\public\assets\image\share_new.png'

# 打开图片
img = Image.open(input_path)
print(f'原始尺寸: {img.size}')
print(f'原始格式: {img.format}')
print(f'原始大小: {os.path.getsize(input_path) / 1024:.1f} KB')

# 转换为RGB模式（PNG可能有透明通道）
if img.mode == 'RGBA':
    # 创建白色背景
    background = Image.new('RGB', img.size, (255, 255, 255))
    background.paste(img, mask=img.split()[3])  # 使用alpha通道作为mask
    img = background
elif img.mode != 'RGB':
    img = img.convert('RGB')

# 调整尺寸（保持5:4比例，适合微信分享）
# 微信分享图片推荐尺寸：500x400
target_width = 500
target_height = 400

# 计算缩放比例
width, height = img.size
ratio = min(target_width / width, target_height / height)
new_width = int(width * ratio)
new_height = int(height * ratio)

# 缩放图片
img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

# 如果尺寸不是500x400，创建一个500x400的画布，居中放置图片
if new_width != target_width or new_height != target_height:
    canvas = Image.new('RGB', (target_width, target_height), (255, 255, 255))
    x = (target_width - new_width) // 2
    y = (target_height - new_height) // 2
    canvas.paste(img_resized, (x, y))
    img_final = canvas
else:
    img_final = img_resized

# 保存压缩后的图片
img_final.save(output_path, 'PNG', optimize=True)

# 检查压缩后的大小
output_size = os.path.getsize(output_path)
print(f'压缩后尺寸: {img_final.size}')
print(f'压缩后大小: {output_size / 1024:.1f} KB')

# 如果还是超过128KB，进一步压缩质量
if output_size > 128 * 1024:
    # 转换为JPG格式，进一步压缩
    jpg_path = output_path.replace('.png', '.jpg')
    img_final.save(jpg_path, 'JPEG', quality=85, optimize=True)
    jpg_size = os.path.getsize(jpg_path)
    print(f'JPG格式大小: {jpg_size / 1024:.1f} KB')
    
    if jpg_size <= 128 * 1024:
        print(f'✓ 压缩成功！最终文件: {jpg_path}')
        print(f'✓ 文件大小: {jpg_size / 1024:.1f} KB (符合微信要求)')
    else:
        # 进一步降低质量
        for quality in [80, 75, 70, 65, 60]:
            img_final.save(jpg_path, 'JPEG', quality=quality, optimize=True)
            jpg_size = os.path.getsize(jpg_path)
            if jpg_size <= 128 * 1024:
                print(f'✓ 压缩成功！质量: {quality}%')
                print(f'✓ 文件大小: {jpg_size / 1024:.1f} KB')
                break
else:
    print(f'✓ 压缩成功！文件大小符合要求')