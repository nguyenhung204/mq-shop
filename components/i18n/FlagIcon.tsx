import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/types";

function FlagFrame({
  children,
  size = "sm",
}: {
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[2px] border border-black/10 shadow-sm ${
        size === "md" ? "w-8 h-5" : "w-5 h-3.5"
      }`}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function FlagIcon({ locale, size = "sm" }: { locale: Locale; size?: "sm" | "md" }) {
  if (locale === "vi") {
    return (
      <FlagFrame size={size}>
        <svg viewBox="0 0 30 20" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <rect width="30" height="20" fill="#DA251D" />
          <polygon
            fill="#FFCD00"
            points="15,4 16.76,9.24 22.43,9.24 17.83,12.58 19.59,17.82 15,14.48 10.41,17.82 12.17,12.58 7.57,9.24 13.24,9.24"
          />
        </svg>
      </FlagFrame>
    );
  }

  if (locale === "zh-TW") {
    return (
      <FlagFrame size={size}>
        <svg viewBox="0 0 30 20" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <rect width="30" height="20" fill="#FE0000" />
          <rect width="15" height="10" fill="#000095" />
          <circle cx="7.5" cy="5" r="2.2" fill="#fff" />
          <g fill="#000095">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const cx = 7.5 + Math.cos(angle) * 3.4;
              const cy = 5 + Math.sin(angle) * 3.4;
              return <circle key={i} cx={cx} cy={cy} r="0.55" />;
            })}
          </g>
        </svg>
      </FlagFrame>
    );
  }

  return (
    <FlagFrame>
      <svg viewBox="0 0 30 20" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="8" fill="#B22234" />
        <rect y="8" width="30" height="4" fill="#fff" />
        <rect y="12" width="30" height="4" fill="#B22234" />
        <rect y="16" width="30" height="4" fill="#fff" />
        <rect width="12" height="10.67" fill="#3C3B6E" />
        {[
          [1.2, 1.2], [3.6, 1.2], [6, 1.2], [8.4, 1.2], [10.8, 1.2],
          [2.4, 2.6], [4.8, 2.6], [7.2, 2.6], [9.6, 2.6],
          [1.2, 4], [3.6, 4], [6, 4], [8.4, 4], [10.8, 4],
          [2.4, 5.4], [4.8, 5.4], [7.2, 5.4], [9.6, 5.4],
          [1.2, 6.8], [3.6, 6.8], [6, 6.8], [8.4, 6.8], [10.8, 6.8],
          [2.4, 8.2], [4.8, 8.2], [7.2, 8.2], [9.6, 8.2],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="0.45" fill="#fff" />
        ))}
      </svg>
    </FlagFrame>
  );
}
