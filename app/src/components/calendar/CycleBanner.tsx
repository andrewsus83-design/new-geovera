"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type CycleStatus = "pending" | "running" | "done" | "partial" | "failed" | "expired";

interface TaskCycle {
  id: string;
  brand_id: string;
  status: CycleStatus;
  tasks_generated: number | null;
  refresh_count: number;
  refresh_limit: number;
  expires_at: string | null;
  created_at: string;
}

interface Props {
  brandId: string;
}

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function isCycleExpired(cycle: TaskCycle): boolean {
  if (!cycle.expires_at) return false;
  return new Date(cycle.expires_at).getTime() <= Date.now();
}

function Spinner({ size = 16, color = "#5F8F8B" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: "gv-spin 0.8s linear infinite" }}>
      <style>{`@keyframes gv-spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AnimatedDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      <style>{`
        @keyframes gv-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: "#5F8F8B",
          display: "inline-block",
          animation: `gv-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

export default function CycleBanner({ brandId }: Props) {
  const [cycle, setCycle] = useState<TaskCycle | null | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string>("");

  const fetchCycle = useCallback(async () => {
    const { data } = await supabase
      .from("gv_task_cycles")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCycle(data ?? null);
  }, [brandId]);

  useEffect(() => { fetchCycle(); }, [fetchCycle]);

  useEffect(() => {
    if (!cycle?.expires_at) return;
    const tick = () => setCountdown(formatCountdown(cycle.expires_at!));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [cycle?.expires_at]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      await fetch("/api/tasks/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      });
      await fetchCycle();
    } catch { /* ignore */ }
    finally { setIsRefreshing(false); }
  }, [brandId, fetchCycle, isRefreshing]);

  // LOADING
  if (cycle === undefined) {
    return (
      <div className="animate-pulse" style={{
        height: 64, borderRadius: 12, background: "#F3F4F6", margin: "12px 0 4px",
      }} />
    );
  }

  const noActiveCycle = cycle === null || cycle.status === "expired" ||
    (cycle.expires_at !== null && isCycleExpired(cycle));
  const isRunning = cycle && (cycle.status === "running" || cycle.status === "pending");
  const isDone = cycle && (cycle.status === "done" || cycle.status === "partial") && !isCycleExpired(cycle);
  const isFailed = cycle && cycle.status === "failed";
  const atLimit = cycle && cycle.refresh_count >= cycle.refresh_limit;

  // NO CYCLE / EXPIRED
  if (noActiveCycle) {
    return (
      <div style={{
        border: "1.5px dashed #C8DBD9", borderRadius: 12, background: "#F9FAFA",
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, margin: "12px 0 4px",
      }}>
        <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
          Belum ada task cycle aktif
        </span>
        <button onClick={handleRefresh} disabled={isRefreshing} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8,
          background: isRefreshing ? "#A8C5C2" : "#5F8F8B",
          color: "#fff", fontSize: 13, fontWeight: 600, border: "none",
          cursor: isRefreshing ? "not-allowed" : "pointer", flexShrink: 0,
        }}>
          {isRefreshing && <Spinner size={14} color="#fff" />}
          {isRefreshing ? "Generating…" : "Generate Tasks"}
        </button>
      </div>
    );
  }

  // RUNNING
  if (isRunning) {
    return (
      <div style={{
        borderRadius: 12, background: "#EDF5F4", border: "1px solid #C8DBD9",
        padding: "12px 16px", display: "flex", alignItems: "center",
        gap: 10, margin: "12px 0 4px",
      }}>
        <Spinner size={18} color="#5F8F8B" />
        <span style={{ fontSize: 13, color: "#1F2428", fontWeight: 500 }}>
          AI sedang menganalisis trends untuk 72H cycle…
        </span>
        <AnimatedDots />
      </div>
    );
  }

  // FAILED
  if (isFailed) {
    return (
      <div style={{
        borderRadius: 12, background: "#FFF3F3", border: "1px solid #FCCECE",
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, margin: "12px 0 4px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#FECACA" />
            <path d="M12 8v4m0 4h.01" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, color: "#1F2428", fontWeight: 500 }}>
            Gagal generate task cycle. Coba lagi.
          </span>
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8,
          background: isRefreshing ? "#F8B4B4" : "#EF4444",
          color: "#fff", fontSize: 13, fontWeight: 600, border: "none",
          cursor: isRefreshing ? "not-allowed" : "pointer", flexShrink: 0,
        }}>
          {isRefreshing && <Spinner size={14} color="#fff" />}
          {isRefreshing ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  // DONE / PARTIAL
  if (isDone) {
    const tasksCount = cycle!.tasks_generated ?? 0;
    const refreshRemaining = Math.max(0, cycle!.refresh_limit - cycle!.refresh_count);
    return (
      <div style={{
        borderRadius: 12, background: "#EDF5F4", border: "1px solid #C8DBD9",
        padding: "10px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 12, margin: "12px 0 4px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#22C55E",
            display: "inline-block", flexShrink: 0,
            boxShadow: "0 0 0 3px rgba(34,197,94,0.2)",
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2428" }}>72H Cycle Aktif</span>
          <span style={{
            fontSize: 12, fontWeight: 500, color: "#5F8F8B",
            background: "rgba(95,143,139,0.12)", borderRadius: 6, padding: "2px 8px",
          }}>{tasksCount} tasks</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6B7280" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Expires in&nbsp;</span>
          <span style={{ fontWeight: 600, color: "#1F2428" }}>
            {countdown || (cycle!.expires_at ? formatCountdown(cycle!.expires_at) : "—")}
          </span>
        </div>

        {atLimit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button disabled style={{
              padding: "6px 12px", borderRadius: 8, background: "#F3F4F6",
              color: "#9CA3AF", fontSize: 12, fontWeight: 600,
              border: "1px solid #E5E7EB", cursor: "not-allowed",
            }}>Limit tercapai</button>
            <span style={{ fontSize: 11, color: "#6B7280" }}>Upgrade untuk lebih banyak refresh</span>
          </div>
        ) : (
          <button onClick={handleRefresh} disabled={isRefreshing} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8,
            background: isRefreshing ? "#A8C5C2" : "#5F8F8B",
            color: "#fff", fontSize: 12, fontWeight: 600, border: "none",
            cursor: isRefreshing ? "not-allowed" : "pointer", flexShrink: 0,
          }}>
            {isRefreshing ? <Spinner size={13} color="#fff" /> : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )}
            {isRefreshing ? "Refreshing…" : `Refresh (${refreshRemaining}/${cycle!.refresh_limit} remaining)`}
          </button>
        )}
      </div>
    );
  }

  return null;
}
