import React from "react";
import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import { useCountUp } from "@/hooks/useCountUp";

interface Props {
  score: number;
  label: string;
  colorClass: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const AnimatedScoreRing = React.forwardRef<HTMLDivElement, Props>(
  ({ score, label, colorClass }, forwardedRef) => {
    const [inViewRef, inView] = useInView<HTMLDivElement>(0.4);
    const displayValue = useCountUp(score, inView, 1100);
    const strokeOffset = CIRCUMFERENCE - (CIRCUMFERENCE * (inView ? score : 0)) / 100;

    return (
      <div
        ref={(node) => {
          (inViewRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className="col-span-2 lg:col-span-1 flex flex-col items-center justify-center py-4"
      >
        <div className="relative">
          <svg className="h-24 w-24" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity="0.3" />
            <motion.circle
              cx="50" cy="50" r={RADIUS} fill="none"
              stroke="hsl(var(--primary))" strokeWidth="6"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              initial={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: strokeOffset }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[24px] font-extrabold ${colorClass}`}>{displayValue}</span>
            <span className="text-[9px] text-muted-foreground/50 font-semibold">of 100</span>
          </div>
        </div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mt-2 ${colorClass}`}>{label}</p>
      </div>
    );
  }
);

AnimatedScoreRing.displayName = "AnimatedScoreRing";
