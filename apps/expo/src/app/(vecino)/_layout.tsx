import { useState, useEffect } from "react";
import { Tabs } from "expo-router";
import { View, Text, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { api } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { useReadStatus } from "~/utils/notifications-tracker";

const PRIMARY = "#4aa19b";
const INACTIVE = "#94a3b8";
const ALERT_RED = "#EF4444";

function TabIcon({
  name,
  focused,
  hasBadge,
}: {
  name: string;
  focused: boolean;
  hasBadge?: boolean;
}) {
  const icons: Record<string, string> = {
    Inicio: "⌂",
    Incidencias: "⚠",
    Comunicados: "✉",
    Zonas: "🏢",
    Documentos: "☰",
    Votaciones: "🗳️",
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
      {hasBadge && (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -8,
            backgroundColor: ALERT_RED,
            borderRadius: 5,
            width: 8,
            height: 8,
          }}
        />
      )}
    </View>
  );
}

export default function VecinoLayout() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync("expo_user_id").then((id) => {
      if (id) setUserId(id);
    }).catch(console.warn);
  }, []);

  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const { readNoticeIds, seenDocIds, lastSeenFeesTs } = useReadStatus();

  const { data: notices } = useQuery({
    ...api.notice.all.queryOptions({ tenantId: "org_aconvi_demo" }),
    refetchInterval: 8000,
  });
  const { data: documents } = useQuery({
    ...api.document.all.queryOptions({ tenantId: "org_aconvi_demo" }),
    refetchInterval: 15000,
  });
  const { data: fees } = useQuery({
    ...api.fee.myFees.queryOptions({
      tenantId: "org_aconvi_demo",
      userId: userId ?? "user_admin",
    }),
    refetchInterval: 15000,
  });

  const noticesList = (notices as any[] | undefined) ?? [];
  const hasUnreadNotices = noticesList.some(
    (n: any) => !readNoticeIds.includes(n.id),
  );

  const docsList = (documents as any[] | undefined) ?? [];
  const hasUnreadDocs = docsList.some(
    (d: any) => !seenDocIds.includes(d.id),
  );

  const feesList = (fees as any[] | undefined) ?? [];
  const hasPendingFees = feesList.some(
    (f: any) =>
      (f.status === "PENDING" || f.status === "OVERDUE") &&
      (!lastSeenFeesTs || new Date(f.createdAt).getTime() > lastSeenFeesTs),
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e2e8f0",
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
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
            <TabIcon name="Incidencias" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="communication"
        options={{
          title: "Comunicados",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Comunicados" focused={focused} hasBadge={hasUnreadNotices} />
          ),
        }}
      />
      <Tabs.Screen
        name="common-areas"
        options={{
          href: null,
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
            <TabIcon name="Documentos" focused={focused} hasBadge={hasUnreadDocs} />
          ),
        }}
      />
      <Tabs.Screen
        name="voting"
        options={{
          href: null,
          title: "Votaciones",
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Votaciones" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{
          title: "Mis cuotas",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Mis cuotas" focused={focused} hasBadge={hasPendingFees} />
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
      <Tabs.Screen
        name="votes-history"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
