export { computeFingerprint, canonicalFeatureString } from "./fingerprint.js";
export { normalizeFeatures } from "./normalize.js";
export { deriveProfile, SCALE_INTERVALS } from "./profile.js";
export { generateScore } from "./default-map.js";
export { quantizePitch, quantizeTime, degreeToMidi, scalePitchClasses, clampMidi } from "./quantize.js";
export { applyLimits, MAX_VOICES, MAX_EVENTS_PER_SECOND } from "./limits.js";
export { chooseOrchestration, detectCharacter, euclid } from "./orchestration.js";
export { arrangeMusically } from "./arrangement.js";
export { mulberry32, mixSeed, fnv1a32, hash64hex } from "./deterministic-seed.js";
