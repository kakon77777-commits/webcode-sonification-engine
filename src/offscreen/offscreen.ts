import type { PlaybackState } from "../shared/messages.js";
import type { Score } from "../shared/types.js";
import { WseAudioEngine } from "../audio/engine.js";

/**
 * Offscreen audio document (§10): MV3 service workers have no DOM and are not
 * a stable audio host, so playback lives here, created on demand with the
 * AUDIO_PLAYBACK reason.
 */

const engine = new WseAudioEngine();
let lastScore: Score | null = null;

function stateOf(): PlaybackState {
  const s = engine.getState();
  const score = engine.getScore() ?? lastScore;
  return {
    playing: s.playing,
    position: Math.round(s.position * 10) / 10,
    summary: score
      ? {
          bpm: score.profile.bpm,
          keyName: score.profile.keyName,
          scale: score.profile.scale,
          style: score.profile.style,
          lengthSec: score.profile.lengthSec,
          hash: score.fingerprint.hash,
        }
      : undefined,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== "wse-offscreen") return undefined;

  if (msg.type === "WSE_OFFSCREEN_PLAY") {
    const score = msg.score as Score;
    const tuning = msg.tuning as { brightness?: number; reverb?: number } | undefined;
    lastScore = score;
    engine
      .play(score, { brightness: tuning?.brightness, reverb: tuning?.reverb })
      .then(() => sendResponse({ ok: true, state: stateOf() }))
      .catch((err: unknown) => {
        sendResponse({
          ok: false,
          code: "AUDIO_BLOCKED",
          detail: err instanceof Error ? err.message : String(err),
        });
      });
    return true; // async response
  }

  if (msg.type === "WSE_OFFSCREEN_STOP") {
    engine
      .stop()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "WSE_OFFSCREEN_GET_STATE") {
    sendResponse({ ok: true, state: stateOf() });
    return undefined;
  }

  return undefined;
});
