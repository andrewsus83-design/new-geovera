"use client";
import { useState } from "react";
import Image from "next/image";

interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  /** Mobile: shows right panel as fullscreen overlay */
  mobileRightOpen?: boolean;
  /** Mobile: called when back button is tapped */
  onMobileBack?: () => void;
  /** Optional title shown in the mobile back bar */
  mobileBackLabel?: string;
}

/**
 * ThreeColumnLayout — GeoVera Design System v5
 *
 * Desktop layout:
 *   [floating pill sidebar 72px] [center white card flex-1] [right white card 38%]
 *   — background: #F4F7F8 (base)
 *   — sidebar: fixed-position floating pill (rendered by NavColumn)
 *   — columns: rounded-[32px] white cards with soft shadow
 *
 * Mobile layout:
 *   [full-width center] with hamburger → slide-out left panel
 *   Right panel: fullscreen overlay with back button
 */
export default function ThreeColumnLayout({
  left,
  center,
  right,
  mobileRightOpen = false,
  onMobileBack,
  mobileBackLabel = "Back",
}: ThreeColumnLayoutProps) {
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: "var(--gv-color-bg-base)" }}
    >
      {/* ── DESKTOP: Sidebar spacer (pill nav renders as `fixed` inside) ── */}
      <div className="hidden lg:block flex-shrink-0 w-[88px]">
        {left}
      </div>

      {/* ── DESKTOP: Gap after sidebar ── */}
      <div className="hidden lg:block flex-shrink-0 w-4" />

      {/* ── MOBILE: Left panel slide-in overlay ── */}
      {mobileLeftOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={() => setMobileLeftOpen(false)}
          />
          {/* Drawer */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] overflow-y-auto flex flex-col"
            style={{
              background: "var(--gv-color-bg-surface)",
              boxShadow: "var(--gv-shadow-modal)",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setMobileLeftOpen(false)}
              className="absolute top-4 right-4 z-10 h-9 w-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: "var(--gv-color-neutral-400)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--gv-color-neutral-100)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {/* Nav content */}
            <div className="flex-1 overflow-y-auto p-4 pt-14">
              {left}
            </div>
          </div>
        </div>
      )}

      {/* ── Center column ── */}
      <div
        className={[
          mobileRightOpen ? "hidden lg:flex" : "flex",
          "flex-col flex-1 min-w-0 overflow-hidden",
          "lg:rounded-[32px]",
          "my-0 lg:my-4 lg:mt-4",
        ].join(" ")}
        style={{
          background: "var(--gv-color-bg-surface)",
          border: "1px solid var(--gv-color-neutral-200)",
          boxShadow: "var(--gv-shadow-card)",
        }}
      >
        {/* Mobile-only top bar */}
        <div className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}>
          <button
            onClick={() => setMobileLeftOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: "var(--gv-color-neutral-500)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--gv-color-neutral-100)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            aria-label="Open menu"
          >
            {/* Hamburger */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd"
                d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <Image
            src="/images/geoveralogo.png"
            alt="GeoVera"
            width={26}
            height={26}
            className="flex-shrink-0 rounded-lg"
          />
          <span
            className="text-[15px] font-bold"
            style={{ fontFamily: "Georgia, serif", color: "var(--gv-color-neutral-900)" }}
          >
            GeoVera
          </span>
        </div>

        {/* Center scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {center}
        </div>
      </div>

      {/* ── DESKTOP: Gap between center and right ── */}
      <div className="hidden lg:block flex-shrink-0 w-4" />

      {/* ── DESKTOP: Right column ── */}
      <div
        className="hidden lg:flex flex-col flex-shrink-0 overflow-hidden rounded-[32px] my-4"
        style={{
          width: "38%",
          background: "var(--gv-color-bg-surface)",
          border: "1px solid var(--gv-color-neutral-200)",
          boxShadow: "var(--gv-shadow-card)",
        }}
      >
        {right}
      </div>

      {/* ── DESKTOP: Trailing gap ── */}
      <div className="hidden lg:block flex-shrink-0 w-4" />

      {/* ── MOBILE: Right panel fullscreen overlay ── */}
      {mobileRightOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[50] flex flex-col overflow-hidden"
          style={{ background: "var(--gv-color-bg-surface)" }}
        >
          {/* Back bar */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}
          >
            <button
              onClick={onMobileBack}
              className="flex items-center gap-2 text-[14px] font-semibold transition-colors"
              style={{ color: "var(--gv-color-primary-500)" }}
              aria-label="Go back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {mobileBackLabel}
            </button>
          </div>
          {/* Right content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {right}
          </div>
        </div>
      )}
    </div>
  );
}
