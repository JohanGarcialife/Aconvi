import Constants from "expo-constants";

/**
 * Returns the base URL for the API.
 * - In Expo development: uses the host machine's IP auto-detected by Expo
 * - In production builds (APK/IPA): uses the production API URL
 */
export const getBaseUrl = () => {
  // Production: always use the deployed API
  // This is set when building with EAS (EXPO_PUBLIC_API_URL env var)
  const productionUrl = process.env.EXPO_PUBLIC_API_URL;
  if (productionUrl) return productionUrl;

  // Development: auto-detect the host machine's IP from Expo's debugger host
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (localhost) {
    return `http://${localhost}:3000`;
  }

  // Final fallback: production URL
  return "https://aconvi.com";
};
