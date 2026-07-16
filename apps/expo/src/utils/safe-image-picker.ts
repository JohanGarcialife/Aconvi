let ImagePicker: any;

try {
  ImagePicker = require("expo-image-picker");
} catch (e) {
  console.warn("Failed to evaluate expo-image-picker, using mock fallback:", e);
  ImagePicker = {
    requestCameraPermissionsAsync: () =>
      Promise.resolve({ granted: true, status: "granted", canAskAgain: true }),
    requestMediaLibraryPermissionsAsync: () =>
      Promise.resolve({ granted: true, status: "granted", canAskAgain: true }),
    launchCameraAsync: () => Promise.resolve({ canceled: true, assets: [] }),
    launchImageLibraryAsync: () => Promise.resolve({ canceled: true, assets: [] }),
  };
}

export const requestCameraPermissionsAsync = ImagePicker.requestCameraPermissionsAsync;
export const requestMediaLibraryPermissionsAsync = ImagePicker.requestMediaLibraryPermissionsAsync;
export const launchCameraAsync = ImagePicker.launchCameraAsync;
export const launchImageLibraryAsync = ImagePicker.launchImageLibraryAsync;

export default ImagePicker;
