import type { ReactNode } from "react";
import type { GateRegionId } from "@/lib/i18n/regions";

function CircleFrame({ children }: { children: ReactNode }) {
  return (
    <span
      className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.18)] ring-2 ring-white"
      aria-hidden
    >
      {children}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/35 via-transparent to-black/10" />
    </span>
  );
}

export function RegionFlag({ regionId }: { regionId: GateRegionId }) {
  if (regionId === "vn") {
    return (
      <CircleFrame>
        <svg viewBox="0 0 64 64" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <rect width="64" height="64" fill="#DA251D" />
          <polygon
            fill="#FFCD00"
            points="32,16 35.5,26.5 46.5,26.5 37.5,33.2 41,43.5 32,36.8 23,43.5 26.5,33.2 17.5,26.5 28.5,26.5"
          />
        </svg>
      </CircleFrame>
    );
  }

  if (regionId === "tw") {
    return (
      <CircleFrame>
        <svg viewBox="0 0 64 64" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <rect width="64" height="64" fill="#FE0000" />
          <rect width="32" height="32" fill="#000095" />
          <circle cx="16" cy="16" r="5.5" fill="#fff" />
          <g fill="#000095">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const cx = 16 + Math.cos(angle) * 8.5;
              const cy = 16 + Math.sin(angle) * 8.5;
              return <circle key={i} cx={cx} cy={cy} r="1.3" />;
            })}
          </g>
        </svg>
      </CircleFrame>
    );
  }

  if (regionId === "my") {
    return (
      <CircleFrame>
        <svg viewBox="0 0 64 64" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 7 }).map((_, i) => (
            <rect
              key={i}
              y={i * (64 / 14)}
              width="64"
              height={64 / 14}
              fill={i % 2 === 0 ? "#CC0001" : "#fff"}
            />
          ))}
          <rect width="32" height={(64 / 14) * 8} fill="#010066" />
          <circle cx="14" cy="14.5" r="7" fill="#FFCC00" />
          <circle cx="16.5" cy="14.5" r="6" fill="#010066" />
          <polygon
            fill="#FFCC00"
            points="22,14.5 23.5,18.5 27.5,18.5 24.3,20.9 25.5,24.8 22,22.3 18.5,24.8 19.7,20.9 16.5,18.5 20.5,18.5"
          />
        </svg>
      </CircleFrame>
    );
  }

  if (regionId === "us") {
    return (
      <CircleFrame>
        <svg viewBox="0 0 64 64" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <rect width="64" height="64" fill="#B22234" />
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={i} y={(i * 2 + 1) * (64 / 13)} width="64" height={64 / 13} fill="#fff" />
          ))}
          <rect width="28" height="28" fill="#3C3B6E" />
          {Array.from({ length: 9 }).map((_, i) => (
            <circle
              key={i}
              cx={4 + (i % 3) * 8}
              cy={4 + Math.floor(i / 3) * 6}
              r="1.2"
              fill="#fff"
            />
          ))}
        </svg>
      </CircleFrame>
    );
  }

  // Singapore / fallback
  return (
    <CircleFrame>
      <svg viewBox="0 0 64 64" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width="64" height="32" fill="#ED2939" />
        <rect y="32" width="64" height="32" fill="#fff" />
        <circle cx="18" cy="16" r="9" fill="#fff" />
        <circle cx="21.5" cy="16" r="8" fill="#ED2939" />
        <g fill="#fff">
          {[0, 72, 144, 216, 288].map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            const cx = 30 + Math.cos(a) * 6;
            const cy = 16 + Math.sin(a) * 6;
            return (
              <polygon
                key={deg}
                points={`${cx},${cy - 2.2} ${cx + 0.6},${cy - 0.6} ${cx + 2.3},${cy - 0.6} ${cx + 0.95},${cy + 0.4} ${cx + 1.5},${cy + 2} ${cx},${cy + 1} ${cx - 1.5},${cy + 2} ${cx - 0.95},${cy + 0.4} ${cx - 2.3},${cy - 0.6} ${cx - 0.6},${cy - 0.6}`}
              />
            );
          })}
        </g>
      </svg>
    </CircleFrame>
  );
}
