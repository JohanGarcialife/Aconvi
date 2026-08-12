import Constants from "expo-constants";

/**
 * Returns the base URL for the API.
 * Always targets the VPS backend (https://aconvi.com) for both dev and production environments.
 */
export const getBaseUrl = () => {
  const customUrl = process.env.EXPO_PUBLIC_API_URL;
  if (customUrl) return customUrl;

  // Always use VPS server
  return "https://aconvi.com";
};
