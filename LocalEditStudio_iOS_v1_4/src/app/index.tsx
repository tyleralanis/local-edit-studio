import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgeGate } from "@/components/AgeGate";
import { LocalGenerator } from "@/components/LocalGenerator";
import { MaskCanvas } from "@/components/MaskCanvas";
import { StudioButton } from "@/components/StudioButton";
import { requestEdit } from "@/lib/api";
import { createID } from "@/lib/ids";
import { prepareImage, removeStudioFiles, saveGeneratedBase64 } from "@/lib/images";
import { applyLocalEdit } from "@/lib/localEdits";
import { detectLocalOperation, LOCAL_EDIT_HELP, RECOLOR_PRESETS } from "@/lib/localIntent";
import { hasPaintedSelection } from "@/lib/mask";
import { CONSENT_DISCLAIMER, CONSENT_VERSION, evaluatePrompt } from "@/lib/policy";
import {
  clearConsent,
  clearSession,
  getClientID,
  loadConsent,
  loadSession,
  saveConsent,
  saveSession,
} from "@/lib/storage";
import { colors, radii } from "@/lib/theme";
import type {
  ConsentRecord,
  EditMode,
  EditScope,
  EditorSnapshot,
  HistoryItem,
  MaskStroke,
  Quality,
  StudioImage,
} from "@/lib/types";

const SUGGESTIONS = [
  "Retouch skin tone and preserve natural texture",
  "Improve the lighting while keeping the face unchanged",
  "Remove the painted object and reconstruct the background naturally",
  "Create a tasteful cinematic boudoir color grade",
];

const CLOUD_GENERATION_ENABLED = process.env.EXPO_PUBLIC_ENABLE_CLOUD_GENERATION === "true";

type NoticeState = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
};

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function Segment<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[styles.segmentItem, value === option.value && styles.segmentItemSelected]}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RecoveryModal({ snapshot, onResume, onDiscard }: { snapshot: EditorSnapshot; onResume: () => void; onDiscard: () => void }) {
  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcon}><Ionicons name="time-outline" size={28} color={colors.accentBright} /></View>
          <Text style={styles.modalTitle}>Resume your last edit?</Text>
          <Text style={styles.modalBody}>Saved {new Date(snapshot.savedAt).toLocaleString()}. Discard removes the restored photo and editing state immediately.</Text>
          <StudioButton label="Resume edit" onPress={onResume} />
          <StudioButton label="Discard saved session" onPress={onDiscard} variant="danger" />
        </View>
      </View>
    </Modal>
  );
}

function NoticeModal({ notice, onClose }: { notice: NoticeState; onClose: () => void }) {
  const confirm = () => {
    onClose();
    void notice.onConfirm?.();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcon}><Ionicons name="information-circle-outline" size={30} color={colors.accentBright} /></View>
          <Text style={styles.modalTitle}>{notice.title}</Text>
          <Text style={styles.modalBody}>{notice.message}</Text>
          {notice.onConfirm ? (
            <>
              <StudioButton
                label={notice.confirmLabel || "Continue"}
                onPress={confirm}
                variant={notice.destructive ? "danger" : "primary"}
              />
              <StudioButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          ) : (
            <StudioButton label="OK" onPress={onClose} />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const [hydrating, setHydrating] = useState(true);
  const [consent, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<EditorSnapshot | null>(null);
  const [source, setSource] = useState<StudioImage | null>(null);
  const [working, setWorking] = useState<StudioImage | null>(null);
  const [reference, setReference] = useState<StudioImage | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [mode, setMode] = useState<EditMode>("retouch");
  const [scope, setScope] = useState<EditScope>("selection");
  const [quality, setQuality] = useState<Quality>("standard");
  const [preserve, setPreserve] = useState(0.76);
  const [brushWidth, setBrushWidth] = useState(0.075);
  const [erasingMask, setErasingMask] = useState(false);
  const [strokes, setStrokes] = useState<MaskStroke[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [future, setFuture] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const snapshot = useMemo<EditorSnapshot | null>(() => {
    if (!source || !working) return null;
    return {
      source,
      working,
      reference,
      prompt,
      negativePrompt,
      mode,
      scope,
      preserve,
      quality,
      strokes,
      history,
      savedAt: new Date().toISOString(),
    };
  }, [history, mode, negativePrompt, preserve, prompt, quality, reference, scope, source, strokes, working]);

  const applySnapshot = useCallback((saved: EditorSnapshot) => {
    setSource(saved.source);
    setWorking(saved.working);
    setReference(saved.reference);
    setPrompt(saved.prompt || "");
    setNegativePrompt(saved.negativePrompt || "");
    setMode(saved.mode || "retouch");
    setScope(saved.scope || "selection");
    setPreserve(saved.preserve ?? 0.76);
    setQuality(saved.quality || "standard");
    setStrokes(saved.strokes || []);
    setHistory(saved.history || []);
    setFuture([]);
  }, []);

  const clearEditorState = useCallback(() => {
    setSource(null);
    setWorking(null);
    setReference(null);
    setPrompt("");
    setNegativePrompt("");
    setMode("retouch");
    setScope("selection");
    setPreserve(0.76);
    setQuality("standard");
    setStrokes([]);
    setHistory([]);
    setFuture([]);
    setShowOriginal(false);
    setStatus("");
  }, []);

  useEffect(() => {
    Promise.all([loadConsent(), loadSession()])
      .then(([savedConsent, savedSession]) => {
        if (savedConsent?.version === CONSENT_VERSION) setConsentRecord(savedConsent);
        if (savedSession?.source && savedSession.working) setPendingRecovery(savedSession);
      })
      .finally(() => setHydrating(false));
  }, []);

  useEffect(() => {
    if (!consent || !snapshot || pendingRecovery) return;
    const timer = setTimeout(() => {
      void saveSession(snapshot);
    }, 900);
    return () => clearTimeout(timer);
  }, [consent, pendingRecovery, snapshot]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && snapshot) void saveSession(snapshot);
    });
    return () => subscription.remove();
  }, [snapshot]);

  const verify = async (record: ConsentRecord) => {
    await saveConsent(record);
    setConsentRecord(record);
  };

  const discardRecovery = async () => {
    setPendingRecovery(null);
    clearEditorState();
    await clearSession();
    await removeStudioFiles();
  };

  const pickImage = async (asReference = false) => {
    if (busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice({ title: "Photo access needed", message: "Allow photo access to choose an image for editing." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (result.canceled || !result.assets[0]?.uri) return;
    setBusy(true);
    setStatus(asReference ? "Preparing reference" : "Preparing photo");
    try {
      if (!asReference && source) {
        await clearSession();
        await removeStudioFiles();
        clearEditorState();
      }
      const prepared = await prepareImage(result.assets[0].uri, asReference ? "reference" : "source");
      if (asReference) {
        setReference(prepared);
      } else {
        setSource(prepared);
        setWorking(prepared);
      }
      setStatus("");
    } catch (error) {
      setNotice({ title: "Could not open photo", message: error instanceof Error ? error.message : "Try another image." });
    } finally {
      setBusy(false);
    }
  };

  const pushHistory = useCallback((label: string) => {
    if (!working) return;
    setHistory((items) => [
      ...items,
      { id: createID("history"), uri: working.uri, prompt: label, createdAt: new Date().toISOString() },
    ].slice(-30));
    setFuture([]);
  }, [working]);

  const localTransform = async (action: "rotateLeft" | "rotateRight" | "flip") => {
    if (!working || busy) return;
    setBusy(true);
    setStatus("Applying local edit");
    try {
      const operations = action === "rotateLeft"
        ? [{ rotate: -90 }]
        : action === "rotateRight"
          ? [{ rotate: 90 }]
          : [{ flip: ImageManipulator.FlipType.Horizontal }];
      const rendered = await ImageManipulator.manipulateAsync(
        working.uri,
        operations,
        { compress: 1, format: ImageManipulator.SaveFormat.PNG },
      );
      pushHistory(action === "flip" ? "Flip horizontal" : "Rotate");
      const prepared = await prepareImage(rendered.uri, "local-edit");
      setWorking(prepared);
      setStrokes([]);
    } catch (error) {
      setNotice({ title: "Edit failed", message: error instanceof Error ? error.message : "Try again." });
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const acceptLocalGeneration = async (uri: string) => {
    setBusy(true);
    setStatus("Preparing locally generated image");
    try {
      await clearSession();
      await removeStudioFiles();
      clearEditorState();
      const prepared = await prepareImage(uri, "local-generation");
      setSource(prepared);
      setWorking(prepared);
      setMode("creative");
      setScope("whole");
      setStatus("Local generation complete");
    } catch (error) {
      setNotice({ title: "Could not open generated image", message: error instanceof Error ? error.message : "Try again." });
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (!working || !history.length || busy) return;
    const previous = history[history.length - 1];
    setFuture((items) => [{ id: createID("future"), uri: working.uri, prompt: "Redo", createdAt: new Date().toISOString() }, ...items]);
    setWorking({ ...working, uri: previous.uri });
    setHistory((items) => items.slice(0, -1));
    setStrokes([]);
  };

  const redo = () => {
    if (!working || !future.length || busy) return;
    const next = future[0];
    setHistory((items) => [...items, { id: createID("history"), uri: working.uri, prompt: "Undo point", createdAt: new Date().toISOString() }]);
    setWorking({ ...working, uri: next.uri });
    setFuture((items) => items.slice(1));
    setStrokes([]);
  };

  const reset = () => {
    if (!source || !working || busy) return;
    pushHistory("Before reset");
    setWorking(source);
    setStrokes([]);
    setReference(null);
    setShowOriginal(false);
  };

  const discardCurrent = () => {
    setNotice({
      title: "Discard this edit?",
      message: "This removes the working photo, prompts, masks, and local history from Edit Studio.",
      confirmLabel: "Discard",
      destructive: true,
      onConfirm: async () => {
        abortRef.current?.abort();
        clearEditorState();
        await clearSession();
        await removeStudioFiles();
      },
    });
  };

  const generate = async (overridePrompt?: string) => {
    if (!working || busy) return;
    const requestedPrompt = (overridePrompt ?? prompt).trim();
    const decision = evaluatePrompt(requestedPrompt);
    if (!decision.allowed) {
      setNotice({ title: "Edit not available", message: decision.message || "That edit is not available." });
      return;
    }
    if (scope === "selection" && !hasPaintedSelection(strokes)) {
      setNotice({ title: "Paint a selection", message: "Draw over the area you want changed, or choose Whole image." });
      return;
    }

    const localOperation = reference ? null : detectLocalOperation(requestedPrompt);
    if (localOperation === "remove" && scope === "whole") {
      setNotice({
        title: "Paint the area to clean up",
        message: "Choose Selected area, paint over the object, then apply the edit. Cleanup copies nearby image detail into the painted area.",
      });
      return;
    }
    if (localOperation) {
      setBusy(true);
      setStatus("Applying edit on this device");
      try {
        const resultURI = await applyLocalEdit({
          image: working,
          operation: localOperation,
          amount: Math.max(0.45, Math.min(1, 1.15 - preserve * 0.55)),
          strokes,
          scope,
        });
        pushHistory(requestedPrompt);
        const result = await prepareImage(resultURI, "local-result");
        setWorking(result);
        setPrompt(requestedPrompt);
        setStrokes([]);
        setShowOriginal(false);
        setStatus("On-device edit complete");
      } catch (error) {
        setNotice({
          title: "Local edit failed",
          message: error instanceof Error ? error.message : "Try the edit again.",
        });
        setStatus("");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!CLOUD_GENERATION_ENABLED) {
      setNotice({
        title: "This edit is not on-device yet",
        message: `No paid provider was contacted. The private local generator can create a new image from the start screen, while the built-in editor handles the following existing-photo changes: ${LOCAL_EDIT_HELP}`,
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStatus("Generating edit… this can take up to two minutes");
    try {
      const clientID = await getClientID();
      const response = await requestEdit({
        image: working,
        reference,
        prompt: requestedPrompt,
        negativePrompt,
        mode,
        preserve,
        quality,
        scope,
        strokes,
        clientID,
        signal: controller.signal,
      });
      const result = await saveGeneratedBase64(response.imageBase64!);
      pushHistory(requestedPrompt);
      setWorking(result);
      setPrompt(requestedPrompt);
      setStrokes([]);
      setShowOriginal(false);
      setStatus("Edit complete");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("Generation cancelled");
      } else {
        const detail = error instanceof Error ? error.message : "Try again.";
        const needsCloudSetup = /not configured|api key|failed to fetch|network request failed/i.test(detail);
        setNotice({
          title: needsCloudSetup ? "This request needs cloud generation" : "Could not generate edit",
          message: needsCloudSetup
            ? `The built-in editor works without an account, but this open-ended request needs the optional cloud generator. ${LOCAL_EDIT_HELP}`
            : detail,
        });
        setStatus("");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
  };

  const saveToPhotos = async () => {
    if (!working) return;
    if (Platform.OS === "web") {
      const response = await fetch(working.uri);
      const blob = await response.blob();
      const downloadURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadURL;
      anchor.download = `edit-studio-${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(downloadURL);
      setNotice({ title: "Saved", message: "The edited image download has started." });
      return;
    }
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      setNotice({ title: "Photos permission needed", message: "Allow access so Edit Studio can save the finished image." });
      return;
    }
    await MediaLibrary.saveToLibraryAsync(working.uri);
    setNotice({ title: "Saved", message: "The edited image is in Photos." });
  };

  const shareImage = async () => {
    if (!working || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(working.uri, { mimeType: "image/png", dialogTitle: "Share Edit Studio image" });
  };

  const checkForUpdates = async () => {
    try {
      if (__DEV__) {
        setNotice({ title: "Updates", message: "Over-the-air updates are active in production and TestFlight builds." });
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        setNotice({ title: "Up to date", message: "You already have the latest compatible Edit Studio update." });
        return;
      }
      await Updates.fetchUpdateAsync();
      setNotice({
        title: "Update ready",
        message: "Restart now to apply it?",
        confirmLabel: "Restart",
        onConfirm: () => Updates.reloadAsync(),
      });
    } catch {
      setNotice({ title: "Could not check", message: "Try checking for updates again later." });
    }
  };

  const revokeVerification = () => {
    setNotice({
      title: "Reset age & consent check?",
      message: "You will need to complete it again before using Edit Studio.",
      confirmLabel: "Reset",
      destructive: true,
      onConfirm: async () => {
        await clearConsent();
        setConsentRecord(null);
        setSettingsVisible(false);
      },
    });
  };

  if (hydrating) {
    return <View style={styles.loadingScreen}><Ionicons name="sparkles" size={34} color={colors.accentBright} /></View>;
  }
  if (!consent) {
    return <AgeGate onVerified={verify} />;
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {pendingRecovery ? (
        <RecoveryModal
          snapshot={pendingRecovery}
          onResume={() => { applySnapshot(pendingRecovery); setPendingRecovery(null); }}
          onDiscard={() => void discardRecovery()}
        />
      ) : null}
      {notice ? <NoticeModal notice={notice} onClose={() => setNotice(null)} /> : null}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PHOTO EDIT STUDIO</Text>
            <Text style={styles.title}>Edit Studio</Text>
          </View>
          <Pressable accessibilityLabel="Settings" onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={23} color={colors.text} />
          </Pressable>
        </View>

        {!working ? (
          <>
            <Card style={styles.emptyCard}>
              <View style={styles.emptyIcon}><Ionicons name="images-outline" size={42} color={colors.accentBright} /></View>
              <Text style={styles.emptyTitle}>Choose a photo to begin</Text>
              <Text style={styles.emptyBody}>Paint a precise selection or edit the whole image. Built-in photo edits do not require a model download.</Text>
              <StudioButton label="Choose photo" onPress={() => void pickImage(false)} loading={busy} />
              {status ? <Text style={styles.statusText}>{status}</Text> : null}
            </Card>
            <LocalGenerator onGenerated={acceptLocalGeneration} />
          </>
        ) : (
          <>
            <Card>
              <SectionTitle number="1" title="Select what changes" subtitle="Purple is the editable area. Erase mask removes purple—not the photo." />
              <View style={styles.compareRow}>
                <Segment<EditScope>
                  value={scope}
                  options={[{ value: "selection", label: "Painted area" }, { value: "whole", label: "Whole image" }]}
                  onChange={(value) => { setScope(value); setShowOriginal(false); }}
                />
              </View>
              <MaskCanvas
                image={showOriginal ? source! : working}
                strokes={strokes}
                onChange={setStrokes}
                brushWidth={brushWidth}
                erasing={erasingMask}
                enabled={scope === "selection" && !showOriginal && !busy}
              />

              <View style={styles.toolRow}>
                <Pressable onPress={() => setErasingMask(false)} style={[styles.toolButton, !erasingMask && styles.toolButtonSelected]}>
                  <Ionicons name="brush" size={18} color={!erasingMask ? colors.white : colors.muted} />
                  <Text style={[styles.toolText, !erasingMask && styles.toolTextSelected]}>Brush</Text>
                </Pressable>
                <Pressable onPress={() => setErasingMask(true)} style={[styles.toolButton, erasingMask && styles.toolButtonSelected]}>
                  <Ionicons name="color-wand-outline" size={18} color={erasingMask ? colors.white : colors.muted} />
                  <Text style={[styles.toolText, erasingMask && styles.toolTextSelected]}>Erase mask</Text>
                </Pressable>
                <Pressable disabled={!strokes.length} onPress={() => setStrokes((items) => items.slice(0, -1))} style={styles.smallAction}>
                  <Ionicons name="arrow-undo" size={19} color={strokes.length ? colors.text : colors.border} />
                </Pressable>
                <Pressable disabled={!strokes.length} onPress={() => setStrokes([])} style={styles.smallAction}>
                  <Ionicons name="trash-outline" size={19} color={strokes.length ? colors.danger : colors.border} />
                </Pressable>
              </View>
              {scope === "selection" ? (
                <View style={styles.sliderRow}>
                  <Ionicons name="ellipse" size={8} color={colors.muted} />
                  <Slider
                    style={{ flex: 1, height: 36 }}
                    minimumValue={0.025}
                    maximumValue={0.22}
                    value={brushWidth}
                    onValueChange={setBrushWidth}
                    minimumTrackTintColor={colors.accent}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.accentBright}
                  />
                  <Ionicons name="ellipse" size={20} color={colors.muted} />
                </View>
              ) : null}

              <View style={styles.inlineActions}>
                <StudioButton label="Rotate left" onPress={() => void localTransform("rotateLeft")} variant="secondary" compact />
                <StudioButton label="Rotate right" onPress={() => void localTransform("rotateRight")} variant="secondary" compact />
                <StudioButton label="Flip" onPress={() => void localTransform("flip")} variant="secondary" compact />
              </View>
            </Card>

            <Card>
              <SectionTitle number="2" title="Describe the edit" subtitle="Say what should change and what must stay untouched." />
              <Segment<EditMode>
                value={mode}
                options={[{ value: "retouch", label: "Retouch" }, { value: "replace", label: "Replace" }, { value: "creative", label: "Creative" }]}
                onChange={setMode}
              />
              <TextInput
                accessibilityLabel="Edit description"
                value={prompt}
                onChangeText={setPrompt}
                editable={!busy}
                multiline
                maxLength={1200}
                placeholder="Example: soften the lighting, retain natural skin texture, and keep the face unchanged"
                placeholderTextColor="#666574"
                style={styles.promptInput}
                textAlignVertical="top"
              />
              <View style={styles.recolorBlock}>
                <View>
                  <Text style={styles.fieldLabel}>Quick recolor</Text>
                  <Text style={styles.fieldHelp}>Paint the clothing, choose a color, then apply the edit.</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow} keyboardShouldPersistTaps="handled">
                  {RECOLOR_PRESETS.map((color) => (
                    <Pressable
                      key={color.name}
                      accessibilityRole="button"
                      accessibilityLabel={`Recolor painted area ${color.name}`}
                      onPress={() => {
                        setScope("selection");
                        setReference(null);
                        setPrompt(`Recolor the painted area ${color.name}`);
                      }}
                      style={styles.colorChoice}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: color.hex }]} />
                      <Text style={styles.colorName}>{color.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable key={suggestion} onPress={() => setPrompt(suggestion)} style={styles.suggestion}>
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                accessibilityLabel="Things to avoid"
                value={negativePrompt}
                onChangeText={setNegativePrompt}
                editable={!busy}
                placeholder="Optional: things to avoid"
                placeholderTextColor="#666574"
                style={styles.negativeInput}
              />

              <View style={styles.referenceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Reference image</Text>
                  <Text style={styles.fieldHelp}>Optional style, wardrobe, or composition reference.</Text>
                </View>
                {reference ? (
                  <View style={styles.referencePreview}>
                    <Image source={{ uri: reference.uri }} style={styles.referenceImage} contentFit="cover" />
                    <Pressable accessibilityLabel="Remove reference" onPress={() => setReference(null)} style={styles.referenceRemove}>
                      <Ionicons name="close" size={16} color={colors.white} />
                    </Pressable>
                  </View>
                ) : (
                  <StudioButton label="Add" onPress={() => void pickImage(true)} variant="secondary" compact />
                )}
              </View>
            </Card>

            <Card>
              <SectionTitle
                number="3"
                title="Apply edit"
                subtitle="Lighting, recoloring, retouching, effects, and painted-area cleanup run on this device without an account or usage fee."
              />
              <Text style={styles.fieldLabel}>Preserve original</Text>
              <View style={styles.preserveHeader}>
                <Text style={styles.fieldHelp}>Identity, pose, lighting, and unrequested details</Text>
                <Text style={styles.preserveValue}>{Math.round(preserve * 100)}%</Text>
              </View>
              <Slider
                style={{ width: "100%", height: 42 }}
                minimumValue={0.2}
                maximumValue={0.95}
                value={preserve}
                onValueChange={setPreserve}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accentBright}
              />
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Quality</Text>
              <Segment<Quality>
                value={quality}
                options={[{ value: "draft", label: "Draft" }, { value: "standard", label: "Standard" }, { value: "high", label: "High" }]}
                onChange={setQuality}
              />

              {busy ? (
                <View style={styles.generatingBox}>
                  <View style={styles.generatingHeader}>
                    <Ionicons name="sparkles" size={20} color={colors.accentBright} />
                    <Text style={styles.generatingText}>{status || "Working"}</Text>
                  </View>
                  {abortRef.current ? <StudioButton label="Cancel generation" onPress={cancelGeneration} variant="danger" /> : null}
                </View>
              ) : (
                <StudioButton
                  label="Apply edit"
                  onPress={() => void generate()}
                  disabled={!prompt.trim() || (scope === "selection" && !hasPaintedSelection(strokes))}
                  icon={<Ionicons name="sparkles" size={19} color={colors.white} />}
                />
              )}
              {status && !busy ? <Text style={styles.statusText}>{status}</Text> : null}
            </Card>

            <Card>
              <SectionTitle number="4" title="Review & export" />
              <View style={styles.reviewActions}>
                <StudioButton label={showOriginal ? "Show edited" : "Compare original"} onPress={() => setShowOriginal((value) => !value)} variant="secondary" compact />
                <StudioButton label="Undo" onPress={undo} variant="secondary" compact disabled={!history.length} />
                <StudioButton label="Redo" onPress={redo} variant="secondary" compact disabled={!future.length} />
                <StudioButton label="Reset" onPress={reset} variant="secondary" compact />
              </View>
              <View style={styles.exportRow}>
                <View style={{ flex: 1 }}><StudioButton label="Save to Photos" onPress={() => void saveToPhotos()} variant="primary" /></View>
                <Pressable accessibilityLabel="Share image" onPress={() => void shareImage()} style={styles.exportIcon}>
                  <Ionicons name="share-outline" size={24} color={colors.text} />
                </Pressable>
              </View>
              <StudioButton label="Discard project" onPress={discardCurrent} variant="danger" />
            </Card>

            {history.length ? (
              <Card>
                <Text style={styles.sectionTitle}>Local history</Text>
                <Text style={styles.sectionSubtitle}>Stored only on this device. Up to 30 undo points.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
                  {history.slice().reverse().map((item) => (
                    <View key={item.id} style={styles.historyItem}>
                      <Image source={{ uri: item.uri }} style={styles.historyImage} contentFit="cover" />
                      <Text numberOfLines={2} style={styles.historyPrompt}>{item.prompt}</Text>
                    </View>
                  ))}
                </ScrollView>
              </Card>
            ) : null}
          </>
        )}

        <Text style={styles.footer}>Edit Studio 2.0 · Built-in edits stay on this device. Only optional cloud requests upload an image.</Text>
      </ScrollView>

      <Modal transparent animationType="slide" visible={settingsVisible} onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.settingsBackdrop}>
          <View style={[styles.settingsSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.settingsHeader}>
              <Text style={styles.modalTitle}>Settings & privacy</Text>
              <Pressable onPress={() => setSettingsVisible(false)} style={styles.iconButton}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>
            <Text style={styles.modalBody}>{CONSENT_DISCLAIMER}</Text>
            <StudioButton label="Check for app update" onPress={() => void checkForUpdates()} variant="secondary" />
            <StudioButton label="Reset age & consent check" onPress={revokeVerification} variant="danger" />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  eyebrow: { color: colors.accentBright, fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: colors.text, fontSize: 31, lineHeight: 37, fontWeight: "900", letterSpacing: -0.8 },
  iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.panel, borderRadius: radii.large, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 },
  emptyCard: { minHeight: 430, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyIcon: { width: 82, height: 82, borderRadius: 28, backgroundColor: "rgba(129,89,255,0.14)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.text, fontSize: 23, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 4 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  sectionNumber: { width: 28, height: 28, borderRadius: 10, backgroundColor: "rgba(129,89,255,0.17)", alignItems: "center", justifyContent: "center" },
  sectionNumberText: { color: colors.accentBright, fontSize: 13, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  compareRow: { marginTop: 1 },
  segment: { flexDirection: "row", backgroundColor: colors.background, borderRadius: radii.small, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  segmentItemSelected: { backgroundColor: colors.panelRaised },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  segmentTextSelected: { color: colors.text },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radii.small, paddingHorizontal: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  toolButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  toolText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  toolTextSelected: { color: colors.white },
  smallAction: { width: 40, height: 40, borderRadius: radii.small, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  promptInput: { minHeight: 126, borderRadius: radii.medium, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16, lineHeight: 23 },
  recolorBlock: { gap: 9 },
  colorRow: { gap: 10, paddingRight: 12 },
  colorChoice: { width: 58, alignItems: "center", gap: 6 },
  colorSwatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.border },
  colorName: { color: colors.muted, fontSize: 10, textTransform: "capitalize" },
  negativeInput: { minHeight: 48, borderRadius: radii.small, paddingHorizontal: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 },
  suggestions: { gap: 8, paddingRight: 12 },
  suggestion: { maxWidth: 230, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelRaised, paddingVertical: 9, paddingHorizontal: 13 },
  suggestionText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  referenceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  fieldHelp: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  referencePreview: { width: 58, height: 58 },
  referenceImage: { width: 58, height: 58, borderRadius: 12, backgroundColor: colors.background },
  referenceRemove: { position: "absolute", right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  preserveHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  preserveValue: { color: colors.accentBright, fontSize: 13, fontWeight: "900" },
  generatingBox: { gap: 13, borderRadius: radii.medium, padding: 14, backgroundColor: "rgba(129,89,255,0.10)", borderWidth: 1, borderColor: "rgba(129,89,255,0.25)" },
  generatingHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  generatingText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  statusText: { color: colors.success, fontSize: 12, textAlign: "center" },
  reviewActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exportRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  exportIcon: { width: 52, borderRadius: radii.medium, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelRaised, alignItems: "center", justifyContent: "center" },
  historyRow: { gap: 10, paddingRight: 12 },
  historyItem: { width: 108 },
  historyImage: { width: 108, height: 86, borderRadius: 12, backgroundColor: colors.background },
  historyPrompt: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 24, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", padding: 22 },
  modalCard: { width: "100%", maxWidth: 460, borderRadius: radii.large, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  modalIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(129,89,255,0.14)", alignItems: "center", justifyContent: "center" },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  modalBody: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  settingsBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.64)", justifyContent: "flex-end" },
  settingsSheet: { backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 2 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
