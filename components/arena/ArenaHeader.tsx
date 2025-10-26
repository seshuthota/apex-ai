"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "./icons";

const NAV_LINKS = [
  { label: "Live", href: "#" },
  { label: "Leaderboard", href: "#" },
  { label: "Models", href: "#" },
];

const SECONDARY_LINKS = [
  { label: "Join the platform waitlist", href: "#" },
  { label: "About Apex AI", href: "#" },
];

export function ArenaHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-zinc-300 md:text-sm">
      <div className="flex items-center gap-8">
        <h1 className="text-xl font-semibold text-white">
          Apex<span className="text-zinc-500">Arena</span>{" "}
          <span className="text-xs font-normal uppercase tracking-wide text-zinc-500">
            live trading lab
          </span>
        </h1>
        <nav className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map((link, index) => (
            <div key={link.label} className="flex items-center gap-5">
              <Link
                href={link.href}
                className="transition-colors hover:text-white"
              >
                {link.label.toUpperCase()}
              </Link>
              {index !== NAV_LINKS.length - 1 && (
                <span className="text-zinc-600">|</span>
              )}
            </div>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {SECONDARY_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="hidden items-center gap-1 uppercase tracking-wide text-zinc-400 transition-colors hover:text-white sm:flex"
          >
            {link.label}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ))}
        <button className="flex items-center gap-1 uppercase tracking-wide text-zinc-400 transition-colors hover:text-white">
          <span>About Apex AI</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
