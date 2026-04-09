import { MatrixClient } from 'matrix-js-sdk';
import { useCallback, useEffect, useRef } from 'react';
import { TYPING_TIMEOUT_MS } from '../state/typingMembers';

type TypingStatusUpdater = (typing: boolean) => void;

export const useTypingStatusUpdater = (mx: MatrixClient, roomId: string): TypingStatusUpdater => {
  const statusSentTsRef = useRef<number>(0);
  // Hold the latest mx/roomId in refs so the stable callback below can read
  // them at call time. The actual mx.sendTyping(...) calls are currently
  // commented out, but the refs are the canonical access point so re-enabling
  // typing later is a one-line uncomment per call site.
  const mxRef = useRef(mx);
  const roomIdRef = useRef(roomId);

  // Sync the refs whenever the room (or client) changes, and reset the
  // throttle so a stale "still typing" timer from a previous room doesn't
  // suppress the next send.
  useEffect(() => {
    mxRef.current = mx;
    roomIdRef.current = roomId;
    statusSentTsRef.current = 0;
  }, [mx, roomId]);

  const sendTypingStatus = useCallback<TypingStatusUpdater>((typing) => {
    if (typing) {
      if (Date.now() - statusSentTsRef.current < TYPING_TIMEOUT_MS) {
        return;
      }

      // mxRef.current.sendTyping(roomIdRef.current, true, TYPING_TIMEOUT_MS);
      const sentTs = Date.now();
      statusSentTsRef.current = sentTs;

      // Don't believe server will timeout typing status;
      // Clear typing status after timeout if already not;
      setTimeout(() => {
        if (statusSentTsRef.current === sentTs) {
          // mxRef.current.sendTyping(roomIdRef.current, false, TYPING_TIMEOUT_MS);
          statusSentTsRef.current = 0;
        }
      }, TYPING_TIMEOUT_MS);
      return;
    }

    if (Date.now() - statusSentTsRef.current < TYPING_TIMEOUT_MS) {
      // mxRef.current.sendTyping(roomIdRef.current, false, TYPING_TIMEOUT_MS);
    }
    statusSentTsRef.current = 0;
  }, []);

  return sendTypingStatus;
};
