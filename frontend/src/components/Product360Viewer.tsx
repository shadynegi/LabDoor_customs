// Product360Viewer.tsx - Interactive 360° product viewer
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Play, Pause, Maximize2, X, Hand } from 'lucide-react';
import { optimizeImageUrl } from '../utils/imageUrl';

interface Product360ViewerProps {
  images: string[];
  videoUrl?: string;
  productName: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showControls?: boolean;
  enableFullscreen?: boolean;
  onImageChange?: (index: number) => void;
}

function rootClass(size: 'sm' | 'md' | 'lg' | 'full', fullscreen: boolean): string {
  if (fullscreen) return 'p360-root p360-root--full';
  if (size === 'full') return 'p360-root p360-root--full';
  return 'p360-root p360-root--md';
}

export function Product360Viewer({
  images,
  videoUrl,
  productName,
  autoRotate = false,
  autoRotateSpeed = 100,
  size = 'md',
  showControls = true,
  enableFullscreen = true,
  onImageChange,
}: Product360ViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const lastIndexRef = useRef(0);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalFrames = images.length;
  const isStaticPlaceholder =
    totalFrames > 1 && images.every((img) => img === images[0]);

  useEffect(() => {
    if (images.length === 0) return;

    const preloadImage = (index: number) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImages((prev) => new Set([...prev, index]));
        if (index === 0) setIsLoading(false);
      };
      img.src = images[index];
    };

    preloadImage(0);
    images.forEach((_, index) => {
      if (index !== 0) {
        setTimeout(() => preloadImage(index), index * 50);
      }
    });
  }, [images]);

  useEffect(() => {
    if (isAutoRotating && !isDragging && !showVideo) {
      autoRotateRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % totalFrames);
      }, autoRotateSpeed);
    }

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [isAutoRotating, isDragging, showVideo, totalFrames, autoRotateSpeed]);

  useEffect(() => {
    onImageChange?.(currentIndex);
  }, [currentIndex, onImageChange]);

  const handleDragStart = useCallback(
    (clientX: number) => {
      setIsDragging(true);
      setIsAutoRotating(false);
      startXRef.current = clientX;
      lastIndexRef.current = currentIndex;
    },
    [currentIndex]
  );

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = clientX - startXRef.current;
      const sensitivity = containerWidth / totalFrames;
      const indexChange = Math.round(deltaX / sensitivity);

      let newIndex = (lastIndexRef.current - indexChange) % totalFrames;
      if (newIndex < 0) newIndex += totalFrames;

      setCurrentIndex(newIndex);
    },
    [isDragging, totalFrames]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) handleDragEnd();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  const toggleAutoRotate = () => {
    setIsAutoRotating((prev) => !prev);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const resetRotation = () => {
    setCurrentIndex(0);
    setIsAutoRotating(false);
  };

  if (isLoading && images.length > 0) {
    return (
      <div className={`${rootClass(size, false)} p360-surface flex-center`}>
        <div className="flex-center" style={{ flexDirection: 'column', gap: 12 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="p360-spinner"
          />
          <span style={{ fontSize: 14, color: '#a1a1aa' }}>Loading 360° view...</span>
        </div>
      </div>
    );
  }

  if (showVideo && videoUrl) {
    return (
      <div className={isFullscreen ? 'p360-fullscreen' : 'relative'}>
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className={isFullscreen ? '' : rootClass(size, false)}
          style={
            isFullscreen
              ? { width: '100%', height: '100%', objectFit: 'contain' }
              : { width: '100%', height: '100%', borderRadius: 12, objectFit: 'contain' }
          }
        />
        {showControls && (
          <button
            type="button"
            onClick={() => setShowVideo(false)}
            className="p360-btn"
            style={{ position: 'absolute', top: 16, right: 16 }}
            aria-label="Close video"
          >
            <X size={20} />
          </button>
        )}
      </div>
    );
  }

  if (isStaticPlaceholder && images[0]) {
    return (
      <div className={`${rootClass(size, false)} p360-surface flex-center`}>
        <img
          src={optimizeImageUrl(images[0], { width: 720 })}
          alt={productName}
          width={720}
          height={720}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          draggable={false}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            padding: '6px 12px',
            borderRadius: 999,
            color: 'rgba(255,255,255,0.85)',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
        >
          Product photo — 360° view coming soon
        </div>
      </div>
    );
  }

  const viewerContent = (
    <div
      ref={containerRef}
      className={`${rootClass(size, isFullscreen)} ${isFullscreen ? '' : 'p360-surface'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <AnimatePresence>
        {!isDragging && loadedImages.size === totalFrames && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p360-hint"
          >
            <motion.div
              animate={{ x: [-20, 20, -20] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="p360-hint-pill"
            >
              <Hand size={16} />
              <span>Drag to rotate</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute-fill flex-center">
        {images.map((src, index) => (
          <img
            key={index}
            src={optimizeImageUrl(src, { width: 720 })}
            alt={`${productName} - angle ${index + 1}`}
            width={720}
            height={720}
            loading={index === currentIndex ? 'eager' : 'lazy'}
            decoding="async"
            className={`p360-img ${index === currentIndex ? 'p360-img--visible' : 'p360-img--hidden'}`}
            draggable={false}
          />
        ))}
      </div>

      <div className="p360-dots">
        {Array.from({ length: Math.min(totalFrames, 12) }).map((_, i) => {
          const frameIndex = Math.floor((i / Math.min(totalFrames, 12)) * totalFrames);
          const isActive = Math.abs(currentIndex - frameIndex) < totalFrames / 24;
          return (
            <div
              key={i}
              className={`p360-dot ${isActive ? 'p360-dot--active' : ''}`}
            />
          );
        })}
      </div>

      {showControls && (
        <div className="p360-controls">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleAutoRotate();
            }}
            className={`p360-btn ${isAutoRotating ? 'p360-btn--active' : ''}`}
            title={isAutoRotating ? 'Stop rotation' : 'Auto rotate'}
            aria-label={isAutoRotating ? 'Stop rotation' : 'Auto rotate'}
          >
            {isAutoRotating ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetRotation();
            }}
            className="p360-btn"
            title="Reset rotation"
            aria-label="Reset rotation"
          >
            <RotateCcw size={16} />
          </button>

          {enableFullscreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p360-btn"
              title="Fullscreen"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}
            </button>
          )}

          {videoUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideo(true);
              }}
              className="p360-btn"
              title="Play 360° video"
              aria-label="Play 360° video"
            >
              <Play size={16} />
            </button>
          )}
        </div>
      )}

      {import.meta.env.DEV && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(0,0,0,0.5)',
            padding: '4px 8px',
            borderRadius: 4,
          }}
        >
          {currentIndex + 1}/{totalFrames}
        </div>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p360-fullscreen"
      >
        {viewerContent}
      </motion.div>
    );
  }

  return viewerContent;
}

export function Product360ViewerFallback({
  image,
  productName,
  size = 'md',
}: {
  image: string;
  productName: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}) {
  return (
    <div className={`${rootClass(size, false)} flex-center`}>
      <img
        src={optimizeImageUrl(image, { width: 720 })}
        alt={productName}
        width={720}
        height={720}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 12px',
          borderRadius: 999,
        }}
      >
        360° view coming soon
      </div>
    </div>
  );
}

export default Product360Viewer;
