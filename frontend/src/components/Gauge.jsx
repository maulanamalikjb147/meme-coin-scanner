import React from "react";

/**
 * Circular gauge indicator (SVG).
 * value: 0-100
 * color: hex
 */
export const Gauge = ({ value = 0, label = "", color = "#00ff66", size = 120, testId }) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2" data-testid={testId}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <filter id={`glow-${testId}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="6"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            filter={`url(#glow-${testId})`}
            style={{ transition: "stroke-dashoffset 800ms cubic-bezier(.2,.8,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="font-mono font-bold text-2xl tabular-nums" style={{ color }}>
            {Math.round(v)}
          </span>
          <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">{label}</div>
    </div>
  );
};
