const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Only apply optimizations in production
      if (env === 'production') {
        // Enhanced code splitting
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Vendor libraries (React, React-DOM, etc.)
              vendor: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
                name: 'vendor',
                chunks: 'all',
                priority: 10,
              },
              // PDF and report libraries (loaded on demand)
              pdfLibs: {
                test: /[\\/]node_modules[\\/](react-pdf|jspdf|jspdf-autotable)[\\/]/,
                name: 'pdf-libs',
                chunks: 'async',
                priority: 8,
              },
              // ZIP processing libraries
              zipLibs: {
                test: /[\\/]node_modules[\\/](jszip|file-saver)[\\/]/,
                name: 'zip-libs',
                chunks: 'all',
                priority: 7,
              },
              // Other node_modules
              commons: {
                test: /[\\/]node_modules[\\/]/,
                name: 'commons',
                chunks: 'all',
                priority: 5,
                minChunks: 2,
              },
              // App code
              default: {
                minChunks: 2,
                priority: 1,
                reuseExistingChunk: true,
              },
            },
          },
        };

        // Preload critical chunks
        webpackConfig.optimization.runtimeChunk = {
          name: 'runtime',
        };
      }

      return webpackConfig;
    },
  },
};