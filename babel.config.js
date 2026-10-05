module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated v4 usa react-native-worklets internamente.
      // El plugin de worklets DEBE listarse de último siempre.
      'react-native-worklets/plugin',
    ],
  };
};
