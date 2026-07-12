import type { PageFeatures, Score, TuningOptions } from "./types.js";
import type { MutationBatch } from "../mapping/live.js";

/** Error codes surfaced in the popup (§79 of the whitepaper). */
export type WseErrorCode =
  | "NO_PERMISSION"
  | "NO_DOM"
  | "AUDIO_BLOCKED"
  | "EXTRACTION_TIMEOUT"
  | "PAGE_TOO_LARGE"
  | "UNSUPPORTED_PAGE";

/**
 * "auto" = real-time clock (default). "scroll" = viewport as playhead (§45).
 * "live" = DOM mutations drive a live performance (§29–31).
 */
export type DriveMode = "auto" | "scroll" | "live";

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
  driveMode?: DriveMode;
}
export interface StopMessage {
  type: "WSE_STOP";
}
export interface GetStateMessage {
  type: "WSE_GET_STATE";
}

/** Content script (scroll-tracker) → service worker → offscreen document. */
export interface ScrollPositionMessage {
  type: "WSE_SCROLL_POSITION";
  fraction: number;
}
/** Popup/service worker → content script (scroll-tracker): detach and clean up. */
export interface ScrollStopMessage {
  type: "WSE_SCROLL_STOP";
}

/** Content script (mutation-tracker) → service worker → offscreen document. */
export interface MutationBatchMessage {
  type: "WSE_MUTATION_BATCH";
  batch: MutationBatch;
}
/** Popup/service worker → content script (mutation-tracker): detach and clean up. */
export interface MutationStopMessage {
  type: "WSE_MUTATION_STOP";
}

/** Service worker → offscreen document. */
export interface OffscreenPlayMessage {
  type: "WSE_OFFSCREEN_PLAY";
  target: "wse-offscreen";
  score: Score;
  tuning?: TuningOptions;
  driveMode?: DriveMode;
}
export interface OffscreenStopMessage {
  type: "WSE_OFFSCREEN_STOP";
  target: "wse-offscreen";
}
export interface OffscreenGetStateMessage {
  type: "WSE_OFFSCREEN_GET_STATE";
  target: "wse-offscreen";
}
export interface OffscreenScrollMessage {
  type: "WSE_OFFSCREEN_SCROLL";
  target: "wse-offscreen";
  fraction: number;
}
export interface OffscreenMutationMessage {
  type: "WSE_OFFSCREEN_MUTATION_BATCH";
  target: "wse-offscreen";
  batch: MutationBatch;
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
  | ScrollPositionMessage
  | ScrollStopMessage
  | MutationBatchMessage
  | MutationStopMessage
  | OffscreenPlayMessage
  | OffscreenStopMessage
  | OffscreenGetStateMessage
  | OffscreenScrollMessage
  | OffscreenMutationMessage;
