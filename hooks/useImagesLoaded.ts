import { useEffect, useState } from 'react';

/**
 * Preload a list of image URLs and signal when all have finished (load or error).
 * Adds a safety timeout so UI can't be blocked forever.
 * @param urls The list of image URLs to preload
 * @param timeoutMs The timeout duration in milliseconds
 * @returns An object containing the loading state and progress
 */
export function useImagesLoaded(urls: string[], timeoutMs = 6000) {
  const [loaded, setLoaded] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Initialize done state based on empty urls
    if (!urls || urls.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDone(true);
      return;
    }

    let cancelled = false;
    let finished = 0;

    const handleOne = () => {
      if (cancelled) return;

      finished += 1;
      setLoaded(finished);
      if (finished >= urls.length) setDone(true);
    };

    const controllers: AbortController[] = [];

    urls.forEach((src) => {
      if (!src) {
        handleOne();
        return;
      }

      const img = new Image();

      img.onload = handleOne;
      img.onerror = handleOne;
      img.src = src;
    });

    const timer = setTimeout(() => {
      if (!cancelled) setDone(true);
    }, timeoutMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controllers.forEach((c) => c.abort?.());
    };
  }, [urls, timeoutMs]);

  return { done, loaded, total: urls?.length || 0 };
}

export default useImagesLoaded;
