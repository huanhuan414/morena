const { preview, Project } = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

async function generatePreview() {
  try {
    const project = new Project({
      appid: 'wxa300e3c1f0adc655',
      type: 'miniProgram',
      projectPath: './dist-weapp',
      privateKeyPath: './key/private.appid.key',
    });
    
    const outputPath = '/workspace/projects/preview-qrcode.png';
    
    const result = await preview({
      project: project,
      desc: 'Morina AI Platform Preview',
      setting: {
        es6: false,
        es7: false,
        minify: false,
        minifyWXML: false,
        minifyWXSS: false,
        minifyJS: false,
      },
      qrcodeFormat: 'image',
      qrcodeOutputDest: outputPath,
      onProgressUpdate: (progress) => {
        // 静默处理进度
      },
    });
    
    console.log('QR code saved to:', outputPath);
    
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('File size:', stats.size, 'bytes');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generatePreview();
