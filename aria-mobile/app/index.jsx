import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ScrollView, Text, View, Pressable, StyleSheet, RefreshControl,
  ActivityIndicator
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { createDesktopAPI } from "../hooks/useDesktopAPI";
import NudgeCard from "../components/NudgeCard";

export default function HomeScreen() {
  const [paired, setPaired] = useState(null); // null = checking, true/false
  const [baseUrl, setBaseUrl] = useState("");
  const [nudges, setNudges] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // Check pairing on mount
  useEffect(() => {
    (async () => {
      const isPaired = await SecureStore.getItemAsync("aria_paired");
      if (isPaired === "true") {
        const ip = await SecureStore.getItemAsync("aria_desktop_ip");
        const port = await SecureStore.getItemAsync("aria_desktop_port");
        setBaseUrl(`http://${ip}:${port || "8742"}`);
        setPaired(true);
      } else {
        setPaired(false);
      }
    })();
  }, []);

  // Redirect to pair if not paired
  useEffect(() => {
    if (paired === false) {
      router.replace("/pair");
    }
  }, [paired]);

  const api = useMemo(() => {
    if (!baseUrl) return null;
    return createDesktopAPI(baseUrl, "");
  }, [baseUrl]);

  const fetchData = useCallback(async () => {
    if (!api) return;
    try {
      const [n, s, st] = await Promise.all([
        api.getActiveNudges().catch(() => []),
        api.getLookahead(6).catch(() => ({ events: [] })),
        api.getStatus().catch(() => null),
      ]);
      setNudges(n || []);
      setSchedule(s?.events || []);
      setStatus(st);
    } catch (e) {
      console.warn("Fetch failed:", e);
    }
  }, [api]);

  // Initial fetch + polling
  useEffect(() => {
    if (!api) return;
    fetchData();
    const interval = setInterval(fetchData, 2 * 60 * 1000); // every 2 min
    return () => clearInterval(interval);
  }, [api, fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleFeedback = async (id, outcome) => {
    if (!api) return;
    await api.sendFeedback(id, outcome);
    setNudges((prev) => prev.filter((n) => n.id !== id));
  };

  const handleUnpair = async () => {
    await SecureStore.deleteItemAsync("aria_paired");
    await SecureStore.deleteItemAsync("aria_desktop_ip");
    await SecureStore.deleteItemAsync("aria_desktop_port");
    router.replace("/pair");
  };

  if (paired === null) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const cogState = status?.cognitive_state || "normal";
  let focusBarColor = null;
  let focusBarText = null;
  if (cogState === "deep_focus") { focusBarColor = "#22c55e"; focusBarText = "Focus block active"; }
  else if (cogState === "overloaded") { focusBarColor = "#f59e0b"; focusBarText = "Heavy day ahead"; }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>✦ ARIA</Text>
        <Pressable onPress={handleUnpair}>
          <Text style={styles.unpair}>Unpair</Text>
        </Pressable>
      </View>

      {/* Focus bar */}
      {focusBarText && (
        <View style={[styles.focusBar, { backgroundColor: focusBarColor + "20" }]}>
          <View style={[styles.dot, { backgroundColor: focusBarColor }]} />
          <Text style={[styles.focusText, { color: focusBarColor }]}>{focusBarText}</Text>
        </View>
      )}

      {/* Nudges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PENDING</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{nudges.length}</Text>
          </View>
        </View>
        {nudges.length === 0 ? (
          <Text style={styles.empty}>All caught up ✓</Text>
        ) : (
          nudges.map((n) => (
            <NudgeCard
              key={n.id}
              nudge={n}
              onAccept={(id) => handleFeedback(id, "accepted")}
              onSnooze={(id) => handleFeedback(id, "snoozed")}
              onDismiss={(id) => handleFeedback(id, "dismissed")}
            />
          ))
        )}
      </View>

      {/* Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>UPCOMING</Text>
        {schedule.length === 0 ? (
          <Text style={styles.empty}>No events in the next 6 hours</Text>
        ) : (
          schedule.map((e, i) => (
            <View key={e.id || i} style={styles.eventCard}>
              <Text style={styles.eventTime}>{formatTime(e.start_ts)}</Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{e.title || "Untitled"}</Text>
                <Text style={styles.eventType}>{e.type || "event"}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20, paddingTop: 8,
  },
  logo: { fontSize: 22, fontWeight: "700", color: "#a855f7" },
  unpair: { fontSize: 13, color: "#666" },
  focusBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginBottom: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  focusText: { fontSize: 13, fontWeight: "600" },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: {
    fontSize: 12, fontWeight: "700", letterSpacing: 1, color: "#666",
    textTransform: "uppercase",
  },
  badge: {
    backgroundColor: "#a855f7", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  empty: { fontSize: 13, color: "#555", textAlign: "center", paddingVertical: 20 },
  eventCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  eventTime: { fontSize: 13, fontWeight: "600", color: "#a855f7", width: 50 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontWeight: "500", color: "#eee", marginBottom: 2 },
  eventType: { fontSize: 11, color: "#666", textTransform: "capitalize" },
});
