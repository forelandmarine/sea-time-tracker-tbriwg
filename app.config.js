
const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

module.exports = ({ config }) => {
  return {
    ...config,
    name: IS_DEV ? 'SeaTime Tracker (Dev)' : IS_PREVIEW ? 'SeaTime Tracker (Preview)' : 'SeaTime Tracker',
    slug: 'seatime-tracker',
    owner: 'forelandmarine',
    version: '1.2.1',
    orientation: 'portrait',
    icon: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
    scheme: 'seatime-tracker',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    ios: {
      ...config.ios,
      supportsTablet: true,
      bundleIdentifier: IS_DEV
        ? 'com.forelandmarine.ais-seatime-tracker.dev'
        : IS_PREVIEW
        ? 'com.forelandmarine.ais-seatime-tracker.preview'
        : 'com.forelandmarine.ais-seatime-tracker',
      appleTeamId: '43GZCFFPR9',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      ...config.android,
      adaptiveIcon: {
        foregroundImage: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
        backgroundColor: '#ffffff'
      },
      package: IS_DEV
        ? 'com.forelandmarine.ais.seatime.tracker.dev'
        : IS_PREVIEW
        ? 'com.forelandmarine.ais.seatime.tracker.preview'
        : 'com.forelandmarine.ais.seatime.tracker'
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png'
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
          color: '#ffffff'
        }
      ],
      'expo-apple-authentication'
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      backendUrl: 'https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev',
      eas: {
        projectId: 'd982d462-52e2-493e-a176-8f75b09d5ef9'
      }
    },
    runtimeVersion: '1.2.1',
    updates: {
      enabled: false,
      checkAutomatically: 'ON_ERROR_RECOVERY',
      fallbackToCacheTimeout: 0
    },
    developmentClient: {
      silentLaunch: true
    }
  };
};
