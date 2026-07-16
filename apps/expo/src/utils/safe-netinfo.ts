import { NativeModules } from "react-native";

// Mock RNCNetInfo on NativeModules if it doesn't exist to prevent crash in Expo Go / older builds
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

import NetInfo from "@react-native-community/netinfo";
export default NetInfo;
export * from "@react-native-community/netinfo";
