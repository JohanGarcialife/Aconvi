import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#008075";
const INACTIVE = "#64748b";
const ALERT_RED = "#EF4444";

function AfTabIcon({
  icon,
  focused,
  hasBadge,
}: {
  icon: string;
  focused: boolean;
  hasBadge?: boolean;
}) {
  return (
    <View style={{ alignItems: "center", position: "relative" }}>
      <Ionicons name={icon} size={22} color={focused ? PRIMARY : INACTIVE} />
      {hasBadge && (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -6,
            backgroundColor: ALERT_RED,
            borderRadius: 4,
            width: 7,
            height: 7,
          }}
        />
      )}
    </View>
  );
}

export default function AfLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          height: 58 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ focused }) => (
            <AfTabIcon
              icon={focused ? "home" : "home-outline"}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="juntas"
        options={{
          title: "Juntas",
          tabBarIcon: ({ focused }) => (
            <AfTabIcon
              icon={focused ? "people" : "people-outline"}
              focused={focused}
              hasBadge
            />
          ),
        }}
      />
      <Tabs.Screen
        name="votaciones"
        options={{
          title: "Votaciones",
          tabBarIcon: ({ focused }) => (
            <AfTabIcon
              icon={focused ? "document-text" : "document-text-outline"}
              focused={focused}
              hasBadge
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incidencias"
        options={{
          title: "Incidencias",
          tabBarIcon: ({ focused }) => (
            <AfTabIcon
              icon={focused ? "warning" : "warning-outline"}
              focused={focused}
              hasBadge
            />
          ),
        }}
      />
      <Tabs.Screen
        name="comunicados"
        options={{
          title: "Comunicados",
          tabBarIcon: ({ focused }) => (
            <AfTabIcon
              icon={focused ? "chatbox-ellipses" : "chatbox-ellipses-outline"}
              focused={focused}
              hasBadge
            />
          ),
        }}
      />
      {/* Hidden screens inside (af) tab group */}
      <Tabs.Screen
        name="asistencia"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="comunidades"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="orden-del-dia"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="escrutinio"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="mano-alzada"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
