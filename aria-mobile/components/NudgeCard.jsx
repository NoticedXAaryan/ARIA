import { View, Text, Pressable, StyleSheet } from "react-native";

function urgencyBadge(urgency) {
  const pct = Math.round((urgency || 0) * 100);
  if (pct >= 70) return { color: "#ef4444", label: "Urgent" };
  if (pct >= 40) return { color: "#a855f7", label: "Queued" };
  return { color: "#666", label: "Low" };
}

export default function NudgeCard({ nudge, onAccept, onSnooze, onDismiss }) {
  const badge = urgencyBadge(nudge.urgency);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={2}>{nudge.text}</Text>
        <View style={[styles.badge, { backgroundColor: badge.color + "22" }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
      {nudge.reason ? (
        <Text style={styles.reason} numberOfLines={1}>{nudge.reason}</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable style={styles.acceptBtn} onPress={() => onAccept(nudge.id)}>
          <Text style={styles.acceptText}>Accept</Text>
        </Pressable>
        {onSnooze && (
          <Pressable style={styles.snoozeBtn} onPress={() => onSnooze(nudge.id)}>
            <Text style={styles.snoozeText}>Snooze</Text>
          </Pressable>
        )}
        <Pressable style={styles.dismissBtn} onPress={() => onDismiss(nudge.id)}>
          <Text style={styles.dismissText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  top: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", gap: 8, marginBottom: 6,
  },
  title: { fontSize: 14, fontWeight: "500", color: "#eee", flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  reason: { fontSize: 12, color: "#777", marginBottom: 10 },
  actions: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    flex: 1, backgroundColor: "#a855f7", borderRadius: 8,
    paddingVertical: 8, alignItems: "center",
  },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  snoozeBtn: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14, alignItems: "center",
  },
  snoozeText: { color: "#aaa", fontSize: 13 },
  dismissBtn: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, alignItems: "center",
  },
  dismissText: { color: "#666", fontSize: 14 },
});
