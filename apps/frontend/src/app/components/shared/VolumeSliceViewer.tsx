import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { CaseVolume } from '@/types';
import { useImageCache } from '@/api/useImageCache';
import styles from '@/styles/VolumeSliceViewer.module.css';

interface VolumeSliceViewerProps {
  images: CaseVolume[];
  legacyUrl?: string;
  zoom: number;
  imgClassName?: string;
}

export function VolumeSliceViewer({ images, legacyUrl, zoom, imgClassName }: VolumeSliceViewerProps) {
  const [activeVolumeIdx, setActiveVolumeIdx] = useState(0);
  const [activeSliceIdx, setActiveSliceIdx] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const volumes = images ?? [];
  const currentVolume = volumes[activeVolumeIdx];
  const totalSlices = currentVolume?.slices?.length ?? 1;
  const currentUrl = currentVolume?.slices?.[activeSliceIdx]?.image_url ?? legacyUrl ?? '';

  // Image cache — preloads all slices as blob URLs, releases on unmount
  const { getCachedUrl, isReady, progress } = useImageCache(volumes, legacyUrl);
  const showCacheBar = progress.total > 1 && !isReady;

  // Reset slice index when volume changes
  useEffect(() => { setActiveSliceIdx(0); }, [activeVolumeIdx]);

  // Hide scroll hint after 3 seconds
  useEffect(() => {
    if (totalSlices <= 1) return;
    const t = setTimeout(() => setShowScrollHint(false), 3000);
    return () => clearTimeout(t);
  }, [totalSlices]);

  // Show scroll hint again when slice count changes (new case loaded)
  useEffect(() => {
    if (totalSlices > 1) setShowScrollHint(true);
  }, [totalSlices]);

  // Scroll-wheel navigation with passive: false for preventDefault
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (totalSlices <= 1) return;
      e.preventDefault();
      setActiveSliceIdx(prev =>
        e.deltaY > 0 ? Math.min(prev + 1, totalSlices - 1) : Math.max(prev - 1, 0)
      );
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [totalSlices]);

  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      {/* Volume tabs — only when multiple volumes */}
      {volumes.length > 1 && (
        <div className={styles.volumeTabBar}>
          {volumes.map((vol, i) => (
            <button
              key={i}
              onClick={() => setActiveVolumeIdx(i)}
              className={`${styles.volumeTab} ${i === activeVolumeIdx ? styles.volumeTabActive : ''}`}
            >
              {vol.volume_name}
            </button>
          ))}
        </div>
      )}

      {/* Medical image — uses blob URL once cached, falls back to original while loading */}
      {currentUrl && (
        <img
          src={getCachedUrl(currentUrl)}
          alt="Medical Image"
          className={imgClassName}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
        />
      )}

      {/* Cache preload progress bar — disappears once all images are in memory */}
      <AnimatePresence>
        {showCacheBar && (
          <motion.div
            className={styles.cacheProgress}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className={styles.cacheProgressLabel}>
              Cache {progress.loaded}/{progress.total}
            </span>
            <div className={styles.cacheProgressTrack}>
              <div
                className={styles.cacheProgressFill}
                style={{ width: `${pct}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slice counter badge — only when multiple slices */}
      {totalSlices > 1 && (
        <div className={styles.sliceBadge}>
          Lát cắt {activeSliceIdx + 1} / {totalSlices}
        </div>
      )}

      {/* Scroll hint — fades out after 3s */}
      <AnimatePresence>
        {totalSlices > 1 && showScrollHint && (
          <motion.div
            className={styles.scrollHint}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            Cuộn chuột để chuyển lát cắt
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
