import { motion } from "framer-motion";
import { getScoreLabel } from "@/lib/scoring";

interface ScoreRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
}

const ScoreRing = ({ score, maxScore = 100, size = 180, label }: ScoreRingProps) => {
  const pct = score / maxScore;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  const strokeColor = pct >= 0.7
    ? "hsl(114, 52%, 37%)"
    : pct >= 0.4
    ? "hsl(46, 100%, 42%)"
    : "hsl(6, 63%, 46%)";

  const textClass = pct >= 0.7 ? "text-success" : pct >= 0.4 ? "text-warning" : "text-destructive";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeOpacity="0.5" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-[40px] font-extrabold leading-none ${textClass}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {score}
          </motion.span>
          <span className="text-[12px] text-muted-foreground/50 mt-1 font-semibold">of {maxScore}</span>
        </div>
      </div>
      <span className={`text-[13px] font-extrabold uppercase tracking-[0.1em] ${textClass}`}>{getScoreLabel(score)}</span>
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
    </div>
  );
};

export default ScoreRing;
