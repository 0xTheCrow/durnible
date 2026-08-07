export const AUDIO_LEVEL_SAMPLE_INTERVAL_MS = 50;

const ANALYSER_FFT_SIZE = 1024;
const SILENCE_DECIBELS = -60;

export type AudioLevelMeter = {
  analyserNode: AnalyserNode;
  measureLevel: () => number;
};

export const createAudioLevelMeter = (audioContext: AudioContext): AudioLevelMeter => {
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = ANALYSER_FFT_SIZE;
  const samples = new Float32Array(analyserNode.fftSize);

  const measureLevel = (): number => {
    analyserNode.getFloatTimeDomainData(samples);
    let sumOfSquares = 0;
    for (let index = 0; index < samples.length; index += 1) {
      sumOfSquares += samples[index] * samples[index];
    }
    const rootMeanSquare = Math.sqrt(sumOfSquares / samples.length);
    if (rootMeanSquare === 0) return 0;

    const decibels = 20 * Math.log10(rootMeanSquare);
    const level = (decibels - SILENCE_DECIBELS) / -SILENCE_DECIBELS;
    return Math.min(1, Math.max(0, level));
  };

  return { analyserNode, measureLevel };
};
