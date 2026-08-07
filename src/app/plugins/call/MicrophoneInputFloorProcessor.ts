import type { AudioProcessorOptions, Track, TrackProcessor } from 'livekit-client';
import type { AudioLevelMeter } from './audioLevel';
import { AUDIO_LEVEL_SAMPLE_INTERVAL_MS, createAudioLevelMeter } from './audioLevel';

const PROCESSOR_NAME = 'microphone-input-floor';
const GATE_HOLD_MS = 300;
const GATE_RAMP_TIME_CONSTANT_SECONDS = 0.015;

type AudioGraph = {
  sourceNode: MediaStreamAudioSourceNode;
  meter: AudioLevelMeter;
  gainNode: GainNode;
  destinationNode: MediaStreamAudioDestinationNode;
};

export class MicrophoneInputFloorProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  name = PROCESSOR_NAME;

  processedTrack?: MediaStreamTrack;

  private inputFloorLevel: number;

  private audioContext?: AudioContext;

  private audioGraph?: AudioGraph;

  private sampleIntervalId?: ReturnType<typeof setInterval>;

  private isGateOpen = true;

  private lastAboveFloorAt = 0;

  constructor(inputFloorLevel: number) {
    this.inputFloorLevel = inputFloorLevel;
  }

  setInputFloorLevel(inputFloorLevel: number): void {
    this.inputFloorLevel = inputFloorLevel;
  }

  async init({ audioContext, track }: AudioProcessorOptions): Promise<void> {
    this.audioContext = audioContext;
    this.buildAudioGraph(track);
  }

  async restart({ track }: AudioProcessorOptions): Promise<void> {
    this.releaseAudioGraph();
    this.buildAudioGraph(track);
  }

  async destroy(): Promise<void> {
    this.releaseAudioGraph();
    this.audioContext = undefined;
  }

  private buildAudioGraph(track: MediaStreamTrack): void {
    const audioContext = this.audioContext;
    if (!audioContext) return;
    const sourceNode = audioContext.createMediaStreamSource(new MediaStream([track]));
    const meter = createAudioLevelMeter(audioContext);
    const gainNode = audioContext.createGain();
    const destinationNode = audioContext.createMediaStreamDestination();

    sourceNode.connect(meter.analyserNode);
    meter.analyserNode.connect(gainNode);
    gainNode.connect(destinationNode);

    this.audioGraph = { sourceNode, meter, gainNode, destinationNode };
    this.processedTrack = destinationNode.stream.getAudioTracks()[0];
    this.isGateOpen = true;
    this.lastAboveFloorAt = 0;
    this.sampleIntervalId = setInterval(() => this.updateGate(), AUDIO_LEVEL_SAMPLE_INTERVAL_MS);
  }

  private releaseAudioGraph(): void {
    if (this.sampleIntervalId !== undefined) {
      clearInterval(this.sampleIntervalId);
      this.sampleIntervalId = undefined;
    }
    if (this.audioGraph) {
      const { sourceNode, meter, gainNode, destinationNode } = this.audioGraph;
      sourceNode.disconnect();
      meter.analyserNode.disconnect();
      gainNode.disconnect();
      destinationNode.disconnect();
      this.audioGraph = undefined;
    }
    this.processedTrack?.stop();
    this.processedTrack = undefined;
  }

  private updateGate(): void {
    const audioContext = this.audioContext;
    if (!this.audioGraph || !audioContext) return;
    const { meter, gainNode } = this.audioGraph;

    const now = performance.now();
    if (meter.measureLevel() >= this.inputFloorLevel) {
      this.lastAboveFloorAt = now;
    }
    const shouldGateBeOpen =
      this.inputFloorLevel <= 0 || now - this.lastAboveFloorAt < GATE_HOLD_MS;
    if (shouldGateBeOpen === this.isGateOpen) return;

    this.isGateOpen = shouldGateBeOpen;
    gainNode.gain.setTargetAtTime(
      shouldGateBeOpen ? 1 : 0,
      audioContext.currentTime,
      GATE_RAMP_TIME_CONSTANT_SECONDS
    );
  }
}
