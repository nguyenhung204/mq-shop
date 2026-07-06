import {
  BarChart2,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  type LucideIcon,
} from "lucide-react";

export const iconProps = {
  size: 18,
  strokeWidth: 1.5,
} as const;

export const iconPropsLg = {
  size: 40,
  strokeWidth: 1.5,
} as const;

export type { LucideIcon };
export { BarChart2, Check, ChevronLeft, ChevronRight, Eye, Heart };
