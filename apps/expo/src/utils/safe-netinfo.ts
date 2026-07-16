import { NativeModules } from "react-native";

// Mock RNCNetInfo on NativeModules if it doesn't exist
if (!NativeModules.RNCNetInfo) {
  NativeModules.RNCNetInfo = {
    getCurrentState: () =>
      Promise.resolve({
        type: "wifi",
        isConnected: true,
        isInternetReachable: true,
        details: { isConnectionExpensive: false },
      }),
    addListener: () => {},
    removeListeners: () => {},
  };
}

let NetInfo: any;

try {
  // If the native module is missing or throws during evaluation, catch it
  NetInfo = require("@react-native-community/netinfo").default;
} catch (e) {
  console.warn("Failed to evaluate @react-native-community/netinfo, using mock fallback:", e);
  NetInfo = {
    addEventListener: (callback: any) => {
      // Immediately notify listener of online state
      setTimeout(() => {
        callback({
          type: "wifi",
          isConnected: true,
          isInternetReachable: true,
          details: { isConnectionExpensive: false },
        });
      }, 0);
      return () => {};
    },
    fetch: () =>
      Promise.resolve({
        type: "wifi",
        isConnected: true,
        isInternetReachable: true,
        details: { isConnectionExpensive: false },
      }),
  };
}

export default NetInfo;
