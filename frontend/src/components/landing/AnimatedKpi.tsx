import React from "react";
import { useInView } from "@/hooks/useInView";
import { useCountUp } from "@/hooks/useCountUp";

interface Props {
  label: string;
  /** For numeric KPIs like "18/40", pass numerator + denominator. For text like "$12K–$38K", pass displayValue. */
  numerator?: number;
  denominator?: number;
  displayValue?: string;
  status: string;
  colorClass: string;
}

export const AnimatedKpi = React.forwardRef<HTMLDivElement, Props>(
  ({ label, numerator, denominator, displayValue, status, colorClass }, forwardedRef) => {
    const [inViewRef, inView] = useInView<HTMLDivElement>(0.4);
    const animatedNum = useCountUp(numerator ?? 0, inView, 800);

    const value = displayValue ?? `${animatedNum}/${denominator}`;

    return (
      <div
        ref={(node) => {
          (inViewRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className="bg-muted/30 rounded-xl p-4 flex flex-col justify-center"
      >
        <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em]">{label}</p>
        <p className="text-[18px] font-extrabold text-foreground mt-1">{value}</p>
        <p className={`text-[10px] font-bold mt-0.5 ${colorClass}`}>{status}</p>
      </div>
    );
  }
);

AnimatedKpi.displayName = "AnimatedKpi";
