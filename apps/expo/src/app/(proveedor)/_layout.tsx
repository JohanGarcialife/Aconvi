import { Stack } from "expo-router";

export default function ProveedorLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#4aa19b",
        headerTitleStyle: { fontWeight: "700", color: "#0f172a" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#fff" },
      }}
    />
  );
}
