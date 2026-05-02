import { useState, useEffect, useRef, useMemo } from 'react';
import type { CaseVolume } from '@/types';

interface CacheProgress {
  loaded: number;
  total: number;
}

interface ImageCacheResult {
  getCachedUrl: (originalUrl: string) => string;
  isReady: boolean;
  progress: CacheProgress;
}

/**
 * Preloads all images from a case's volumes into blob URLs held in memory.
 * While loading: getCachedUrl falls back to the original URL (image still visible).
 * Once a blob is ready: getCachedUrl returns the in-memory blob URL (instant on next render).
 * On unmount (case exit): all blob URLs are revoked and memory freed.
 */
export function useImageCache(volumes: CaseVolume[], legacyUrl?: string): ImageCacheResult {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [progress, setProgress] = useState<CacheProgress>({ loaded: 0, total: 0 });
  const [isReady, setIsReady] = useState(false);

  // Stable key — only changes when the actual URLs change (new case loaded)
  const urlsKey = useMemo(() => {
    const urls = volumes.flatMap(v => v.slices.map(s => s.image_url));
    if (legacyUrl) urls.push(legacyUrl);
    return urls.filter(Boolean).join('|');
  }, [volumes, legacyUrl]);

  useEffect(() => {
    const uniqueUrls = urlsKey ? [...new Set(urlsKey.split('|'))] : [];

    if (uniqueUrls.length === 0) {
      setIsReady(true);
      return;
    }

    setProgress({ loaded: 0, total: uniqueUrls.length });
    setIsReady(false);

    let cancelled = false;
    const blobsCreated: string[] = [];
    let loadedCount = 0;

    const markOne = () => {
      loadedCount++;
      // setProgress triggers a re-render so getCachedUrl will read the updated cacheRef
      setProgress(p => ({ ...p, loaded: loadedCount }));
      if (loadedCount === uniqueUrls.length) setIsReady(true);
    };

    uniqueUrls.forEach(url => {
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then(blob => {
          if (cancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          blobsCreated.push(blobUrl);
          cacheRef.current.set(url, blobUrl);
          markOne();
        })
        .catch(() => {
          // On failure: don't store anything, getCachedUrl falls back to original URL
          if (!cancelled) markOne();
        });
    });

    return () => {
      cancelled = true;
      blobsCreated.forEach(u => URL.revokeObjectURL(u));
      cacheRef.current.clear();
      setIsReady(false);
      setProgress({ loaded: 0, total: 0 });
    };
  }, [urlsKey]);

  // Reads from ref — always current without needing to be a useCallback
  const getCachedUrl = (url: string): string => cacheRef.current.get(url) ?? url;

  return { getCachedUrl, isReady, progress };
}
