import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import NudgeCard from "../components/NudgeCard";
import { createDesktopAPI } from "../hooks/useDesktopAPI";

export default function HomeScreen() {
  const [nudges, setNudges] = useState([]);
  const api = useMemo(() => createDesktopAPI("http://127.0.0.1:8742", ""), []);

  useEffect(() => {
    api.getActiveNudges().then(setNudges).catch(() => setNudges([]));
  }, [api]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 12 }}>ARIA Nudges</Text>
      <View>
        {nudges.map((n) => (
          <NudgeCard
            key={n.id}
            nudge={n}
            onAccept={(id) => api.sendFeedback(id, "accepted")}
            onDismiss={(id) => api.sendFeedback(id, "dismissed")}
          />
        ))}
      </View>
    </ScrollView>
  );
}
