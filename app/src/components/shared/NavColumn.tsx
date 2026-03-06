"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ShootingStarIcon,
  CalenderIcon,
  AnimationIcon,
  PieChartIcon,
  ChatIcon,
} from "@/icons";

/* ── Utility icons not in DS icon set (sun/moon/logout/chevron) ── */
const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="10" height="10" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/* ── Nav items — GeoVera DS v5.8 icon set ── */
type NavIcon = React.FC<React.SVGProps<SVGSVGElement>>;

const navItems: { Icon: NavIcon; name: string; path: string }[] = [
  { Icon: ShootingStarIcon, name: "Start",  path: "/getting-started"},
  { Icon: CalenderIcon,     name: "Tasks",  path: "/calendar"       },
  { Icon: ChatIcon,         name: "Reply",  path: "/auto-reply"     },
  { Icon: AnimationIcon,    name: "Studio", path: "/content-studio" },
  { Icon: PieChartIcon,     name: "Report", path: "/analytics"      },
];

const DEMO_USER = {
  name: "Catharina Celine",
  role: "Brand Manager",
  initials: "CC",
};

/* ══════════════════════════════════════════════════════════════════════════════
   NavColumn — GeoVera Design System v5.8
   • Fixed 72 px pill sidebar — no hover expansion
   • Glass surface: --gv-color-glass-bg + --gv-blur-lg + --gv-shadow-sidebar
   • Active:   bg-[--gv-color-primary-50]  / text-[--gv-color-primary-500]
   • Inactive: text-[--gv-color-neutral-500] hover:bg-[--gv-color-neutral-100]
   • Icons:    DS icon set (@/icons) — GridIcon, ShootingStarIcon, CalenderIcon,
               AnimationIcon, PieChartIcon
   • Radius:   --gv-radius-2xl (pill) / --gv-radius-sm (items) / rounded-full (circles)
   • Motion:   --gv-duration-normal 200 ms / --gv-easing-default
══════════════════════════════════════════════════════════════════════════════ */
export default function NavColumn({ children: _children }: { children?: React.ReactNode } = {}) {
  const pathname       = usePathname();
  const router         = useRouter();
  const [dark, setDark]                 = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
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
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-[72px]"
      style={{
        borderRadius: "var(--gv-radius-2xl)",
        border: "1px solid var(--gv-color-glass-border)",
        background: "var(--gv-color-glass-bg)",
        backdropFilter: `blur(var(--gv-blur-lg))`,
        WebkitBackdropFilter: `blur(var(--gv-blur-lg))`,
        boxShadow: "var(--gv-shadow-sidebar)",
      }}
    >
      {/* Inner wrapper */}
      <div className="flex flex-col w-[72px] px-2 py-4 gap-1">

        {/* ── Logo ── */}
        <div className="flex items-center justify-center h-11 mb-2">
          <Image
            src="/images/geoveralogo.png"
            alt="GeoVera"
            width={34}
            height={34}
            style={{ borderRadius: "var(--gv-radius-sm)" }}
          />
        </div>

        {/* ── Navigation items ── */}
        <div className="flex flex-col gap-1">
          {navItems.map(({ Icon, name, path }) => {
            const active = isActive(path);
            return (
              <Link
                key={name}
                href={path}
                className="flex flex-col items-center justify-center py-1.5 px-1 transition-colors duration-200"
                style={{ borderRadius: "var(--gv-radius-sm)" }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--gv-color-neutral-100)";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Icon circle — active: primary tint; inactive: neutral */}
                <span
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-200"
                  style={{
                    background: active ? "var(--gv-color-primary-50)" : "transparent",
                    color: active
                      ? "var(--gv-color-primary-500)"
                      : "var(--gv-color-neutral-500)",
                  }}
                >
                  <Icon width={20} height={20} />
                </span>

                {/* Label — visible only when active */}
                <span
                  className="text-[10px] font-semibold leading-none transition-all duration-200 overflow-hidden"
                  style={{
                    fontFamily: "var(--gv-font-body)",
                    color: "var(--gv-color-primary-500)",
                    opacity: active ? 1 : 0,
                    height: active ? "auto" : 0,
                    marginTop: active ? 4 : 0,
                  }}
                >
                  {name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1 min-h-[16px]" />

        {/* ── Bottom: user avatar + theme toggle ── */}
        <div className="flex flex-col gap-1" ref={menuRef}>

          {/* User popup (appears to the right) */}
          {showUserMenu && (
            <div
              className="overflow-hidden"
              style={{
                borderRadius: "var(--gv-radius-md)",
                border: "1px solid var(--gv-color-neutral-200)",
                background: "var(--gv-color-bg-surface)",
                boxShadow: "var(--gv-shadow-modal)",
                position: "absolute",
                left: "80px",
                bottom: "60px",
                width: "180px",
              }}
            >
              <div
                className="px-3 py-2.5"
                style={{ borderBottom: "1px solid var(--gv-color-neutral-100)" }}
              >
                <p
                  className="text-[13px] font-semibold leading-tight"
                  style={{
                    fontFamily: "var(--gv-font-heading)",
                    color: "var(--gv-color-neutral-900)",
                  }}
                >
                  {DEMO_USER.name}
                </p>
                <p
                  className="text-[11px] leading-tight mt-0.5"
                  style={{ color: "var(--gv-color-neutral-400)" }}
                >
                  {DEMO_USER.role}
                </p>
              </div>
              {/* Billing */}
              <Link
                href="/billing"
                onClick={() => setShowUserMenu(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] transition-colors duration-200"
                style={{ color: "var(--gv-color-neutral-700)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "var(--gv-color-neutral-50)")
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
                Billing
              </Link>

              {/* Security */}
              <Link
                href="/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] transition-colors duration-200"
                style={{ color: "var(--gv-color-neutral-700)", borderBottom: "1px solid var(--gv-color-neutral-100)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "var(--gv-color-neutral-50)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Security
              </Link>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] transition-colors duration-200"
                style={{ color: "var(--gv-color-danger-500)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "var(--gv-color-danger-50)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <LogoutIcon />
                Log out
              </button>
            </div>
          )}

          {/* User avatar button */}
          <button
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex flex-col items-center justify-center py-1.5 px-1 transition-colors duration-200"
            style={{
              borderRadius: "var(--gv-radius-sm)",
              background: showUserMenu ? "var(--gv-color-primary-50)" : "transparent",
            }}
          >
            <span
              className="w-9 h-9 flex items-center justify-center rounded-full text-white text-[11px] font-bold tracking-wide"
              style={{ background: "var(--color-theme-pink-500)" }}
            >
              {DEMO_USER.initials}
            </span>
            {showUserMenu && (
              <span className="rotate-180 mt-0.5 text-[var(--gv-color-neutral-400)]">
                <ChevronIcon className="" />
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-full h-9 transition-colors duration-200"
            style={{
              borderRadius: "var(--gv-radius-sm)",
              color: "var(--gv-color-neutral-400)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--gv-color-neutral-100)";
              (e.currentTarget as HTMLElement).style.color =
                "var(--gv-color-neutral-700)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color =
                "var(--gv-color-neutral-400)";
            }}
          >
            {dark ? <MoonIcon /> : <SunIcon />}
          </button>

        </div>
      </div>
    </nav>
  );
}
