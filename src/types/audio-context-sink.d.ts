export {};

declare global {
  interface AudioContext {
    setSinkId(sinkId: string): Promise<void>;
  }
}
