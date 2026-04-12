const QRCode = require('qrcode');
const path = require('path');

// 生成小程序预览二维码
async function generateQRCode() {
  try {
    // 使用 localhost 预览地址
    const url = 'http://localhost:5000';
    const outputPath = path.join(__dirname, 'preview-qrcode.png');

    console.log('正在生成二维码...');
    console.log('URL:', url);

    // 生成二维码
    await QRCode.toFile(outputPath, url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });

    console.log('✅ 二维码生成成功！');
    console.log('文件路径:', outputPath);
    console.log('内容:', url);
    console.log('');
    console.log('注意：这是 H5 预览二维码，不是微信小程序预览二维码。');
    console.log('如需生成微信小程序预览二维码，请使用微信开发者工具的"预览"功能。');

  } catch (error) {
    console.error('❌ 生成二维码失败:', error);
    process.exit(1);
  }
}

generateQRCode();
