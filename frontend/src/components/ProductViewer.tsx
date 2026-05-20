//ProductViewer.tsx
import { useState, useRef } from 'react';
import { motion } from "framer-motion"
import { useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, MousePointerClick } from 'lucide-react';
// Removed Button import
// Removed ImageWithFallback import

interface Shoe {
  id: number;
  name: string;
  price: string;
  image: string;
  description: string;
}

interface ProductViewerProps {
  shoe: Shoe;
  onNext: () => void;
  onPrevious: () => void;
  currentIndex: number;
  totalItems: number;
}

export function ProductViewer({ shoe, onNext, onPrevious, currentIndex, totalItems }: ProductViewerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef(null);
  
  const x = useMotionValue(0);
  const rotateY = useTransform(x, [-200, 200], [-45, 45]);

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 flex flex-col items-center justify-center">
      {/* Drag Instruction */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 md:top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-zinc-400 bg-zinc-800/50 backdrop-blur-sm px-4 py-2 rounded-full"
      >
        <MousePointerClick className="w-4 h-4" />
        <span className="text-sm">Drag to Rotate</span>
      </motion.div>

      {/* Navigation Buttons */}
      <button
        onClick={onPrevious}
        className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 z-10 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95"
        aria-label="Previous shoe"
      >
        <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
      </button>

      <button
        onClick={onNext}
        className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 z-10 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95"
        aria-label="Next shoe"
      >
        <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
      </button>

      {/* Product Display */}
      <div className="flex flex-col items-center gap-8 md:gap-12">
        {/* 3D Product Container */}
        <div 
          ref={constraintsRef}
          className="relative w-full max-w-2xl aspect-square flex items-center justify-center"
          style={{ perspective: '1000px' }}
        >
          {/* Floating Glow Effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-64 h-64 md:w-96 md:h-96 bg-gradient-radial from-blue-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl"
            />
          </div>

          {/* Draggable Product */}
          <motion.div
            key={shoe.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => {
              setIsDragging(false);
              x.set(0);
            }}
            style={{
              x,
              rotateY,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: [0, -15, 0],
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              y: {
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              },
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 }
            }}
            className="relative z-10"
          >
            <div className="relative drop-shadow-2xl">
              {/* Replaced ImageWithFallback with plain img */}
              <img
                src={shoe.image}
                alt={shoe.name}
                className="w-64 h-64 md:w-96 md:h-96 object-contain select-none pointer-events-none"
                draggable={false}
              />
              {/* Reflection Effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent rounded-lg" />
            </div>
          </motion.div>

          {/* Shadow */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-0 w-48 h-8 md:w-72 md:h-12 bg-black/40 rounded-full blur-xl"
          />
        </div>

        {/* Product Info */}
        <motion.div
          key={`info-${shoe.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center space-y-4 md:space-y-6"
        >
          <div className="space-y-2">
            <h2 className="text-white text-3xl md:text-4xl tracking-tight">{shoe.name}</h2>
            <p className="text-zinc-400">{shoe.description}</p>
          </div>

          <div className="text-2xl md:text-3xl text-white">
            {shoe.price}
          </div>

          {/* Replaced Button with standard button element */}
          <button
            style={{ backgroundColor: 'white', color: 'black', padding: '1rem 2.5rem', borderRadius: 9999, fontSize: '1.125rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            className="bg-white text-black hover:bg-zinc-200 px-8 md:px-12 py-6 rounded-full transition-all hover:scale-105 active:scale-95"
          >
            Buy Now
          </button>
        </motion.div>

        {/* Progress Indicator */}
        <div className="flex gap-2">
          {Array.from({ length: totalItems }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex 
                  ? 'w-8 bg-white' 
                  : 'w-1.5 bg-zinc-600 hover:bg-zinc-500'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
