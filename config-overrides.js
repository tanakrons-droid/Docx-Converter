const webpack = require('webpack');

module.exports = function override(config, env) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    util: require.resolve('util/')
  };
  
  // Ignore WASM module resolution warnings (optional dependency with fallback)
  config.ignoreWarnings = [
    ...(config.ignoreWarnings || []),
    // Suppress the "Can't resolve '../wasm-pkg/image_resize_wasm'" warning
    (warning) => {
      return (
        warning.message &&
        warning.message.includes('image_resize_wasm')
      );
    }
  ];
  
  return config;
};
