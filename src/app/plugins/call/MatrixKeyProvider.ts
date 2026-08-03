import { BaseKeyProvider, createKeyMaterialFromBuffer } from 'livekit-client';
import type { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';
import type { CallMembershipIdentityParts } from 'matrix-js-sdk/lib/matrixrtc/EncryptionManager';

export class MatrixKeyProvider extends BaseKeyProvider {
  private rtcSession?: MatrixRTCSession;

  constructor() {
    super({ ratchetWindowSize: 10, keyringSize: 256 });
  }

  setRtcSession(rtcSession: MatrixRTCSession): void {
    this.rtcSession?.off(
      MatrixRTCSessionEvent.EncryptionKeyChanged,
      this.handleEncryptionKeyChanged
    );
    this.rtcSession = rtcSession;
    this.rtcSession.on(MatrixRTCSessionEvent.EncryptionKeyChanged, this.handleEncryptionKeyChanged);
    this.rtcSession.reemitEncryptionKeys();
  }

  clearRtcSession(): void {
    this.rtcSession?.off(
      MatrixRTCSessionEvent.EncryptionKeyChanged,
      this.handleEncryptionKeyChanged
    );
    this.rtcSession = undefined;
  }

  private handleEncryptionKeyChanged = async (
    key: Uint8Array,
    encryptionKeyIndex: number,
    membership: CallMembershipIdentityParts,
    rtcBackendIdentity: string
  ): Promise<void> => {
    const keyMaterial = await createKeyMaterialFromBuffer(key.slice().buffer);
    this.onSetEncryptionKey(keyMaterial, rtcBackendIdentity, encryptionKeyIndex);
  };
}
