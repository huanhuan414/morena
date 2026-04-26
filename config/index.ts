import fs from 'node:fs';
import path from 'node:path';

import tailwindcss from '@tailwindcss/postcss';
import { UnifiedViteWeappTailwindcssPlugin } from 'weapp-tailwindcss/vite';
import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import type { PluginItem } from '@tarojs/taro/types/compile/config/project';
import dotenv from 'dotenv';
import devConfig from './dev';
import prodConfig from './prod';
import pkg from '../package.json';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const generateTTProjectConfig = (outputRoot: string) => {
  const config = {
    miniprogramRoot: './',
    projectname: 'morina-ai-miniprogram',
    appid: process.env.TARO_APP_TT_APPID || '',
    setting: {
      urlCheck: false,
      es6: false,
      postcss: false,
      minified: true,
    },
  };
  const outputDir = path.resolve(__dirname, '..', outputRoot);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(outputDir, 'project.config.json'),
    JSON.stringify(config, null, 2),
  );
};

// 生成微信小程序项目配置
const generateWeappProjectConfig = (outputRoot: string) => {
  const config = {
    miniprogramRoot: './',
    projectname: 'coze-mini-program',
    description: 'Morina AI Platform - AI Native Human-Machine Symbiosis Ecosystem',
    appid: process.env.TARO_APP_WEAPP_APPID || 'wxfcd0d7ba0294417d',
    setting: {
      urlCheck: false,
      es6: false,
      enhance: false,
      compileHotReLoad: false,
      postcss: false,
      minified: false,
      newFeature: true,
      coverView: true,
      nodeModules: false,
      autoAudits: false,
      showShadowRootInWxmlPanel: true,
      scopeDataCheck: false,
      uglifyFileName: true,
      checkInvalidKey: true,
      checkSiteMap: true,
      uploadWithSourceMap: false,
      lazyloadPlaceholderEnable: false,
      useMultiFrameRuntime: true,
      useApiHook: true,
      useApiHostProcess: true,
      enableEngineNative: false,
      useIsolateContext: true,
      userConfirmedBundleSwitch: false,
      packNpmManually: false,
      packNpmRelationList: [],
      minifyWXSS: true,
      disableUseStrict: false,
      minifyWXML: true,
      showES6CompileOption: false,
      useCompilerPlugins: false
    },
    compileType: 'miniprogram',
    libVersion: '3.3.4',
    packOptions: {
      ignore: []
    },
    condition: {}
  };
  const outputDir = path.resolve(__dirname, '..', outputRoot);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.resolve(outputDir, 'project.config.json'),
    JSON.stringify(config, null, 2),
  );
  
  // 生成 sitemap.json
  const sitemapConfig = {
    desc: '关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/framework/sitemap.html',
    rules: [
      { action: 'allow', page: '*' }
    ]
  };
  fs.writeFileSync(
    path.resolve(outputDir, 'sitemap.json'),
    JSON.stringify(sitemapConfig, null, 2),
  );
};

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge, _env) => {
  const outputRootMap: Record<string, string> = {
    weapp: 'dist-weapp',
    tt: 'dist-tt',
    h5: 'dist-web',
  };
  const defaultOutputRoot = outputRootMap[process.env.TARO_ENV || ''] || 'dist';
  const outputRoot = process.env.OUTPUT_ROOT?.trim() || defaultOutputRoot;
  const isH5 = process.env.TARO_ENV === 'h5';

  const buildMiniCIPluginConfig = () => {
    const hasWeappConfig = !!process.env.TARO_APP_WEAPP_APPID;
    const hasTTConfig = !!process.env.TARO_APP_TT_EMAIL;
    if (!hasWeappConfig && !hasTTConfig) {
      return [];
    }
    const miniCIConfig: Record<string, any> = {
      version: pkg.version,
      desc: pkg.description,
    };
    if (hasWeappConfig) {
      miniCIConfig.weapp = {
        appid: process.env.TARO_APP_WEAPP_APPID,
        privateKeyPath: 'key/private.appid.key',
      };
    }
    if (hasTTConfig) {
      miniCIConfig.tt = {
        email: process.env.TARO_APP_TT_EMAIL,
        password: process.env.TARO_APP_TT_PASSWORD,
        setting: {
          skipDomainCheck: true,
        },
      };
    }
    return [['@tarojs/plugin-mini-ci', miniCIConfig]] as PluginItem[];
  };

  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'coze-mini-program',
    date: '2026-1-13',
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot,
    plugins: ['@tarojs/plugin-generator', ...buildMiniCIPluginConfig()],
    defineConstants: {
      PROJECT_DOMAIN: JSON.stringify(
        process.env.PROJECT_DOMAIN ||
          process.env.COZE_PROJECT_DOMAIN_DEFAULT ||
          '',
      ),
      TARO_ENV: JSON.stringify(process.env.TARO_ENV),
    },
    copy: {
      patterns: [],
      options: {},
    },
    // 确保 Vite 正确处理 TypeScript 文件
    optimizeDeps: {
      include: [],
      esbuildOptions: {
        loader: {
          '.ts': 'ts',
          '.tsx': 'tsx',
        },
      },
    },
    ...(process.env.TARO_ENV === 'tt' && {
      tt: {
        appid: process.env.TARO_APP_TT_APPID,
        projectName: 'coze-mini-program',
      },
    }),
    jsMinimizer: 'esbuild',
    framework: 'react',
    compiler: {
      type: 'vite',
      vitePlugins: [
        {
          name: 'postcss-config-loader-plugin',
          config(config) {
            // 通过 postcss 配置注册 tailwindcss 插件
            if (typeof config.css?.postcss === 'object') {
              config.css?.postcss.plugins?.unshift(tailwindcss());
            }
          },
        },
        {
          name: 'fix-inject-plugin',
          enforce: 'pre',
          configResolved(config) {
            // 修复 rollup-plugin-inject 解析 TypeScript 文件的问题
            // 直接移除 inject 插件（因为它不支持 TypeScript）
            const plugins = config.plugins || [];
            const injectIndex = plugins.findIndex((p: any) => p?.name === 'inject');
            if (injectIndex !== -1) {
              console.log('[fix-inject-plugin] 移除 inject 插件以避免 TypeScript 解析错误');
              plugins.splice(injectIndex, 1);
            }
          },
        },
        {
          name: 'force-tsx-transform',
          enforce: 'pre',
          transform(_code, _id) {
            // 不再阻止 Vite 的 esbuild 转换
            // 只确保 .ts 和 .tsx 文件被正确处理
            return null;
          }
        },
        {
          // 移除 build-import-analysis 插件以避免解析问题
          name: 'remove-build-import-analysis',
          enforce: 'post',
          configResolved(config) {
            const plugins = config.plugins || [];
            const importAnalysisIndex = plugins.findIndex((p: any) => p?.name === 'vite:build-import-analysis');
            if (importAnalysisIndex !== -1) {
              console.log('[remove-build-import-analysis] 移除 build-import-analysis 插件');
              plugins.splice(importAnalysisIndex, 1);
            }
          }
        },
        {
          // 修复 network/index.ts 的解析问题 - 在 Vite 的 define 中注入变量
          name: 'fix-network-define',
          enforce: 'pre',
          config(config) {
            // 确保 Vite 的 define 配置包含 PROJECT_DOMAIN
            config.define = config.define || {};
            (config.define as Record<string, string>).PROJECT_DOMAIN = JSON.stringify(
              process.env.PROJECT_DOMAIN ||
              process.env.COZE_PROJECT_DOMAIN_DEFAULT ||
              ''
            );
          }
        },
        {
          name: 'hmr-config-plugin',
          config() {
            if (!process.env.PROJECT_DOMAIN) {
              return;
            }
            return {
              server: {
                hmr: {
                  overlay: true,
                  path: '/hot/vite-hmr',
                  port: 6000,
                  clientPort: 443,
                  timeout: 30000,
                },
              },
            };
          },
        },
        ...(isH5
          ? []
          : [
              UnifiedViteWeappTailwindcssPlugin({
                rem2rpx: true,
                cssEntries: [path.resolve(__dirname, '../src/app.css')],
              }),
            ]),
        ...(process.env.TARO_ENV === 'tt'
          ? [
              {
                name: 'generate-tt-project-config',
                closeBundle() {
                  generateTTProjectConfig(outputRoot);
                },
              },
            ]
          : []),
        ...(process.env.TARO_ENV === 'weapp'
          ? [
              {
                name: 'generate-weapp-project-config',
                closeBundle() {
                  generateWeappProjectConfig(outputRoot);
                },
              },
            ]
          : []),
      ],
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    h5: {
      publicPath: './',
      staticDirectory: 'static',
      router: {
        mode: 'hash',
      },
      devServer: {
        port: 5000,
        host: '0.0.0.0',
        open: false,
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        pxtransform: {
          enable: true,
          config: {
            platform: 'h5',
          },
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    rn: {
      appName: 'coze-mini-program',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        },
      },
    },
  };

  process.env.BROWSERSLIST_ENV = process.env.NODE_ENV;

  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig);
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig);
});
