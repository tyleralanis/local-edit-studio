import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ConsentRecord, EditorSnapshot } from "./types";

const CONSENT_KEY = "edit-studio:consent:v1";
const SESSION_KEY = "edit-studio:session:v2";
const CLIENT_ID_KEY = "edit-studio:client-id:v1";

export async function loadConsent(): Promise<ConsentRecord | null> {
  const value = await AsyncStorage.getItem(CONSENT_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as ConsentRecord;
  } catch {
    return null;
  }
}

export async function saveConsent(record: ConsentRecord) {
  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(record));
}

export async function clearConsent() {
  await AsyncStorage.removeItem(CONSENT_KEY);
}

export async function loadSession(): Promise<EditorSnapshot | null> {
  const value = await AsyncStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as EditorSnapshot;
  } catch {
    return null;
  }
}

export async function saveSession(snapshot: EditorSnapshot) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getClientID() {
  const existing = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const created = `ios-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  await AsyncStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}
