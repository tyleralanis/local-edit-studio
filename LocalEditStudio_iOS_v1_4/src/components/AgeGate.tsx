import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { StudioButton } from "./StudioButton";
import { CONSENT_DISCLAIMER, CONSENT_VERSION } from "@/lib/policy";
import { colors, radii } from "@/lib/theme";
import type { ConsentRecord } from "@/lib/types";

function CheckRow({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

export function AgeGate({ onVerified }: { onVerified: (record: ConsentRecord) => Promise<void> }) {
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const continueIntoApp = async () => {
    if (!adult || !consent || saving) return;
    setSaving(true);
    try {
      await onVerified({
        acceptedAt: new Date().toISOString(),
        version: CONSENT_VERSION,
        isAdult: true,
        hasConsentAndRights: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.mark}>
        <Ionicons name="sparkles" size={34} color={colors.white} />
      </View>
      <Text style={styles.eyebrow}>PRIVATE PHOTO EDITING</Text>
      <Text style={styles.title}>Before you enter</Text>
      <Text style={styles.subtitle}>Edit Studio is an adults-only workspace built around consent and control.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Age & consent check</Text>
        <CheckRow checked={adult} onPress={() => setAdult((value) => !value)}>
          I confirm that I am at least 18 years old.
        </CheckRow>
        <CheckRow checked={consent} onPress={() => setConsent((value) => !value)}>
          I confirm every depicted person is an adult who consented, and I own the image or have permission to edit it.
        </CheckRow>
      </View>

      <View style={styles.disclaimer}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.accentBright} />
        <Text style={styles.disclaimerText}>{CONSENT_DISCLAIMER}</Text>
      </View>

      <StudioButton
        label="Verify 18+ & continue"
        onPress={continueIntoApp}
        disabled={!adult || !consent}
        loading={saving}
      />
      <Text style={styles.footnote}>This is a self-attestation for private testing, not government-ID verification.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 40 },
  mark: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, marginBottom: 24 },
  eyebrow: { color: colors.accentBright, fontSize: 12, fontWeight: "800", letterSpacing: 1.7 },
  title: { color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 10, marginBottom: 26 },
  card: { backgroundColor: colors.panel, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 16 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkText: { color: colors.text, fontSize: 15, lineHeight: 22, flex: 1 },
  disclaimer: { flexDirection: "row", gap: 12, paddingVertical: 20 },
  disclaimerText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  footnote: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 12 },
});
