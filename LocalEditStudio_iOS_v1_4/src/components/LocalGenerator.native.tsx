import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { initExecutorch, models, useTextToImage } from "react-native-executorch";
import { ExpoResourceFetcher } from "react-native-executorch-expo-resource-fetcher";

import { evaluateLocalGenerationPrompt } from "@/lib/policy";
import { colors, radii } from "@/lib/theme";
import { StudioButton } from "./StudioButton";

const MODEL_ENABLED_KEY = "edit-studio:local-generator-enabled";
const LOCAL_MODEL = models.image_generation.bk_sdm_tiny_vpred_256();

initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export function LocalGenerator({ onGenerated }: { onGenerated: (uri: string) => Promise<void> }) {
  const [enabled, setEnabled] = useState(false);
  const [checkedPreference, setCheckedPreference] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const generator = useTextToImage({
    model: LOCAL_MODEL,
    preventLoad: !enabled,
    inferenceCallback: (currentStep) => setStep(currentStep + 1),
  });

  useEffect(() => {
    AsyncStorage.getItem(MODEL_ENABLED_KEY)
      .then((value) => setEnabled(value === "true"))
      .finally(() => setCheckedPreference(true));
  }, []);

  const install = async () => {
    setMessage("Downloading the private local generator. Keep Edit Studio open and use Wi-Fi.");
    await AsyncStorage.setItem(MODEL_ENABLED_KEY, "true");
    setEnabled(true);
  };

  const generate = async () => {
    const requestedPrompt = prompt.trim();
    const decision = evaluateLocalGenerationPrompt(requestedPrompt);
    if (!decision.allowed) {
      setMessage(decision.message || "That request is not available for local generation.");
      return;
    }
    setStep(0);
    setMessage("Generating privately on this iPhone. Nothing is being uploaded.");
    try {
      const uri = await generator.generate(requestedPrompt, 256, 6, Math.floor(Math.random() * 2_000_000_000) + 1);
      if (!uri) {
        setMessage("Generation was cancelled.");
        return;
      }
      await onGenerated(uri);
      setMessage("Local generation complete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local generator could not finish this image.");
    }
  };

  const progress = Math.max(0, Math.min(1, generator.downloadProgress));
  const loadingModel = enabled && !generator.isReady && !generator.error;

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><Ionicons name="hardware-chip-outline" size={25} color={colors.accentBright} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Private local generator</Text>
          <Text style={styles.subtitle}>Runs on this iPhone with no account, API key, per-image fee, or photo upload.</Text>
        </View>
      </View>

      {!checkedPreference ? <Text style={styles.message}>Checking the local model…</Text> : null}

      {checkedPreference && !enabled ? (
        <>
          <Text style={styles.details}>One-time download: about 1.9 GB. Wi-Fi and several gigabytes of free storage are recommended.</Text>
          <StudioButton label="Install local generator" onPress={() => void install()} icon={<Ionicons name="download-outline" size={19} color={colors.white} />} />
        </>
      ) : null}

      {loadingModel ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(2, Math.round(progress * 100))}%` }]} /></View>
          <Text style={styles.message}>{progress > 0 ? `Downloading model · ${Math.round(progress * 100)}%` : "Preparing model download…"}</Text>
        </View>
      ) : null}

      {generator.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{generator.error.message}</Text>
          <StudioButton label="Retry model download" onPress={() => { setEnabled(false); setTimeout(() => setEnabled(true), 50); }} variant="secondary" />
        </View>
      ) : null}

      {generator.isReady ? (
        <>
          <View style={styles.readyRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.readyText}>Local model ready</Text>
          </View>
          <TextInput
            accessibilityLabel="Local generation description"
            value={prompt}
            onChangeText={setPrompt}
            editable={!generator.isGenerating}
            multiline
            maxLength={600}
            placeholder="Describe a new fictional adult image to create locally"
            placeholderTextColor="#666574"
            style={styles.input}
            textAlignVertical="top"
          />
          {generator.isGenerating ? (
            <View style={styles.generating}>
              <Text style={styles.message}>Generating · step {Math.min(step, 6)} of 6</Text>
              <Pressable accessibilityRole="button" onPress={generator.interrupt} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <StudioButton
              label="Generate privately on iPhone"
              onPress={() => void generate()}
              disabled={!prompt.trim()}
              icon={<Ionicons name="sparkles" size={19} color={colors.white} />}
            />
          )}
        </>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.safeguard}>Safeguards run inside Edit Studio before inference. Local generation is limited to fictional, non-identifiable adults and blocks minors, coercion, nudification, and explicit sexual acts. Model: BK-SDM-Tiny, CreativeML Open RAIL-M.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", gap: 13, padding: 16, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  heading: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(129,89,255,0.14)" },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  details: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  progressBlock: { gap: 8 },
  progressTrack: { height: 9, borderRadius: 5, overflow: "hidden", backgroundColor: colors.background },
  progressFill: { height: 9, borderRadius: 5, backgroundColor: colors.accent },
  readyRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  readyText: { color: colors.success, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 104, borderRadius: radii.medium, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 15, lineHeight: 21 },
  generating: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cancel: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radii.small, backgroundColor: "rgba(255,77,97,0.12)" },
  cancelText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  message: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  safeguard: { color: colors.muted, fontSize: 10, lineHeight: 15, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  errorBox: { gap: 9, padding: 12, borderRadius: radii.small, backgroundColor: "rgba(255,77,97,0.08)" },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17 },
});
