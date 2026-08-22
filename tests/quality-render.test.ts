import { describe, expect, it } from "vitest";
import { qualityEventForInstrument } from "../src/audio/quality-render.js";
import type { InstrumentName, NoteLayer } from "../src/shared/types.js";

const EXPECTED_LAYERS: Record<InstrumentName, NoteLayer> = {
  pad: "pad",
  lowpad: "pad",
  strings: "melody",
  choir: "pad",
  piano: "melody",
  epiano: "melody",
  pluck: "arp",
  bell: "arp",
  mallet: "arp",
  marimba: "arp",
  bass: "bass",
  subbass: "bass",
  brass: "melody",
  lead: "melody",
  flute: "melody",
  clarinet: "melody",
  xiao: "melody",
  guitar: "arp",
  koto: "arp",
  taiko: "perc",
  kick: "perc",
  hihat: "perc",
  perc: "perc",
};

describe("qualityEventForInstrument", () => {
  it("returns a stable probe note for every instrument layer family", () => {
    for (const [index, instrument] of (Object.keys(EXPECTED_LAYERS) as InstrumentName[]).entries()) {
      const event = qualityEventForInstrument(instrument, index);

      expect(qualityEventForInstrument(instrument, index)).toEqual(event);
      expect(event).toEqual({
        instrument,
        layer: EXPECTED_LAYERS[instrument],
        pitch: 60,
        velocity: 0.65,
        pan: 0,
        time: 0.05,
        duration: 0.8,
      });
    }
  });
});
