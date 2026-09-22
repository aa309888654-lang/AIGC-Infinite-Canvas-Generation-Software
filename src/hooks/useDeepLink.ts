import { useEffect } from 'react';

export interface DeepLinkPayload {
  urls: string[];
}

const isTauriEnv = typeof window !== 'undefined' && '__TAURI__' in window;

export function useDeepLink(onDeepLink: (urls: string[]) => void) {
  useEffect(() => {
    if (!isTauriEnv) {
      return;
    }

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<DeepLinkPayload>('deep-link', (event) => {
          // console.log('Deep link received:', event.payload);
          if (event.payload.urls && event.payload.urls.length > 0) {
            onDeepLink(event.payload.urls);
          }
        });
        // console.log('Deep link listener registered successfully');
      } catch (error) {
        console.warn('Failed to register deep link listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
        // console.log('Deep link listener unregistered');
      }
    };
  }, [onDeepLink]);
}
