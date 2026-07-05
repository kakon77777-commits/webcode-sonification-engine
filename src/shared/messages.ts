import type { PageFeatures, Score, TuningOptions } from "./types.js";

/** Error codes surfaced in the popup (§79 of the whitepaper). */
export type WseErrorCode =
  | "NO_PERMISSION"
  | "NO_DOM"
  | "AUDIO_BLOCKED"
  | "EXTRACTION_TIMEOUT"
  | "PAGE_TOO_LARGE"
  | "UNSUPPORTED_PAGE";

/** Content script → popup. */
export interface FeaturesMessage {
  type: "WSE_FEATURES";
  payload: PageFeatures;
}
export interface ExtractErrorMessage {
  type: "WSE_EXTRACT_ERROR";
  code: WseErrorCode;
  detail?: string;
}

/** Popup → service worker. */
export interface PlayMessage {
  type: "WSE_PLAY";
  score: Score;
  tuning?: TuningOptions;
}
export interface StopMessage {
  type: "WSE_STOP";
}
export interface GetStateMessage {
  type: "WSE_GET_STATE";
}

/** Service worker → offscreen document. */
export interface OffscreenPlayMessage {
  type: "WSE_OFFSCREEN_PLAY";
  target: "wse-offscreen";
  score: Score;
  tuning?: TuningOptions;
}
export interface OffscreenStopMessage {
  type: "WSE_OFFSCREEN_STOP";
  target: "wse-offscreen";
}
export interface OffscreenGetStateMessage {
  type: "WSE_OFFSCREEN_GET_STATE";
  target: "wse-offscreen";
}

export interface PlaybackState {
  playing: boolean;
  /** Seconds into the score, when playing. */
  position: number;
  summary?: {
    bpm: number;
    keyName: string;
    scale: string;
    style: string;
    lengthSec: number;
    hash: string;
  };
}

export type WseMessage =
  | FeaturesMessage
  | ExtractErrorMessage
  | PlayMessage
  | StopMessage
  | GetStateMessage
  | OffscreenPlayMessage
  | OffscreenStopMessage
  | OffscreenGetStateMessage;
