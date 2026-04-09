import { Tabs } from "expo-router";
import { View, Text } from "react-native";

const PRIMARY = "#4aa19b";
const INACTIVE = "#94a3b8";

function TabIcon({
  name,
  focused,
  badge,
}: {
  name: string;
  focused: boolean;
  badge?: number;
}) {
  const icons: Record<string, string> = {
    Inicio: "⌂",
    Incidencias: "⚠",
    Comunicados: "✉",
    Zonas: "🏢",
    Documentos: "☰",
    "Mis cuotas": "€",
  };
  return (
    <View style={{ alignItems: "center", position: "relative" }}>
      <Text
        style={{
          fontSize: 20,
          color: focused ? PRIMARY : INACTIVE,
          lineHeight: 24,
        }}
      >
        {icons[name] ?? "•"}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -10,
            backgroundColor: PRIMARY,
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function VecinoLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: { backgroundColor: "#fff" },
        headerShadowVisible: false,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Inicio" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents/index"
        options={{
          title: "Incidencias",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Incidencias" focused={focused} badge={1} />
          ),
        }}
      />
      <Tabs.Screen
        name="communication"
        options={{
          title: "Comunicados",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Comunicados" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="common-areas"
        options={{
          title: "Zonas",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Zonas" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Documentos",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Documentos" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{
          title: "Mis cuotas",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Mis cuotas" focused={focused} />
          ),
        }}
      />
      {/* Screens inside the vecino group but hidden from tab bar */}
      <Tabs.Screen
        name="incidents/[id]"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="incidents/new"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="rating"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
