import Link from "next/link";
import { topBarLinks } from "@/lib/data/navigation";

export function TopBar() {
  return (
    <div className="bg-black text-white text-sm h-10 flex items-center">
      <div className="mq-container flex items-center justify-between w-full">
        <p className="hidden sm:block text-xs md:text-sm">
          Free shipping on orders over $75 — Shop the MQ Collection
        </p>
        <p className="sm:hidden text-xs">Free shipping over $75</p>
        <nav className="flex items-center gap-4 md:gap-6">
          {topBarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs md:text-sm hover:text-white/70 transition-colors whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
