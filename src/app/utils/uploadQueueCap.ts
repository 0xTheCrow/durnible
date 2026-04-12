/**
 * Maximum number of files that can be queued in the upload board for a
 * single send. Mirrors `IMAGE_GROUP_MAX_SIZE` used by the timeline so that
 * a single send never produces a partial image grid (3 wide x 2 tall).
 */
export const MAX_UPLOAD_QUEUE_SIZE = 6;

/**
 * Caps an incoming batch of files against the remaining capacity of the
 * upload queue. Returns the slice of `incoming` that fits, in the original
 * order. Files past the cap are dropped — the upload board UI surfaces the
 * cap visually so dropping is silent by design.
 *
 * Pure function, no React/state dependencies — safe to call from any code
 * path that adds files (file picker, paste handler, drag-and-drop, voice).
 */
export const applyUploadQueueCap = <T>(
  currentCount: number,
  incoming: T[],
  max: number = MAX_UPLOAD_QUEUE_SIZE
): T[] => {
  const remaining = Math.max(0, max - currentCount);
  if (remaining === 0) return [];
  return incoming.slice(0, remaining);
};
