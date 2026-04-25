import { View, Text } from "react-native";
import QuickTaskInput from "../components/QuickTaskInput";
import { createDesktopAPI } from "../hooks/useDesktopAPI";

const api = createDesktopAPI("http://127.0.0.1:8742", "");

export default function TasksScreen() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Quick Task</Text>
      <QuickTaskInput onSubmit={(title) => api.addTask(title)} />
    </View>
  );
}
