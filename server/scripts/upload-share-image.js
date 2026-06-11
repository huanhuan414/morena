/**
 * 上传分享图片到火山CDN
 * 
 * 使用方法：
 * 1. 方式一：配置环境变量后运行
 *    - 在根目录创建 .env 文件，配置 VOLC_ACCESS_KEY 和 VOLC_SECRET_KEY
 *    - 运行：node upload-share-image.js
 * 
 * 2. 方式二：直接传递参数运行
 *    - 运行：node upload-share-image.js YOUR_ACCESS_KEY YOUR_SECRET_KEY
 * 
 * 输出：火山CDN链接
 */

const { ImageXClient } = require('@volcengine/imagex-openapi');
const fs = require('fs');
const path = require('path');

// 火山CDN配置
const SHORT_ID = '699z2ac540';
const CUSTOM_DOMAIN = 'voic.51webjs.com';

// 图片路径
const IMAGE_PATH = path.join(__dirname, '../../public/assets/image/share_new.jpg');

// 加载环境变量
function loadEnv() {
  // 优先使用命令行参数
  if (process.argv.length >= 4) {
    return {
      accessKey: process.argv[2],
      secretKey: process.argv[3]
    };
  }
  
  // 尝试从多个位置加载 .env 文件
  const envPaths = [
    path.join(__dirname, '../../.env'),           // 项目根目录
    path.join(__dirname, '../.env'),              // server目录
    path.join(__dirname, '.env'),                 // scripts目录
  ];
  
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      const env = {};
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
          const [key, ...values] = trimmedLine.split('=');
          const value = values.join('=').trim();
          if (key && value) {
            env[key] = value;
          }
        }
      });
      
      if (env.VOLC_ACCESS_KEY && env.VOLC_SECRET_KEY) {
        console.log(`✓ 从 ${envPath} 加载配置`);
        return {
          accessKey: env.VOLC_ACCESS_KEY,
          secretKey: env.VOLC_SECRET_KEY
        };
      }
    }
  }
  
  // 使用系统环境变量
  return {
    accessKey: process.env.VOLC_ACCESS_KEY,
    secretKey: process.env.VOLC_SECRET_KEY
  };
}

async function uploadImage() {
  console.log('========================================');
  console.log('开始上传分享图片到火山CDN');
  console.log('========================================');
  
  // 1. 加载环境变量
  const { accessKey, secretKey } = loadEnv();
  
  if (!accessKey || !secretKey) {
    console.error('❌ 错误：环境变量未配置');
    console.error('\n请使用以下方式之一配置：');
    console.error('\n方式一：创建 .env 文件');
    console.error('  在项目根目录创建 .env 文件，添加以下内容：');
    console.error('  VOLC_ACCESS_KEY=你的AccessKey');
    console.error('  VOLC_SECRET_KEY=你的SecretKey');
    console.error('\n方式二：命令行参数');
    console.error('  node upload-share-image.js YOUR_ACCESS_KEY YOUR_SECRET_KEY');
    process.exit(1);
  }
  
  console.log('✓ 环境变量已配置');
  console.log(`  Access Key: ${accessKey.substring(0, 8)}...`);
  
  // 2. 检查图片文件
  if (!fs.existsSync(IMAGE_PATH)) {
    console.error('❌ 错误：图片文件不存在');
    console.error(`路径：${IMAGE_PATH}`);
    process.exit(1);
  }
  
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const imageSize = imageBuffer.length;
  
  console.log('✓ 图片文件已找到');
  console.log(`  路径：${IMAGE_PATH}`);
  console.log(`  大小：${(imageSize / 1024).toFixed(2)} KB`);
  
  // 3. 创建客户端
  const client = new ImageXClient({
    accessKey: accessKey,
    secretKey: secretKey,
    region: 'cn-north-1',
    host: 'imagex.volcengineapi.com',
  });
  
  console.log('✓ 火山CDN客户端已创建');
  
  // 4. 生成文件名
  let hash = '';
  for (let i = 0; i < 8; i++) {
    hash += Math.random().toString(16).substring(2, 6);
  }
  hash = hash.substring(0, 32);
  
  const storeKey = `user/${hash}.png`;
  console.log(`✓ 文件名已生成：${storeKey}`);
  
  try {
    // 5. 获取上传凭证
    console.log('\n步骤1：获取上传凭证...');
    const applyRes = await client.ApplyImageUpload({
      ServiceId: SHORT_ID,
      UploadNum: 1,
      StoreKeys: [storeKey],
    });
    
    if (applyRes.ResponseMetadata?.Error) {
      throw new Error(`获取上传凭证失败: ${applyRes.ResponseMetadata.Error.Message}`);
    }
    
    if (!applyRes.Result?.UploadAddress?.StoreInfos?.length) {
      throw new Error('上传凭证响应格式错误');
    }
    
    console.log('✓ 上传凭证已获取');
    
    const uploadAddress = applyRes.Result.UploadAddress;
    
    // 6. 上传文件
    console.log('\n步骤2：上传文件...');
    await client.DoUpload(
      [imageBuffer],
      uploadAddress.UploadHosts[0],
      uploadAddress.StoreInfos
    );
    
    console.log('✓ 文件已上传');
    
    // 7. 确认上传
    console.log('\n步骤3：确认上传...');
    const commitRes = await client.CommitImageUpload({
      ServiceId: SHORT_ID,
      SessionKey: uploadAddress.SessionKey,
    });
    
    if (commitRes.ResponseMetadata?.Error) {
      throw new Error(`确认上传失败: ${commitRes.ResponseMetadata.Error.Message}`);
    }
    
    if (!commitRes.Result?.Results?.length) {
      throw new Error('确认上传响应中没有结果');
    }
    
    const result = commitRes.Result.Results[0];
    
    if (!result.Uri) {
      throw new Error('上传结果中没有URI');
    }
    
    console.log('✓ 上传已确认');
    
    // 8. 构建CDN链接
    const uri = result.Uri;
    const encodedUri = uri.replace('user/', 'user%2F');
    const cdnUrl = `https://${CUSTOM_DOMAIN}/${encodedUri}~tplv-${SHORT_ID}-image.png`;
    
    console.log('\n========================================');
    console.log('✅ 上传成功！');
    console.log('========================================');
    console.log('\n火山CDN链接：');
    console.log(cdnUrl);
    console.log('\n请将此链接配置到分享代码中：');
    console.log(`imageUrl: '${cdnUrl}'`);
    console.log('\n文件位置：');
    console.log(`src/package-profile/pages/referral-center/index.tsx`);
    console.log('\n========================================');
    
    return cdnUrl;
    
  } catch (error) {
    console.error('\n❌ 上传失败：', error.message);
    console.error('错误详情：', error);
    process.exit(1);
  }
}

// 执行上传
uploadImage();