// Product360Viewer.tsx - Interactive 360° product viewer
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Play, Pause, Maximize2, X, Hand } from 'lucide-react';

interface Product360ViewerProps {
  // Array of image URLs for different angles (ideally 8-36 images)
  images: string[];
  // Optional: 360° video URL as alternative
  videoUrl?: string;
  // Product name for alt text
  productName: string;
  // Optional: Auto-rotate on load
  autoRotate?: boolean;
  // Optional: Auto-rotate speed (ms per frame)
  autoRotateSpeed?: number;
  // Optional: Custom size
  size?: 'sm' | 'md' | 'lg' | 'full';
  // Optional: Show controls
  showControls?: boolean;
  // Optional: Enable fullscreen
  enableFullscreen?: boolean;
  // Optional: Callback when image changes
  onImageChange?: (index: number) => void;
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
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const totalFrames = images.length;
  
  // Size classes
  const sizeClasses = {
    sm: 'w-48 h-48 md:w-64 md:h-64',
    md: 'w-64 h-64 md:w-96 md:h-96',
    lg: 'w-80 h-80 md:w-[500px] md:h-[500px]',
    full: 'w-full h-full max-w-2xl max-h-2xl',
  };

  // Preload images
  useEffect(() => {
    if (images.length === 0) return;
    
    const preloadImage = (index: number) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImages(prev => new Set([...prev, index]));
        if (index === 0) setIsLoading(false);
      };
      img.src = images[index];
    };

    // Preload first image immediately
    preloadImage(0);
    
    // Preload rest in background
    images.forEach((_, index) => {
      if (index !== 0) {
        setTimeout(() => preloadImage(index), index * 50);
      }
    });
  }, [images]);

  // Auto-rotate effect
  useEffect(() => {
    if (isAutoRotating && !isDragging && !showVideo) {
      autoRotateRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % totalFrames);
      }, autoRotateSpeed);
    }

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [isAutoRotating, isDragging, showVideo, totalFrames, autoRotateSpeed]);

  // Notify parent of image change
  useEffect(() => {
    onImageChange?.(currentIndex);
  }, [currentIndex, onImageChange]);

  // Handle drag start
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    startXRef.current = clientX;
    lastIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Handle drag move
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = clientX - startXRef.current;
    const sensitivity = containerWidth / totalFrames;
    const indexChange = Math.round(deltaX / sensitivity);
    
    let newIndex = (lastIndexRef.current - indexChange) % totalFrames;
    if (newIndex < 0) newIndex += totalFrames;
    
    setCurrentIndex(newIndex);
  }, [isDragging, totalFrames]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
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

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Toggle auto-rotate
  const toggleAutoRotate = () => {
    setIsAutoRotating(prev => !prev);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Reset rotation
  const resetRotation = () => {
    setCurrentIndex(0);
    setIsAutoRotating(false);
  };

  // Render loading state
  if (isLoading && images.length > 0) {
    return (
      <div className={`${sizeClasses[size]} flex items-center justify-center bg-zinc-900/50 rounded-xl`}>
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
          />
          <span className="text-sm text-zinc-400">Loading 360° view...</span>
        </div>
      </div>
    );
  }

  // Render video player if showing video
  if (showVideo && videoUrl) {
    return (
      <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className={`${isFullscreen ? 'w-full h-full object-contain' : sizeClasses[size]} rounded-xl`}
        />
        {showControls && (
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  // Main 360° viewer
  const viewerContent = (
    <div
      ref={containerRef}
      className={`relative ${isFullscreen ? 'w-full h-full' : sizeClasses[size]} select-none`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Drag Instruction Overlay */}
      <AnimatePresence>
        {!isDragging && loadedImages.size === totalFrames && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          >
            <motion.div
              animate={{ x: [-20, 20, -20] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white/80 text-sm"
            >
              <Hand className="w-4 h-4" />
              <span>Drag to rotate</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Images */}
      <div className="relative w-full h-full flex items-center justify-center">
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={`${productName} - angle ${index + 1}`}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-75 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
            draggable={false}
          />
        ))}
      </div>

      {/* Progress Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1">
        {Array.from({ length: Math.min(totalFrames, 12) }).map((_, i) => {
          const frameIndex = Math.floor((i / Math.min(totalFrames, 12)) * totalFrames);
          const isActive = Math.abs(currentIndex - frameIndex) < totalFrames / 24;
          return (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                isActive ? 'w-3 bg-white' : 'w-1.5 bg-white/30'
              }`}
            />
          );
        })}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex gap-2">
          {/* Auto-rotate toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAutoRotate();
            }}
            className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
              isAutoRotating 
                ? 'bg-white text-black' 
                : 'bg-black/50 text-white hover:bg-black/70'
            }`}
            title={isAutoRotating ? 'Stop rotation' : 'Auto rotate'}
          >
            {isAutoRotating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Reset rotation */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetRotation();
            }}
            className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
            title="Reset rotation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Fullscreen toggle */}
          {enableFullscreen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
              title="Fullscreen"
            >
              {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Video toggle (if video available) */}
          {videoUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVideo(true);
              }}
              className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
              title="Play 360° video"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Frame counter (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 right-4 text-xs text-white/50 bg-black/50 px-2 py-1 rounded">
          {currentIndex + 1}/{totalFrames}
        </div>
      )}
    </div>
  );

  // Fullscreen wrapper
  if (isFullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        {viewerContent}
      </motion.div>
    );
  }

  return viewerContent;
}

// Helper component for single image fallback
export function Product360ViewerFallback({
  image,
  productName,
  size = 'md',
}: {
  image: string;
  productName: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}) {
  const sizeClasses = {
    sm: 'w-48 h-48 md:w-64 md:h-64',
    md: 'w-64 h-64 md:w-96 md:h-96',
    lg: 'w-80 h-80 md:w-[500px] md:h-[500px]',
    full: 'w-full h-full max-w-2xl max-h-2xl',
  };

  return (
    <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
      <img
        src={image}
        alt={productName}
        className="w-full h-full object-contain"
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50 bg-black/50 px-3 py-1 rounded-full">
        360° view coming soon
      </div>
    </div>
  );
}

export default Product360Viewer;
