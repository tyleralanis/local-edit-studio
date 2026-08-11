import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii } from "@/lib/theme";

export function StudioButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  loading = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && !(disabled || loading) && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.white : colors.accentBright} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, variant === "primary" && styles.primaryLabel, variant === "danger" && styles.dangerLabel]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  compact: { minHeight: 40, paddingHorizontal: 13, borderRadius: radii.small },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.panelRaised, borderColor: colors.border },
  danger: { backgroundColor: "rgba(255,102,122,0.10)", borderColor: "rgba(255,102,122,0.32)" },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  label: { color: colors.text, fontSize: 15, fontWeight: "700" },
  primaryLabel: { color: colors.white },
  dangerLabel: { color: colors.danger },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
