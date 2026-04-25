import { View, Text, Pressable } from "react-native";

export default function NudgeCard({ nudge, onAccept, onDismiss }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#d1d5db", padding: 12, borderRadius: 8, marginBottom: 10 }}>
      <Text style={{ fontWeight: "600" }}>{nudge.text}</Text>
      <Text>Urgency: {Math.round((nudge.urgency || 0) * 100)}%</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Pressable onPress={() => onAccept(nudge.id)}><Text>Accept</Text></Pressable>
        <Pressable onPress={() => onDismiss(nudge.id)}><Text>Dismiss</Text></Pressable>
      </View>
    </View>
  );
}
