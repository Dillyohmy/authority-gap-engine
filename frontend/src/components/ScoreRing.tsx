import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getScoreLabel } from "@/lib/scoring";

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
}

const ScoreRing = ({ score, maxScore = 100, size = 180, label }: ScoreRingProps) => {
  const rm = useReducedMotion();
  const [displayScore, setDisplayScore] = useState(rm ? score : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rm) { setDisplayScore(score); return; }

    const startTime = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const t = elapsed / duration;
      // ease-out-cubic — fast start, smooth finish
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * score));
      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayScore(score);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [score, rm]);

  const pct = score / maxScore;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  const strokeColor =
    pct >= 0.7 ? "hsl(114, 52%, 37%)"
    : pct >= 0.4 ? "hsl(46, 100%, 42%)"
    : "hsl(6, 63%, 46%)";

  const textClass =
    pct >= 0.7 ? "text-success"
    : pct >= 0.4 ? "text-warning"
    : "text-destructive";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="8"
            strokeOpacity="0.4"
          />
          {/* Animated fill */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: rm ? strokeDashoffset : circumference }}
            animate={{ strokeDashoffset }}
            transition={rm ? { duration: 0 } : { duration: 1.2, ease: "easeOut" }}
          />
        </svg>

        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          role="text"
          aria-label={`Authority score: ${score} out of ${maxScore}`}
        >
          <span className={`text-[40px] font-extrabold leading-none tabular-nums ${textClass}`}>
            {displayScore}
          </span>
          <span className="text-[12px] text-muted-foreground/50 mt-1 font-semibold">
            of {maxScore}
          </span>
        </div>
      </div>

      <span className={`text-[13px] font-extrabold uppercase tracking-[0.1em] ${textClass}`}>
        {getScoreLabel(score)}
      </span>
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
    </div>
  );
};

export default ScoreRing;
