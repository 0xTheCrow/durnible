import { useEffect, useMemo } from 'react';

const OBJECT_URL_PROTOCOL = 'blob:';

export const useRevokeObjectURL = (url?: string): void => {
  useEffect(
    () => () => {
      if (url?.startsWith(OBJECT_URL_PROTOCOL)) URL.revokeObjectURL(url);
    },
    [url]
  );
};

export const useObjectURL = (object?: Blob): string | undefined => {
  const url = useMemo(() => {
    if (object) return URL.createObjectURL(object);
    return undefined;
  }, [object]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  return url;
};
