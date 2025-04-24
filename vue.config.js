const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,

  // 开发服务器配置
  devServer: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    historyApiFallback: true // 添加历史模式支持，确保刷新时不会404
  },

  // 构建配置
  configureWebpack: {
    // 性能提示
    performance: {
      hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
      maxAssetSize: 512000, // 500KiB
      maxEntrypointSize: 512000 // 500KiB
    }
  },

  // PWA配置
  pwa: {
    name: '专利化学式提取系统',
    themeColor: '#4A90E2',
    msTileColor: '#4A90E2',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent'
  },

  // CSS配置
  css: {
    loaderOptions: {
      postcss: {
        postcssOptions: {
          plugins: [
            require('tailwindcss'),
            require('autoprefixer')
          ]
        }
      }
    }
  }
});
