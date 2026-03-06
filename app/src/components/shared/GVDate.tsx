/**
 * GVDate — GeoVera Design System v5.8
 * Calendar-page style date widget with spiral binding.
 *
 * Usage:
 *   <GVDate date={new Date()} />
 *   <GVDate date={new Date()} size="lg" variant="today" />
 *   <GVDate date={new Date()} inline label="Content Review" sub="10:00 AM" />
 */

import React from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GVDateSize = "sm" | "md" | "lg" | "xl";
export type GVDateVariant = "default" | "today" | "accent" | "dark" | "muted";

interface GVDateBaseProps {
  date: Date;
  /** Show month as full name (e.g. "December") vs abbreviated (e.g. "Dec") */
  fullMonth?: boolean;
  /** Show weekday as full name (e.g. "Sunday") vs abbreviated (e.g. "Sun") */
  fullWeekday?: boolean;
}

interface GVDateBlockProps extends GVDateBaseProps {
  inline?: false;
  size?: GVDateSize;
  variant?: GVDateVariant;
  className?: string;
  style?: React.CSSProperties;
}

interface GVDateInlineProps extends GVDateBaseProps {
  inline: true;
  label: string;
  sub?: string;
  className?: string;
  style?: React.CSSProperties;
}

type GVDateProps = GVDateBlockProps | GVDateInlineProps;

// ─── Size config ─────────────────────────────────────────────────────────────

const SIZE: Record<GVDateSize, {
  width: number;
  borderRadius: number;
  headerPadding: string;
  headerMinHeight: number;
  bodyPadding: string;
  monthFontSize: number;
  dayFontSize: number;
  weekdayFontSize: number;
  spiralWidth: number;
  spiralHeight: number;
  spiralHoleSize: number;
  spiralHoleTop: number;
  spiralCount: number;
  spiralGap: number;
}> = {
  sm: {
    width: 64,    borderRadius: 12,
    headerPadding: "10px 8px 8px",  headerMinHeight: 32,
    bodyPadding: "6px 8px 8px",
    monthFontSize: 8,   dayFontSize: 26,  weekdayFontSize: 7,
    spiralWidth: 8,  spiralHeight: 14, spiralHoleSize: 4,  spiralHoleTop: 2,
    spiralCount: 2,  spiralGap: 8,
  },
  md: {
    width: 88,    borderRadius: 16,
    headerPadding: "14px 10px 10px", headerMinHeight: 44,
    bodyPadding: "8px 10px 12px",
    monthFontSize: 11,  dayFontSize: 36,  weekdayFontSize: 9,
    spiralWidth: 10, spiralHeight: 18, spiralHoleSize: 5,  spiralHoleTop: 3,
    spiralCount: 3,  spiralGap: 10,
  },
  lg: {
    width: 120,   borderRadius: 20,
    headerPadding: "18px 12px 12px", headerMinHeight: 56,
    bodyPadding: "10px 12px 16px",
    monthFontSize: 14,  dayFontSize: 52,  weekdayFontSize: 11,
    spiralWidth: 12, spiralHeight: 22, spiralHoleSize: 6,  spiralHoleTop: 3,
    spiralCount: 4,  spiralGap: 14,
  },
  xl: {
    width: 160,   borderRadius: 24,
    headerPadding: "22px 16px 14px", headerMinHeight: 72,
    bodyPadding: "12px 16px 20px",
    monthFontSize: 18,  dayFontSize: 68,  weekdayFontSize: 13,
    spiralWidth: 14, spiralHeight: 26, spiralHoleSize: 7,  spiralHoleTop: 4,
    spiralCount: 5,  spiralGap: 18,
  },
};

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<GVDateVariant, {
  headerBg: string;
  bodyBg: string;
  dayColor: string;
  monthColor: string;
  weekdayColor: string;
  spiralBg: string;
  spiralHoleBg: string;
  boxShadow: string;
  showToday?: boolean;
}> = {
  default: {
    headerBg: "var(--gv-gradient-primary)",
    bodyBg: "var(--gv-color-bg-surface)",
    dayColor: "var(--gv-color-primary-700)",
    monthColor: "rgba(255,255,255,0.95)",
    weekdayColor: "var(--gv-color-neutral-400)",
    spiralBg: "var(--gv-color-neutral-700)",
    spiralHoleBg: "var(--gv-color-bg-base)",
    boxShadow: "0 1px 3px rgba(31,36,40,0.08), 0 8px 24px rgba(63,101,98,0.14), 0 2px 8px rgba(63,101,98,0.08)",
  },
  today: {
    headerBg: "var(--gv-gradient-primary)",
    bodyBg: "var(--gv-color-primary-50)",
    dayColor: "var(--gv-color-primary-700)",
    monthColor: "rgba(255,255,255,0.95)",
    weekdayColor: "var(--gv-color-neutral-400)",
    spiralBg: "var(--gv-color-neutral-700)",
    spiralHoleBg: "var(--gv-color-bg-base)",
    boxShadow: "0 1px 3px rgba(31,36,40,0.08), 0 8px 24px rgba(63,101,98,0.14), 0 2px 8px rgba(63,101,98,0.08)",
    showToday: true,
  },
  accent: {
    headerBg: "linear-gradient(135deg, #3D6562 0%, #5F8F8B 100%)",
    bodyBg: "var(--gv-color-primary-100)",
    dayColor: "var(--gv-color-primary-900)",
    monthColor: "rgba(255,255,255,0.95)",
    weekdayColor: "var(--gv-color-neutral-400)",
    spiralBg: "var(--gv-color-neutral-700)",
    spiralHoleBg: "var(--gv-color-bg-base)",
    boxShadow: "0 1px 3px rgba(31,36,40,0.08), 0 8px 24px rgba(63,101,98,0.14), 0 2px 8px rgba(63,101,98,0.08)",
  },
  dark: {
    headerBg: "var(--gv-color-primary-900)",
    bodyBg: "var(--gv-color-primary-700)",
    dayColor: "var(--gv-color-primary-100)",
    monthColor: "rgba(255,255,255,0.95)",
    weekdayColor: "var(--gv-color-primary-400)",
    spiralBg: "var(--gv-color-primary-100)",
    spiralHoleBg: "var(--gv-color-primary-900)",
    boxShadow: "0 1px 3px rgba(31,36,40,0.08), 0 8px 24px rgba(63,101,98,0.14), 0 2px 8px rgba(63,101,98,0.08)",
  },
  muted: {
    headerBg: "var(--gv-color-neutral-200)",
    bodyBg: "var(--gv-color-bg-surface)",
    dayColor: "var(--gv-color-neutral-400)",
    monthColor: "var(--gv-color-neutral-500)",
    weekdayColor: "var(--gv-color-neutral-400)",
    spiralBg: "var(--gv-color-neutral-400)",
    spiralHoleBg: "var(--gv-color-bg-base)",
    boxShadow: "0 1px 3px rgba(31,36,40,0.05), 0 4px 12px rgba(31,36,40,0.06)",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function GVDate(props: GVDateProps) {
  const { date, fullMonth = false, fullWeekday = false, className = "", style } = props;

  const day      = date.getDate();
  const monthStr = fullMonth ? MONTHS_FULL[date.getMonth()] : MONTHS_SHORT[date.getMonth()];
  const weekStr  = fullWeekday ? WEEKDAYS_FULL[date.getDay()] : WEEKDAYS_SHORT[date.getDay()];

  // ── Inline variant ──
  if ("inline" in props && props.inline) {
    const { label, sub } = props;
    return (
      <div
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: "var(--gv-color-bg-surface)",
          border: "1.5px solid var(--gv-color-neutral-200)",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 1px 4px rgba(31,36,40,0.06)",
          minWidth: 180,
          ...style,
        }}
      >
        {/* Mini badge */}
        <div style={{
          width: 40, height: 44, borderRadius: 10,
          overflow: "hidden", flexShrink: 0,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            background: "var(--gv-gradient-primary)",
            flex: "0 0 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "var(--gv-font-heading)", fontSize: 6,
              fontWeight: 700, color: "white",
              letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              {monthStr}
            </span>
          </div>
          <div style={{
            background: "var(--gv-color-primary-50)",
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontFamily: "var(--gv-font-heading)", fontSize: 18,
              fontWeight: 800, color: "var(--gv-color-primary-700)",
              letterSpacing: "-0.03em", lineHeight: 1,
            }}>
              {day}
            </span>
          </div>
        </div>
        {/* Text */}
        <div>
          <div style={{
            fontFamily: "var(--gv-font-heading)", fontSize: 13,
            fontWeight: 600, color: "var(--gv-color-neutral-900)", lineHeight: 1.3,
          }}>
            {label}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: "var(--gv-color-neutral-400)", marginTop: 2 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Block variant ──
  const size    = (props as GVDateBlockProps).size    ?? "md";
  const variant = (props as GVDateBlockProps).variant ?? "default";
  const s  = SIZE[size];
  const v  = VARIANT_STYLES[variant];

  const spirals = Array.from({ length: s.spiralCount });

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        borderRadius: s.borderRadius,
        overflow: "hidden",
        boxShadow: v.boxShadow,
        width: s.width,
        userSelect: "none",
        ...style,
      }}
    >
      {/* Spiral holes */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: s.spiralGap,
        zIndex: 10,
      }}>
        {spirals.map((_, i) => (
          <div key={i} style={{
            width: s.spiralWidth, height: s.spiralHeight,
            background: v.spiralBg,
            borderRadius: "0 0 8px 8px",
            position: "relative",
            flexShrink: 0,
          }}>
            <div style={{
              content: "''",
              position: "absolute",
              top: s.spiralHoleTop,
              left: "50%",
              transform: "translateX(-50%)",
              width: s.spiralHoleSize,
              height: s.spiralHoleSize,
              background: v.spiralHoleBg,
              borderRadius: "50%",
            }} />
          </div>
        ))}
      </div>

      {/* Header — Month */}
      <div style={{
        background: v.headerBg,
        padding: s.headerPadding,
        textAlign: "center",
        position: "relative",
        minHeight: s.headerMinHeight,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "var(--gv-font-heading)",
          fontWeight: 700,
          fontSize: s.monthFontSize,
          color: v.monthColor,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}>
          {monthStr}
        </span>
      </div>

      {/* Body — Day + Weekday */}
      <div style={{
        background: v.bodyBg,
        padding: s.bodyPadding,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}>
        <div style={{
          fontFamily: "var(--gv-font-heading)",
          fontWeight: 800,
          fontSize: s.dayFontSize,
          lineHeight: 1,
          color: v.dayColor,
          letterSpacing: "-0.03em",
        }}>
          {day}
        </div>
        <div style={{
          fontFamily: "var(--gv-font-body)",
          fontWeight: 500,
          fontSize: s.weekdayFontSize,
          color: v.weekdayColor,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {weekStr}
        </div>
        {v.showToday && (
          <div style={{
            fontSize: s.weekdayFontSize,
            fontWeight: 600,
            fontFamily: "var(--gv-font-body)",
            color: "var(--gv-color-primary-500)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 2,
          }}>
            Today
          </div>
        )}
      </div>
    </div>
  );
}
