import Link from "next/link";
import { footerColumns } from "@/lib/data/navigation";

export function Footer() {
  return (
    <footer className="bg-mq-footer text-white mt-auto">
      <div className="mq-container py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-lg mb-5 font-normal">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/70 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4 className="text-lg mb-5 font-normal">Newsletter</h4>
            <p className="text-sm text-white/70 mb-4">
              Subscribe for exclusive offers and MQ updates.
            </p>
            <form className="flex">
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/50 rounded-l-full outline-none focus:border-white/40"
              />
              <button
                type="submit"
                className="bg-white text-black px-5 py-2.5 text-sm font-medium rounded-r-full hover:bg-white/90 transition-colors"
              >
                Subscribe
              </button>
            </form>
            <div className="flex gap-4 mt-6">
              {["Facebook", "X", "Instagram", "Pinterest"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-wider"
                >
                  {social[0]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mq-container py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <p>© 2026 MQ. All rights reserved.</p>
          <div className="flex items-center gap-3 text-xs">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Amex</span>
            <span>PayPal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
