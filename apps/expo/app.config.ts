import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Aconvi",
  slug: "aconvi",
  scheme: "aconvi", // deep links: aconvi://job/[id], aconvi://rating/[id]
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon-light.png",
  userInterfaceStyle: "light",
  updates: { fallbackToCacheTimeout: 0 },
  newArchEnabled: true,
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "com.aconvi.app",
    supportsTablet: true,
    icon: {
      light: "./assets/icon-light.png",
      dark: "./assets/icon-light.png",
    },
  },
  android: {
    package: "com.aconvi.app",
    adaptiveIcon: {
      foregroundImage: "./assets/icon-light.png",
      backgroundColor: "#4aa19b",
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
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/icon-light.png",
        dark: { backgroundColor: "#FFFFFF", image: "./assets/icon-light.png" },
        resizeMode: "contain",
      },
    ],
  ],
});
