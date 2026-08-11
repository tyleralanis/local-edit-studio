import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii } from "@/lib/theme";

export function LocalGenerator(_: { onGenerated: (uri: string) => Promise<void> }) {
  return (
    <View style={styles.card}>
      <Ionicons name="phone-portrait-outline" size={25} color={colors.accentBright} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Private generation runs on iPhone</Text>
        <Text style={styles.subtitle}>The Python-free browser editor supports local adjustments, masking, cleanup, and recoloring. Install the iPhone build for the downloadable on-device generator.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", flexDirection: "row", gap: 11, padding: 16, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
});
