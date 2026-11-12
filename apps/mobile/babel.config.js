// T49: production bundles strip console.* (logs could expose tokens, emails or device data).
module.exports = function (api) {
  const isProduction = api.env('production') || process.env.APP_VARIANT === 'production';
  api.cache.using(() => `${process.env.NODE_ENV}:${process.env.APP_VARIANT}`);
  return {
    presets: ['babel-preset-expo'],
    plugins: isProduction ? [['transform-remove-console', { exclude: [] }]] : [],
  };
};
