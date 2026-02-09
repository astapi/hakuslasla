import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "LootDive",
  slug: "hakuslaDungeon",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "lootdive",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    appleTeamId: "C554RLNNG7",
    bundleIdentifier: "com.astapi.LootDive",
    googleServicesFile:
      process.env.GOOGLE_SERVICES_INFO_PLIST ?? "./GoogleService-Info.plist",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#1a1a2e",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.astapi.LootDive",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#1a1a2e",
    },
  },
  plugins: [
    "expo-router",
    "expo-splash-screen",
    "expo-sqlite",
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: "ca-app-pub-3940256099942544~3347511713",
        iosAppId: "ca-app-pub-7716085580742961~4043678329",
      },
    ],
    "@react-native-firebase/app",
    "@react-native-firebase/crashlytics",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          forceStaticLinking: ["RNFBApp", "RNFBAnalytics", "RNFBCrashlytics"],
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "3ecacddc-77fc-438a-9465-216177d0ed6b",
    },
  },
});
