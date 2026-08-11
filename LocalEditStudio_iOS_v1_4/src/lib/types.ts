export type EditMode = "retouch" | "replace" | "creative";
export type EditScope = "selection" | "whole";
export type Quality = "draft" | "standard" | "high";

export interface Point {
  x: number;
  y: number;
}

export interface MaskStroke {
  id: string;
  points: Point[];
  width: number;
  erase: boolean;
}

export interface StudioImage {
  uri: string;
  width: number;
  height: number;
  mimeType: "image/png";
}

export interface HistoryItem {
  id: string;
  uri: string;
  prompt: string;
  createdAt: string;
}

export interface ConsentRecord {
  acceptedAt: string;
  version: number;
  isAdult: true;
  hasConsentAndRights: true;
}

export interface EditorSnapshot {
  source: StudioImage | null;
  working: StudioImage | null;
  reference: StudioImage | null;
  prompt: string;
  negativePrompt: string;
  mode: EditMode;
  scope: EditScope;
  preserve: number;
  quality: Quality;
  strokes: MaskStroke[];
  history: HistoryItem[];
  savedAt: string;
}

export interface EditResponse {
  imageBase64?: string;
  mimeType?: string;
  revisedPrompt?: string;
  error?: string;
  code?: string;
}
