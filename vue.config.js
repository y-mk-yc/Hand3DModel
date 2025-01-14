const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  publicPath: './',
  outputDir: 'dist',
  assetsDir: 'static',
  transpileDependencies: true,
  devServer:{
    client:{
      overlay : false
    }
  }
})
