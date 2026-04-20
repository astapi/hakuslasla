import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "LootDive",
  slug: "hakuslaDungeon",
  version: "1.3.5",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "lootdive",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    appleTeamId: "C554RLNNG7",
    bundleIdentifier: "com.astapi.LootDive",
    buildNumber: process.env.IOS_BUILD_NUMBER ?? "1",
    associatedDomains: ["applinks:astapi.net"],
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
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "astapi.net",
            pathPrefix: "/lootdive/invite",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
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
        skAdNetworkItems: [
          "cstr6suwn9.skadnetwork", // Google
          "4fzdc2evr5.skadnetwork",
          "2fnua5tdw4.skadnetwork",
          "ydx93a7ass.skadnetwork",
          "p78axxw29g.skadnetwork",
          "v72qych5uu.skadnetwork",
          "ludvb6z3bs.skadnetwork",
          "cp8zw746q7.skadnetwork",
          "3sh42y64q3.skadnetwork",
          "c6k4g5qg8m.skadnetwork",
          "s39g8k73mm.skadnetwork",
          "wg4vff78zm.skadnetwork",
          "3qy4746246.skadnetwork",
          "f38h382jlk.skadnetwork",
          "hs6bdukanm.skadnetwork",
          "mlmmfzh3r3.skadnetwork",
          "v4nxqhlyqp.skadnetwork",
          "wzmmz9fp6w.skadnetwork",
          "su67r6k2v3.skadnetwork",
          "yclnxrl5pm.skadnetwork",
          "t38b2kh725.skadnetwork",
          "7ug5zh24hu.skadnetwork",
          "gta9lk7p23.skadnetwork",
          "vutu7akeur.skadnetwork",
          "y5ghdn5j9k.skadnetwork",
          "v9wttpbfk9.skadnetwork", // Meta
          "n38lu8286q.skadnetwork", // Pangle
          "47vhws6wlr.skadnetwork",
          "kbd757ywx3.skadnetwork",
          "9t245vhmpl.skadnetwork",
          "a2p9lx4jpn.skadnetwork",
          "22mmun2rn5.skadnetwork",
          "44jx6755aq.skadnetwork",
          "k674qkevps.skadnetwork",
          "4468km3ulz.skadnetwork",
          "2u9pt9hc89.skadnetwork",
          "8s468mfl3y.skadnetwork",
          "klf5c3l5u5.skadnetwork",
          "ppxm28t8ap.skadnetwork",
          "kbmxgpxpgc.skadnetwork",
          "uw77j35x4d.skadnetwork",
          "578prtvx9j.skadnetwork",
          "4dzt52r2t5.skadnetwork",
          "tl55sbb4fm.skadnetwork",
          "c3frkrj4fj.skadnetwork",
          "e5fvkxwrpn.skadnetwork",
          "8c4e2ghe7u.skadnetwork",
          "3rd42ekr43.skadnetwork",
          "97r2b46745.skadnetwork",
          "3qcr597p9d.skadnetwork",
        ],
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
          extraPods: [
            { name: "GoogleMobileAdsMediationFacebook" },
            { name: "GoogleMobileAdsMediationPangle" },
          ],
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
