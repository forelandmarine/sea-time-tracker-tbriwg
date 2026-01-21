
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

module.exports = ({ config }) => {
  return {
    ...config,
    name: IS_DEV ? 'SeaTime Tracker (Dev)' : IS_PREVIEW ? 'SeaTime Tracker (Preview)' : 'SeaTime Tracker',
    ios: {
      ...config.ios,
      bundleIdentifier: IS_DEV
        ? 'com.forelandmarine.seatimetracker.dev'
        : IS_PREVIEW
        ? 'com.forelandmarine.seatimetracker.preview'
        : 'com.forelandmarine.seatimetracker',
      appleTeamId: '43GZCFFPR9',
    },
    android: {
      ...config.android,
      package: IS_DEV
        ? 'com.forelandmarine.seatimetracker.dev'
        : IS_PREVIEW
        ? 'com.forelandmarine.seatimetracker.preview'
        : 'com.forelandmarine.seatimetracker',
    },
  };
};
