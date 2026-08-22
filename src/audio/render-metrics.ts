export interface ChannelRenderMetrics {
  peak: number;
  rms: number;
  dcOffset: number;
  nonZeroSamples: number;
  clippedSamples: number;
}

export interface RenderMetrics {
  frameCount: number;
  channelCount: number;
  peak: number;
  rms: number;
  dcOffset: number;
  nonFiniteSamples: number;
  clippedSamples: number;
  channels: ChannelRenderMetrics[];
}

/**
 * Measures a rendered multichannel buffer using the shortest channel length as
 * the shared frame count. Non-finite samples are counted separately and treated
 * as zero for accumulation.
 */
export function measureRenderedChannels(
  channels: readonly Float32Array[],
  clipThreshold = 0.999
): RenderMetrics {
  const channelCount = channels.length;
  const frameCount =
    channelCount === 0 ? 0 : Math.min(...channels.map((channel) => channel.length));

  const perChannel: ChannelRenderMetrics[] = [];
  let peak = 0;
  let sumSquares = 0;
  let sum = 0;
  let finiteSamples = 0;
  let nonFiniteSamples = 0;
  let clippedSamples = 0;

  for (const channel of channels) {
    let channelPeak = 0;
    let channelSumSquares = 0;
    let channelSum = 0;
    let channelFiniteSamples = 0;
    let channelNonZeroSamples = 0;
    let channelClippedSamples = 0;

    for (let i = 0; i < frameCount; i++) {
      const sample = channel[i] ?? 0;
      if (!Number.isFinite(sample)) {
        nonFiniteSamples++;
        continue;
      }

      const abs = Math.abs(sample);
      if (abs > channelPeak) channelPeak = abs;
      if (abs >= clipThreshold) channelClippedSamples++;
      if (sample !== 0) channelNonZeroSamples++;
      channelSum += sample;
      channelSumSquares += sample * sample;
      channelFiniteSamples++;
    }

    peak = Math.max(peak, channelPeak);
    sum += channelSum;
    sumSquares += channelSumSquares;
    finiteSamples += channelFiniteSamples;
    clippedSamples += channelClippedSamples;
    perChannel.push({
      peak: channelPeak,
      rms: channelFiniteSamples === 0 ? 0 : Math.sqrt(channelSumSquares / channelFiniteSamples),
      dcOffset: channelFiniteSamples === 0 ? 0 : channelSum / channelFiniteSamples,
      nonZeroSamples: channelNonZeroSamples,
      clippedSamples: channelClippedSamples,
    });
  }

  return {
    frameCount,
    channelCount,
    peak,
    rms: finiteSamples === 0 ? 0 : Math.sqrt(sumSquares / finiteSamples),
    dcOffset: finiteSamples === 0 ? 0 : sum / finiteSamples,
    nonFiniteSamples,
    clippedSamples,
    channels: perChannel,
  };
}

export function isHealthyRender(metrics: RenderMetrics, minimumRms = 1e-5): boolean {
  return metrics.nonFiniteSamples === 0 && metrics.clippedSamples === 0 && metrics.rms >= minimumRms;
}
