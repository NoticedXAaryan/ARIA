import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, Platform,
  KeyboardAvoidingView, ActivityIndicator
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { createDesktopAPI } from "../hooks/useDesktopAPI";

export default function PairScreen() {
  const [code, setCode] = useState("");
  const [manualIp, setManualIp] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const tryPair = async (ip) => {
    setLoading(true);
    try {
      const api = createDesktopAPI(`http://${ip}:8742`, "");
      const result = await api.verifyPairCode(code);
      if (result.success) {
        await SecureStore.setItemAsync("aria_desktop_ip", result.desktop_ip);
        await SecureStore.setItemAsync("aria_desktop_port", String(result.port));
        await SecureStore.setItemAsync("aria_paired", "true");

        // Register this device
        const deviceId = `${Platform.OS}-${Date.now()}`;
        await SecureStore.setItemAsync("aria_device_id", deviceId);
        // Push token would come from expo-notifications, for now store placeholder
        await api.registerDevice(deviceId, "", Platform.OS);

        Alert.alert("Paired!", `Connected to ARIA at ${result.desktop_ip}`, [
          { text: "OK", onPress: () => router.replace("/") }
        ]);
      } else {
        Alert.alert("Failed", result.error || "Invalid or expired code");
      }
    } catch (e) {
      Alert.alert("Connection Error", `Could not reach ARIA at ${ip}:8742.\n\n${e.message}`);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (code.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit code from your desktop.");
      return;
    }

    if (showManual && manualIp) {
      await tryPair(manualIp);
      return;
    }

    // Try common LAN addresses
    const prefixes = ["192.168.1", "192.168.0", "10.0.0"];
    let found = false;

    for (const prefix of prefixes) {
      if (found) break;
      // Try a quick health check on the backend's IP
      try {
        const testUrl = `http://${prefix}.1:8742/api/health`;
        const r = await fetch(testUrl, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          await tryPair(`${prefix}.1`);
          found = true;
          break;
        }
      } catch { /* continue */ }
    }

    if (!found) {
      setShowManual(true);
      Alert.alert("Auto-discovery failed", "Please enter your desktop's IP address manually.");
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>✦</Text>
        <Text style={styles.title}>Connect to ARIA</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code shown on your desktop
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          placeholderTextColor="#555"
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          autoFocus
        />

        {showManual && (
          <TextInput
            style={styles.ipInput}
            value={manualIp}
            onChangeText={setManualIp}
            placeholder="Desktop IP (e.g. 192.168.1.5)"
            placeholderTextColor="#555"
            keyboardType="decimal-pad"
          />
        )}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Pair</Text>
          )}
        </Pressable>

        {!showManual && (
          <Pressable onPress={() => setShowManual(true)}>
            <Text style={styles.link}>Enter IP manually</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#0a0a0f",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 340,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20, padding: 32, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  logo: {
    fontSize: 36, color: "#a855f7", marginBottom: 16,
  },
  title: {
    fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: "#888", textAlign: "center", marginBottom: 24, lineHeight: 20,
  },
  codeInput: {
    width: "100%", height: 56, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, color: "#fff", fontSize: 28, fontWeight: "700",
    letterSpacing: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 16,
  },
  ipInput: {
    width: "100%", height: 48, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, color: "#fff", fontSize: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", marginBottom: 16,
  },
  button: {
    width: "100%", height: 48, backgroundColor: "#a855f7",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#a855f7", fontSize: 13 },
});
