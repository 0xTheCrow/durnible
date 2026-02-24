import { useEffect, useState } from 'react';
import { useSpecVersions } from './useSpecVersions';

export const useMediaAuthentication = (): boolean => {
  const { versions, unstable_features: unstableFeatures } = useSpecVersions();

  // Media authentication is introduced in spec version 1.11
  const serverSupportsAuthMedia =
    unstableFeatures?.['org.matrix.msc3916.stable'] || versions.includes('v1.11');

  // Authenticated media URLs require the service worker to inject the Authorization header.
  // On the very first page load (before the SW has installed and claimed the page),
  // navigator.serviceWorker.controller is null, so we must not use auth URLs yet.
  // Once the SW activates and claims the page, controllerchange fires and we switch over.
  const [swReady, setSwReady] = useState<boolean>(() => {
    if (!('serviceWorker' in navigator)) return true;
    return !!navigator.serviceWorker.controller;
  });

  useEffect(() => {
    if (swReady) return;
    const handler = () => {
      if (navigator.serviceWorker.controller) setSwReady(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
  }, [swReady]);

  return serverSupportsAuthMedia && swReady;
};
