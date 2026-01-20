
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  expo: {
    name: IS_DEV ? 'SeaTime Tracker (Dev)' : 'SeaTime Tracker',
    slug: 'seatimetracker',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
    scheme: 'seatimetracker',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV
        ? 'com.forelandmarine.seatimetracker.dev'
        : 'com.forelandmarine.seatimetracker',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
        backgroundColor: '#ffffff',
      },
      package: IS_DEV
        ? 'com.forelandmarine.seatimetracker.dev'
        : 'com.forelandmarine.seatimetracker',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/images/f0500a31-f8b9-4d46-8b57-62c3847deff7.png',
          color: '#ffffff',
        },
      ],
      'expo-apple-authentication',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: 'd982d462-52e2-493e-a176-8f75b09d5ef9',
      },
      backendUrl: 'https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      enabled: false,
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    },
    developmentClient: {
      silentLaunch: true,
    },
  },
};
