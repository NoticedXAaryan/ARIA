import { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";

export default function QuickTaskInput({ onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <TextInput
        placeholder="New quick task"
        value={value}
        onChangeText={setValue}
        style={{ borderWidth: 1, borderColor: "#d1d5db", padding: 10, borderRadius: 8 }}
      />
      <Pressable
        onPress={() => {
          if (!value.trim()) return;
          onSubmit(value.trim());
          setValue("");
        }}
      >
        <Text>Add Task</Text>
      </Pressable>
    </View>
  );
}
