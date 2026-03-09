"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ── DS v5.9 WIRED-style icons (currentColor) ── */

// Hub — connected nodes (Start / Getting Started)
const HubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <circle cx="12" cy="12" r="2" />
    <circle cx="6"  cy="6"  r="2" />
    <circle cx="18" cy="6"  r="2" />
    <circle cx="6"  cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <line x1="8"  y1="6"  x2="10" y2="11" />
    <line x1="16" y1="6"  x2="14" y2="11" />
    <line x1="8"  y1="18" x2="10" y2="13" />
    <line x1="16" y1="18" x2="14" y2="13" />
  </svg>
);

// Calendar — Tasks
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <rect x="3" y="4" width="18" height="18" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="2"  x2="8"  y2="6"  />
    <line x1="16" y1="2" x2="16" y2="6"  />
  </svg>
);

// Chat — Auto Reply
const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M21 11.5C21 16.75 16.97 21 12 21C10.5 21 9.1 20.65 7.85 20.05L3 21L4.35 16.85C3.45 15.45 3 13.8 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 11.5Z" />
    <circle cx="8"  cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// Content Studio — pencil/edit
const StudioIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M17 3L21 7L8 20L3 21L4 16L17 3Z" />
    <line x1="13" y1="7" x2="17" y2="11" />
  </svg>
);

// Analytics — line chart
const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);

// AI Chat — 4-pointed sparkle (universal AI symbol, distinct from hub/chat icons)
const AIChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1"     x2="12" y2="3"     />
    <line x1="12" y1="21"    x2="12" y2="23"    />
    <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12"    x2="3"  y2="12"    />
    <line x1="21" y1="12"   x2="23" y2="12"    />
    <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"  />
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/* ── Nav items — DS v6.0 ── */
const navItems = [
  { icon: <HubIcon />,      name: "Start",  path: "/getting-started" },
  { icon: <CalendarIcon />, name: "Tasks",  path: "/calendar"        },
  { icon: <AIChatIcon />,   name: "Chat",   path: "/ai-chat"         },
  { icon: <ChatIcon />,     name: "Reply",  path: "/auto-reply"      },
  { icon: <StudioIcon />,   name: "Studio", path: "/content-studio"  },
  { icon: <AnalyticsIcon />, name: "Report", path: "/analytics"      },
];

const DEMO_USER = {
  name: "Catharina Celine",
  role: "Brand Manager",
  initials: "CC",
};

/* ══════════════════════════════════════════════════════════════════════════════
   NavColumn — GeoVera Design System v5.9
   • Fixed 72 px — no hover expansion
   • Active item: filled teal circle + label below icon
   • Inactive item: icon only, no label, hover softens bg
   • No overflow-hidden (keeps user dropdown visible)
══════════════════════════════════════════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NavColumn({ children }: { children?: React.ReactNode } = {}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [dark, setDark]                 = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/signin");
  };

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const toggleTheme = () => {
    setDark((v) => !v);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <nav
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-[72px] rounded-[48px] border border-white/60"
      style={{
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(31,36,40,0.06)",
      }}
    >
      {/* Inner wrapper — 72px wide, centered content */}
      <div className="flex flex-col w-[72px] px-2 py-4 gap-1">

        {/* ── Logo ── */}
        <div className="flex items-center justify-center h-11 mb-2">
          <Image
            src="/images/geoveralogo.png"
            alt="GeoVera"
            width={34}
            height={34}
            className="rounded-xl"
          />
        </div>

        {/* ── Navigation items ── */}
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.name}
                href={item.path}
                className="flex flex-col items-center justify-center py-1.5 px-1 rounded-[14px] transition-colors duration-200 hover:bg-[var(--gv-color-neutral-100)]"
              >
                {/* Circle icon container */}
                <span
                  className={[
                    "w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-200",
                    active
                      ? "bg-[var(--gv-color-primary-50)] text-[var(--gv-color-primary-500)]"
                      : "text-[var(--gv-color-neutral-500)]",
                  ].join(" ")}
                >
                  {item.icon}
                </span>

                {/* Label — always rendered, visible only when active */}
                <span
                  className={[
                    "text-[10px] font-semibold leading-none mt-1 transition-all duration-200",
                    active
                      ? "text-[var(--gv-color-primary-500)] opacity-100"
                      : "opacity-0 h-0 mt-0 overflow-hidden",
                  ].join(" ")}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Flexible spacer ── */}
        <div className="flex-1 min-h-[16px]" />

        {/* ── Bottom: user + theme ── */}
        <div className="flex flex-col gap-1" ref={menuRef}>

          {/* User popup menu (appears to the right) */}
          {showUserMenu && (
            <div
              className="rounded-[16px] overflow-hidden"
              style={{
                border: "1px solid var(--gv-color-neutral-200)",
                background: "var(--gv-color-bg-surface)",
                boxShadow: "0 8px 24px rgba(31,36,40,0.10)",
                position: "absolute",
                left: "80px",
                bottom: "60px",
                width: "180px",
              }}
            >
              <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)" }}>
                <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--gv-color-neutral-900)" }}>{DEMO_USER.name}</p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{DEMO_USER.role}</p>
              </div>
              {/* Subscription */}
              <Link
                href="/subscription"
                onClick={() => setShowUserMenu(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] transition-colors duration-200"
                style={{ color: "var(--gv-color-neutral-700)", borderBottom: "1px solid var(--gv-color-neutral-100)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "var(--gv-color-neutral-50)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                Langganan
              </Link>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogoutIcon />
                Log out
              </button>
            </div>
          )}

          {/* User avatar button */}
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className={[
              "flex flex-col items-center justify-center py-1.5 px-1 rounded-[14px] transition-colors duration-200",
              showUserMenu
                ? "bg-[var(--gv-color-primary-50)]"
                : "hover:bg-[var(--gv-color-neutral-100)]",
            ].join(" ")}
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-full bg-pink-500 text-white text-[11px] font-bold tracking-wide">
              {DEMO_USER.initials}
            </span>
            {showUserMenu && (
              <span className="rotate-180 mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>
                <ChevronIcon />
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-full h-9 rounded-[14px] transition-colors"
            style={{ color: "var(--gv-color-neutral-400)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--gv-color-neutral-100)";
              (e.currentTarget as HTMLElement).style.color = "var(--gv-color-neutral-700)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--gv-color-neutral-400)";
            }}
          >
            {dark ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </div>
    </nav>
  );
}
