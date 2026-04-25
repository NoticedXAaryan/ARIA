import { useState } from "react";
import { View, Text, TextInput } from "react-native";

export default function SettingsScreen() {
  const [desktopIp, setDesktopIp] = useState("127.0.0.1:8742");

  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Settings</Text>
      <Text>Desktop API Host</Text>
      <TextInput
        value={desktopIp}
        onChangeText={setDesktopIp}
        style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10 }}
      />
    </View>
  );
}
