import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Aconvi",
  slug: "aconvi",
  owner: "johangarcialife",
  scheme: "aconvi", // deep links: aconvi://job/[id], aconvi://rating/[id]
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  updates: { fallbackToCacheTimeout: 0 },
  newArchEnabled: true,
  assetBundlePatterns: ["**/*"],
  notification: {
    icon: "./assets/notification-icon.png",
    color: "#009689",
  },
  ios: {
    bundleIdentifier: "com.aconvi.app",
    supportsTablet: true,
    icon: {
      light: "./assets/icon.png",
      dark: "./assets/icon.png",
    },
  },
  android: {
    package: "com.aconvi.app",
    googleServicesFile: "./google-services.json",
    permissions: ["android.permission.POST_NOTIFICATIONS"],
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#FFFFFF",
    },
    edgeToEdgeEnabled: true,
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
    reactCanary: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "1713543a-27cf-4db0-9da2-64ddf821d5d7",
    },
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-sqlite",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#009689",
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/icon.png",
        dark: { backgroundColor: "#FFFFFF", image: "./assets/icon.png" },
        resizeMode: "contain",
      },
    ],
  ],
});
