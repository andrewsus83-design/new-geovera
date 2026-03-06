"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import { supabase } from "@/lib/supabase";
import {
  ImageIcon, VideoIcon, UserIcon, BoxCubeIcon, ShootingStarIcon,
  AiIcon, BoltIcon, PencilIcon, TaskIcon, ListIcon, GalleryIcon,
  BrandIcon, BoxTapped, CreatorIcon, FolderIcon, AnimationIcon,
} from "@/icons";

const FALLBACK_BRAND_ID =
  process.env.NEXT_PUBLIC_DEMO_BRAND_ID || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";

// ── Constants ─────────────────────────────────────────────────────────────────
const IMAGE_DAILY_LIMITS: Record<string, number> = { basic: 10, premium: 15, partner: 30 };
const VIDEO_DAILY_LIMITS: Record<string, number> = { basic: 0, premium: 1, partner: 2 };
const VIDEO_MAX_DURATION: Record<string, number> = { basic: 0, premium: 10, partner: 25 };
const TRAINING_LIMITS: Record<string, number>    = { basic: 5, premium: 10, partner: 20 };
// Partner: 1 YouTube avatar video/month (3 min via HeyGen)
const VIDEO_AVATAR_MONTHLY: Record<string, number> = { basic: 0, premium: 0, partner: 1 };

const VIDEO_TOPICS = [
  { id: "podcast",        label: "🎙️ Podcast",               desc: "Conversational, interview style" },
  { id: "product_review", label: "⭐ Product Review",        desc: "Honest, detailed showcase" },
  { id: "edu_product",    label: "📚 Edukasi Product",       desc: "How-to, tutorial format" },
  { id: "new_product",    label: "🆕 New Product Launch",    desc: "Exciting announcement" },
  { id: "soft_selling",   label: "💫 Soft Selling",          desc: "Subtle, lifestyle integrated" },
  { id: "lifestyle",      label: "🌟 Lifestyle",             desc: "Day-in-life, aspirational" },
  { id: "advertorial",    label: "📰 Advertorial Trend",     desc: "Trending format, viral hook" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type StudioSection = "generate_image" | "generate_video" | "assets" | "history";
type AssetSubSection = "design_system" | "product" | "character";
type SubjectType = "character" | "product" | "both";
type VideoInputType = "text" | "image";
type PromptSource = "random" | "custom" | "task";

interface TrainedModel {
  id: string; dataset_name: string; theme: string; image_count: number;
  training_status: string; model_path: string | null;
  metadata: { trigger_word?: string; kie_training_id?: string; lora_model?: string } | null;
  created_at: string;
}
interface GeneratedImage {
  id: string; prompt_text: string; image_url: string | null; thumbnail_url: string | null;
  status: string; ai_model: string | null; target_platform: string | null;
  style_preset: string | null; created_at: string; feedback?: string | null;
}
interface GeneratedVideo {
  id: string; hook: string; video_url: string | null; video_thumbnail_url: string | null;
  video_status: string | null; ai_model: string | null; target_platform: string | null;
  video_aspect_ratio: string | null; created_at: string; feedback?: string | null;
}
interface TodayTask { id: string; title: string; description: string | null; target_platforms: string[] | null; }
interface SideImage { side: "front" | "left" | "back" | "right"; label: string; file: File | null; preview: string | null; storageUrl: string | null; }
type DetailItem = { type: "image"; data: GeneratedImage } | { type: "video"; data: GeneratedVideo } | { type: "model"; data: TrainedModel } | null;

// ── API helpers ───────────────────────────────────────────────────────────────
async function studioFetch(payload: Record<string, unknown>) {
  const res = await fetch("/api/content-studio", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`Server error (${res.status}) — please try again`);
  }
  return res.json();
}

async function uploadImage(file: File, brandId: string, folder: string, name: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${folder}/${brandId}/${name}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("agent-profiles").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("agent-profiles").getPublicUrl(path);
  return data.publicUrl;
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-start justify-between px-4 py-4" style={{ background: "var(--gv-color-neutral-50)" }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const isCurrent = current === n;
        const isDone = current > n;
        const isLast = i === steps.length - 1;
        return (
          <div key={label} className="flex items-center" style={{ flex: isLast ? "0 0 auto" : "1 1 0" }}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center" style={{ minWidth: 48 }}>
              <div
                className="flex items-center justify-center transition-all"
                style={{
                  width: isCurrent ? 40 : 32,
                  height: isCurrent ? 40 : 32,
                  borderRadius: "var(--gv-radius-full)",
                  background: isDone ? "var(--gv-color-primary-500)" : isCurrent ? "var(--gv-color-bg-surface)" : "var(--gv-color-neutral-200)",
                  border: isCurrent ? "3px solid var(--gv-color-primary-200)" : "none",
                  boxShadow: isCurrent ? "0 0 0 3px var(--gv-color-primary-50)" : "none",
                  color: isDone ? "white" : isCurrent ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-400)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : n}
              </div>
              <span
                className="text-[9px] font-semibold mt-1.5 text-center leading-tight"
                style={{
                  color: isCurrent ? "var(--gv-color-primary-600)" : isDone ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-400)",
                  maxWidth: 64,
                }}
              >
                {label}
              </span>
            </div>
            {/* Connecting line */}
            {!isLast && (
              <div
                className="flex-1 mx-1"
                style={{
                  height: 2,
                  marginBottom: 16,
                  borderRadius: 1,
                  background: isDone ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DailyQuota({ used, limit, label }: { used: number; limit: number; label: string }) {
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, (used / limit) * 100);
  const barColor = remaining === 0 ? "var(--gv-color-danger-500)" : remaining <= 2 ? "var(--gv-color-warning-500)" : "var(--gv-color-primary-500)";
  return (
    <div className="px-3 py-2 flex items-center gap-3" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-500)" }}>{label} today</span>
          <span className="text-[10px] font-bold" style={{ color: remaining === 0 ? "var(--gv-color-danger-500)" : "var(--gv-color-neutral-700)" }}>
            {remaining} left / {limit}
          </span>
        </div>
        <div className="h-1 overflow-hidden" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-neutral-200)" }}>
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: barColor, borderRadius: "var(--gv-radius-full)" }} />
        </div>
      </div>
    </div>
  );
}

function SmartPromptBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold disabled:opacity-50 transition-colors"
      style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-info-50)", color: "var(--gv-color-info-700)" }}
    >
      {loading ? <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--gv-color-info-500)", borderTopColor: "transparent" }} /> : "✨"}
      {loading ? "AI thinking..." : "Smart Prompt (OpenAI)"}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CENTER — Studio Section Picker
// ══════════════════════════════════════════════════════════════════════════════
const SECTIONS: { id: StudioSection; icon: React.ReactNode; label: string; sub: string }[] = [
  { id: "generate_image",  icon: <ImageIcon className="w-5 h-5" />,    label: "Generate Image",     sub: "KIE Flux · daily quota" },
  { id: "generate_video",  icon: <VideoIcon className="w-5 h-5" />,    label: "Generate Video",     sub: "KIE Kling · daily quota" },
  { id: "assets",          icon: <FolderIcon className="w-5 h-5" />,   label: "Assets",             sub: "Design system · product · character" },
  { id: "history",         icon: <ListIcon className="w-5 h-5" />,     label: "History",            sub: "All generations" },
];

function StudioSectionPicker({ active, onSelect }: { active: StudioSection; onSelect: (s: StudioSection) => void }) {
  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}>
          Content Studio
        </h2>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>Powered by KIE + OpenAI</p>
      </div>
      <div className="space-y-2">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full flex items-center gap-4 p-4 text-left transition-all"
              style={{
                borderRadius: "var(--gv-radius-md)",
                border: `1px solid ${isActive ? "var(--gv-color-primary-200)" : "var(--gv-color-neutral-200)"}`,
                background: isActive ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
              }}
            >
              <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: isActive ? "var(--gv-color-primary-100)" : "var(--gv-color-neutral-50)", color: isActive ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-500)" }}>
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: isActive ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-900)" }}>
                  {s.label}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{s.sub}</p>
              </div>
              {isActive && <span className="w-2 h-2 flex-shrink-0" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-primary-500)" }} />}
            </button>
          );
        })}
      </div>
      <div className="p-3 space-y-1.5 mt-2" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 flex-shrink-0" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-success-500)" }} />
          <span className="text-[10px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>KIE API Connected</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 flex-shrink-0" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-info-500)" }} />
          <span className="text-[10px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>OpenAI Smart Prompts</span>
        </div>
        <p className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Flux · Kling V1/V2 · LoRA</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERATING POPUP
// ══════════════════════════════════════════════════════════════════════════════
function GeneratingPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="max-w-sm w-full text-center p-6" style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", border: "1px solid var(--gv-color-neutral-200)", boxShadow: "var(--gv-shadow-modal)" }}>
        <div className="text-5xl mb-3 animate-bounce">⏳</div>
        <h3 className="text-base font-bold mb-2" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}>Sedang Diproses</h3>
        <p className="text-sm mb-5" style={{ color: "var(--gv-color-neutral-500)" }}>
          Generate sedang berlangsung di background. Hasilnya akan otomatis muncul di{" "}
          <strong style={{ color: "var(--gv-color-primary-600)" }}>History</strong> ketika sudah selesai.
        </p>
        <button
          onClick={onClose}
          className="gv-btn-primary w-full py-2.5 text-sm font-semibold"
        >
          OK, Mengerti
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRAINING WIZARD
// ══════════════════════════════════════════════════════════════════════════════
function TrainingWizard({
  brandId, trainingType, currentTier, totalModelCount, pastDatasets, onDone,
}: {
  brandId: string; trainingType: "product" | "character";
  currentTier: string; totalModelCount: number;
  pastDatasets: TrainedModel[];
  onDone: (m: TrainedModel) => void;
}) {
  const limit = TRAINING_LIMITS[currentTier] ?? 5;
  const atLimit = totalModelCount >= limit;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [datasetName, setDatasetName] = useState("");
  const [triggerWord, setTriggerWord] = useState("");
  const [sides, setSides] = useState<SideImage[]>([
    { side: "front", label: "Front",  file: null, preview: null, storageUrl: null },
    { side: "left",  label: "Left",   file: null, preview: null, storageUrl: null },
    { side: "back",  label: "Back",   file: null, preview: null, storageUrl: null },
    { side: "right", label: "Right",  file: null, preview: null, storageUrl: null },
  ]);
  const [totalSizeMB, setTotalSizeMB] = useState(0);
  const [sizeError, setSizeError] = useState(false);
  // Step 2
  const [synthUrls, setSynthUrls] = useState<string[]>([]);
  const [synthCount, setSynthCount] = useState(0);
  const [synthLoading, setSynthLoading] = useState(false);
  // Step 3
  const [trainingId, setTrainingId] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState("training");
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleFileChange = useCallback((side: SideImage["side"], files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const preview = URL.createObjectURL(file);
    setSides((prev) => {
      // Revoke old blob URL to prevent memory leak
      const old = prev.find((s) => s.side === side);
      if (old?.preview?.startsWith("blob:")) URL.revokeObjectURL(old.preview);
      const updated = prev.map((s) => s.side === side ? { ...s, file, preview } : s);
      const total = updated.reduce((a, s) => a + (s.file?.size ?? 0), 0) / 1024 / 1024;
      setTotalSizeMB(parseFloat(total.toFixed(2)));
      setSizeError(total > 10);
      return updated;
    });
  }, []);

  const allUploaded = sides.every((s) => s.file !== null);

  const proceedToStep2 = async () => {
    if (!datasetName.trim() || !allUploaded || sizeError) return;
    setStep(2);
    setSynthLoading(true);
    setError(null);
    setSynthUrls([]);
    setSynthCount(0);

    // Upload all 4 images to Supabase Storage in parallel
    const folder = `training-${trainingType}`;
    const safeName = datasetName.replace(/\s+/g, "-").toLowerCase();
    let uploadedUrls: string[] = [];
    try {
      uploadedUrls = await Promise.all(
        sides.map((s) => uploadImage(s.file!, brandId, folder, `${safeName}-${s.side}`))
      );
    } catch (e) {
      setError(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
      setStep(1);
      setSynthLoading(false);
      return;
    }

    // Generate 8 synthetic training images via Llama (prompt engineering) + KIE Flux-2 Pro
    let syntheticUrls: string[] = [];
    try {
      const res = await studioFetch({
        action: "generate_synthetics",
        brand_id: brandId,
        name: datasetName,
        training_type: trainingType,
        count: 8,
        past_datasets: pastDatasets.map((d) => ({ dataset_name: d.dataset_name, theme: d.theme })),
      });
      if (res.success && Array.isArray(res.synthetic_urls)) {
        syntheticUrls = res.synthetic_urls;
        setSynthUrls(syntheticUrls);
        setSynthCount(res.count ?? syntheticUrls.length);
      }
    } catch {
      // Non-fatal — continue with originals only
    }

    setSynthLoading(false);

    // Start training — pass syntheticUrls directly (avoid stale React state)
    await startTraining(uploadedUrls, syntheticUrls);
  };

  const startTraining = async (originalUrls: string[], synUrls: string[]) => {
    setStep(3);
    setError(null);
    const allUrls = [...originalUrls, ...synUrls];
    const tw = triggerWord.trim() || datasetName.toLowerCase().replace(/\s+/g, "_");

    try {
      const res = await studioFetch({
        action: trainingType === "product" ? "train_product" : "train_character",
        brand_id: brandId,
        name: datasetName,
        trigger_word: tw,
        image_urls: allUrls,
        steps: 1000,
      });
      if (res.success) {
        setTrainingId(res.training_id);
        setTrainingStatus("training");
        // Clear any existing interval before starting a new one
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          if (!res.training_id) return;
          const s = await studioFetch({ action: "check_training", brand_id: brandId, training_id: res.training_id });
          if (s.success) {
            setTrainingStatus(s.status ?? "training");
            setTrainingProgress(s.progress ?? 0);
            if (["completed", "succeeded", "success"].includes(s.status)) {
              if (pollRef.current) clearInterval(pollRef.current);
              onDone({
                id: Date.now().toString(), dataset_name: datasetName, theme: trainingType,
                image_count: allUrls.length, training_status: "completed",
                model_path: s.model_url ?? null,
                metadata: { trigger_word: tw, kie_training_id: res.training_id },
                created_at: new Date().toISOString(),
              });
            }
          }
        }, 15000);
      } else {
        setError(res.error ?? "Training failed to start");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Training error");
    }
  };

  const resetWizard = () => {
    setStep(1); setDatasetName(""); setTriggerWord(""); setSynthUrls([]); setSynthCount(0);
    setTrainingId(null); setTrainingStatus("training"); setTrainingProgress(0); setError(null);
    setSides(sides.map((s) => ({ ...s, file: null, preview: null, storageUrl: null })));
    if (pollRef.current) clearInterval(pollRef.current);
  };

  if (atLimit) {
    return (
      <div className="p-6 text-center" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-warning-500)", background: "var(--gv-color-warning-50)" }}>
        <p className="text-2xl mb-2">⚠️</p>
        <p className="text-sm font-semibold" style={{ color: "var(--gv-color-warning-700)" }}>Training Quota Reached</p>
        <p className="text-xs mt-1" style={{ color: "var(--gv-color-warning-700)" }}>
          {currentTier} plan: max {limit} trained models. Upgrade to train more.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
      <StepBar steps={["Upload 4 Sides", "8 Synthetics", "Training"]} current={step} />
      <div className="p-4 space-y-4">

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}>
                {trainingType === "product" ? <BoxTapped className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} /> : <CreatorIcon className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} />}
                {trainingType === "product" ? "Product Training" : "Character Training"}
              </h3>
              <span className="text-[10px] px-2 py-0.5" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-500)" }}>
                {totalModelCount} / {limit} models
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gv-color-neutral-500)" }}>Dataset Name *</label>
                <input
                  value={datasetName}
                  onChange={(e) => { setDatasetName(e.target.value); if (!triggerWord) setTriggerWord(e.target.value.toLowerCase().replace(/\s+/g, "_")); }}
                  placeholder={trainingType === "product" ? "Summer Bag 2026" : "Brand Ambassador"}
                  className="w-full px-3 py-2 text-xs outline-none"
                  style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gv-color-neutral-500)" }}>Trigger Word</label>
                <input
                  value={triggerWord}
                  onChange={(e) => setTriggerWord(e.target.value)}
                  placeholder="summer_bag_2026"
                  className="w-full px-3 py-2 text-xs outline-none"
                  style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--gv-color-neutral-500)" }}>
                Upload 4 Sides{" "}
                <span className="font-normal text-[10px]" style={{ color: sizeError ? "var(--gv-color-danger-500)" : "var(--gv-color-neutral-400)" }}>
                  (total: {totalSizeMB} MB / 10 MB max)
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {sides.map((s) => (
                  <label
                    key={s.side}
                    className="relative cursor-pointer overflow-hidden flex items-center justify-center transition-colors"
                    style={{ aspectRatio: "1", minHeight: 90, borderRadius: "var(--gv-radius-sm)", border: "2px dashed var(--gv-color-neutral-200)" }}
                  >
                    {s.preview ? (
                      <>
                        <img src={s.preview} alt={s.side} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-end p-1.5">
                          <span className="text-[10px] font-bold text-white">{s.label} ✓</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-2 text-center">
                        <span className="text-xl">📸</span>
                        <p className="text-[10px] font-semibold" style={{ color: "var(--gv-color-neutral-500)" }}>{s.label}</p>
                        <p className="text-[9px]" style={{ color: "var(--gv-color-neutral-400)" }}>Click to upload</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(s.side, e.target.files)} />
                  </label>
                ))}
              </div>
            </div>

            {sizeError && <p className="text-xs" style={{ color: "var(--gv-color-danger-500)" }}>Total size exceeds 10 MB. Use smaller images.</p>}
            {error && <p className="text-xs" style={{ color: "var(--gv-color-danger-500)" }}>{error}</p>}

            <button
              onClick={proceedToStep2}
              disabled={!datasetName.trim() || !allUploaded || sizeError}
              className="gv-btn-primary w-full py-2.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate Synthetic Dataset →
            </button>
            <p className="text-[10px] text-center" style={{ color: "var(--gv-color-neutral-400)" }}>
              GeoVera will generate 8 synthetic training variations using Llama + KIE Flux-2 Pro
            </p>
          </>
        )}

        {/* ── STEP 2: Synthetics ── */}
        {step === 2 && (
          <>
            <div className="text-center">
              <h3 className="text-sm font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>🎨 Generating Synthetic Dataset</h3>
              <p className="text-xs mt-1" style={{ color: "var(--gv-color-neutral-500)" }}>
                {synthLoading ? `Building ${Math.min(synthCount + 1, 8)} of 8 AI variations...` : `${synthCount} AI variations ready · 4 originals + synthetics`}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-neutral-100)" }}>
                <div className="h-full transition-all duration-700"
                  style={{ width: `${synthLoading ? (synthCount / 8) * 100 : 100}%`, background: synthLoading ? "var(--gv-color-primary-500)" : "var(--gv-color-success-500)", borderRadius: "var(--gv-radius-full)" }} />
              </div>
            </div>

            {/* 8 uploaded originals + synthetics in a 4x4 grid preview */}
            <div className="grid grid-cols-4 gap-1.5">
              {/* 4 original uploads */}
              {sides.map((s) => s.preview && (
                <div key={s.side} className="aspect-square overflow-hidden relative" style={{ borderRadius: "var(--gv-radius-xs)" }}>
                  <img src={s.preview} alt={s.side} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 text-white text-[8px] font-bold text-center py-0.5" style={{ background: "rgba(95,143,139,0.8)" }}>{s.label}</div>
                </div>
              ))}
              {/* Synthetics */}
              {Array.from({ length: 12 }).map((_, i) => {
                const url = synthUrls[i];
                return (
                  <div key={`s${i}`} className="aspect-square overflow-hidden flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-neutral-100)" }}>
                    {url ? (
                      <img src={url} alt={`synthetic-${i}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 ${synthLoading && i === synthCount ? "animate-spin" : ""}`} style={{ borderColor: synthLoading && i === synthCount ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-300)", borderTopColor: synthLoading && i === synthCount ? "transparent" : undefined }} />
                    )}
                  </div>
                );
              })}
            </div>

            {synthLoading && (
              <p className="text-center text-xs animate-pulse" style={{ color: "var(--gv-color-info-700)" }}>
                ✨ OpenAI generating training prompts → KIE Flux creating images...
              </p>
            )}
            {!synthLoading && !error && (
              <div className="text-center text-xs font-semibold" style={{ color: "var(--gv-color-success-500)" }}>
                ✅ Synthetic dataset ready. Starting LoRA training...
              </div>
            )}
            {error && <p className="text-xs text-center" style={{ color: "var(--gv-color-danger-500)" }}>{error}</p>}
          </>
        )}

        {/* ── STEP 3: Training ── */}
        {step === 3 && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 flex items-center justify-center mx-auto" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-primary-50)" }}>
              {["completed", "succeeded", "success"].includes(trainingStatus)
                ? <span className="text-3xl">✅</span>
                : <div className="w-7 h-7 rounded-full border-[3px] animate-spin" style={{ borderColor: "var(--gv-color-primary-500)", borderTopColor: "transparent" }} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>
                {["completed", "succeeded", "success"].includes(trainingStatus) ? "Training Complete! 🎉" : "LoRA Training in Progress"}
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--gv-color-neutral-500)" }}>
                {["completed", "succeeded", "success"].includes(trainingStatus)
                  ? `"${datasetName}" is ready. Use it in Generate Image & Video.`
                  : "Training takes 10–30 mins. You can leave this page safely."}
              </p>
            </div>
            {trainingId && (
              <div className="p-3 text-left space-y-2" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-neutral-50)" }}>
                <div className="flex justify-between">
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Training ID</span>
                  <span className="text-[10px] font-mono truncate max-w-[60%]" style={{ color: "var(--gv-color-neutral-500)" }}>{trainingId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Trigger Word</span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--gv-color-primary-600)" }}>{triggerWord || datasetName.toLowerCase().replace(/\s+/g, "_")}</span>
                </div>
                {trainingProgress > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Progress</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--gv-color-primary-600)" }}>{trainingProgress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden" style={{ borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-neutral-200)" }}>
                      <div className="h-full transition-all" style={{ width: `${trainingProgress}%`, background: "var(--gv-color-primary-500)", borderRadius: "var(--gv-radius-full)" }} />
                    </div>
                  </>
                )}
              </div>
            )}
            {error && <p className="text-xs" style={{ color: "var(--gv-color-danger-500)" }}>{error}</p>}
            <button onClick={resetWizard} className="text-xs hover:underline" style={{ color: "var(--gv-color-primary-600)" }}>
              + Train Another Model
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERATE IMAGE WIZARD
// ══════════════════════════════════════════════════════════════════════════════
function GenerateImageWizard({
  brandId, currentTier, imagesUsedToday, trainedModels, onResult, onUsed, onGenerateStart,
}: {
  brandId: string; currentTier: string; imagesUsedToday: number;
  trainedModels: TrainedModel[]; onResult: (img: GeneratedImage) => void; onUsed: () => void;
  onGenerateStart?: () => void;
}) {
  const limit = IMAGE_DAILY_LIMITS[currentTier] ?? 3;
  const atLimit = imagesUsedToday >= limit;

  const [step, setStep] = useState<1 | 2>(1);
  const [subjectType, setSubjectType] = useState<SubjectType>("product");
  const [promptSource, setPromptSource] = useState<PromptSource>("custom");
  const [customPrompt, setCustomPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [selectedTask, setSelectedTask] = useState<TodayTask | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (promptSource !== "task") return;
    const today = new Date().toISOString().split("T")[0];
    supabase.from("gv_task_board")
      .select("id, title, description, target_platforms")
      .eq("brand_id", brandId).eq("due_date", today).neq("status", "completed").limit(10)
      .then(({ data }) => setTodayTasks(data ?? []));
  }, [promptSource, brandId]);

  const handleSmartPrompt = async () => {
    setSmartLoading(true);
    try {
      const res = await studioFetch({
        action: "generate_smart_prompt",
        brand_id: brandId,
        prompt_type: "image",
        subject_type: subjectType,
        model_name: "",
        topic_style: "commercial product photography",
        task_context: selectedTask ? selectedTask.title : "",
      });
      if (res.success && res.prompt) {
        setCustomPrompt(res.prompt);
        setPromptSource("custom");
      }
    } catch { /* ignore */ }
    setSmartLoading(false);
  };

  const handleGenerate = async () => {
    if (atLimit) return;
    setLoading(true); setError(null);
    onGenerateStart?.();
    let prompt = customPrompt.trim();
    if (!prompt && promptSource === "task" && selectedTask) {
      prompt = `Create a compelling visual for: ${selectedTask.title}. ${selectedTask.description ?? ""}. Platform: ${selectedTask.target_platforms?.join(", ") ?? "social media"}. Commercial quality, professional photography.`;
    }
    if (!prompt) { setError("Please enter or generate a prompt"); setLoading(false); return; }

    try {
      const res = await studioFetch({
        action: "generate_image", brand_id: brandId, prompt, aspect_ratio: aspectRatio,
        model: "flux-2-pro",
      });
      if (res.success) {
        // Poll for image URL if KIE is processing asynchronously (task_id present but no image yet)
        let finalImageUrl: string | null = res.image_url;
        let finalStatus: string = res.status ?? "completed";
        if (res.task_id && !finalImageUrl && !["failed", "error"].includes(finalStatus)) {
          for (let i = 0; i < 12; i++) { // max 60s (12 × 5s)
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const poll = await studioFetch({
                action: "check_task", brand_id: brandId,
                task_id: res.task_id, db_id: res.db_id, task_type: "image",
              });
              finalStatus = poll.status ?? finalStatus;
              if (poll.image_url) { finalImageUrl = poll.image_url; break; }
              if (["failed", "error", "cancelled"].includes(finalStatus)) break;
            } catch { break; }
          }
        }
        onResult({
          id: res.db_id ?? Date.now().toString(), prompt_text: prompt,
          image_url: finalImageUrl, thumbnail_url: finalImageUrl,
          status: finalStatus, ai_model: "flux-2-pro",
          target_platform: null, style_preset: null,
          created_at: new Date().toISOString(),
        });
        onUsed();
        // Task link: update cover image when generated from a task
        if (promptSource === "task" && selectedTask && res.image_url) {
          await supabase.from("gv_task_board").update({ cover_image_url: res.image_url }).eq("id", selectedTask.id);
        }
        setStep(1); setCustomPrompt(""); setSelectedTask(null);
      } else { setError(res.error ?? "Generation failed"); }
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const SUBJECT_OPTS: { id: SubjectType; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: "character", icon: <UserIcon className="w-5 h-5" />,          label: "Character Only",       desc: "Person or persona" },
    { id: "product",   icon: <BoxCubeIcon className="w-5 h-5" />,      label: "Product Only",         desc: "Item or product" },
    { id: "both",      icon: <ShootingStarIcon className="w-5 h-5" />, label: "Character + Product",  desc: "Combined scene" },
  ];

  return (
    <div className="gv-card overflow-hidden">
      <StepBar steps={["Subject", "Prompt & Generate"]} current={step} />
      <div className="p-4 space-y-3">
        <DailyQuota used={imagesUsedToday} limit={limit} label="Images" />

        {atLimit && (
          <div className="p-3 text-center" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-danger-50)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--gv-color-danger-700)" }}>Daily limit reached ({limit} images)</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-danger-500)" }}>Resets tomorrow at midnight. Upgrade for more.</p>
          </div>
        )}

        {/* STEP 1: Subject */}
        {step === 1 && (
          <>
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--gv-color-neutral-900)" }}>
              <ImageIcon className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} /> What to feature?
            </h3>
            <div className="space-y-2">
              {SUBJECT_OPTS.map((opt) => {
                const sel = subjectType === opt.id;
                return (
                  <button key={opt.id} onClick={() => { setSubjectType(opt.id); setStep(2); }}
                    className="w-full flex items-center gap-3 p-3 text-left transition-all"
                    style={{
                      borderRadius: "var(--gv-radius-md)",
                      border: `1.5px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`,
                      background: sel ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
                      boxShadow: sel ? "0 0 0 3px var(--gv-color-primary-50)" : "none",
                    }}>
                    <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>{opt.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{opt.desc}</p>
                    </div>
                    {/* Radio circle */}
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-full)", border: `2px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-300)"}` }}>
                      {sel && <div style={{ width: 10, height: 10, borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-primary-500)" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2: Prompt & Generate */}
        {step === 2 && (
          <>
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--gv-color-neutral-900)" }}>
              <PencilIcon className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} /> Prompt
            </h3>
            <div className="flex gap-2 flex-wrap">
              {([["1:1","Square"],["9:16","Portrait"],["16:9","Landscape"],["4:5","Feed"]] as [string,string][]).map(([v,l]) => {
                const sel = aspectRatio === v;
                return (
                  <button key={v} onClick={() => setAspectRatio(v)}
                    className="px-3 py-1.5 text-[10px] font-semibold transition-all"
                    style={{ borderRadius: "var(--gv-radius-full)", border: `1.5px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`, background: sel ? "var(--gv-color-primary-50)" : "transparent", color: sel ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-500)" }}>
                    {l}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([["random","Random"],["custom","Custom"],["task","From Task"]] as [PromptSource,string][]).map(([id,lbl]) => {
                const sel = promptSource === id;
                const Icon = id === "random" ? BoltIcon : id === "custom" ? PencilIcon : TaskIcon;
                return (
                  <button key={id} onClick={() => setPromptSource(id)}
                    className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-all"
                    style={{ borderRadius: "var(--gv-radius-sm)", border: `1.5px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`, background: sel ? "var(--gv-color-primary-50)" : "transparent", color: sel ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-500)" }}>
                    <Icon className="w-4 h-4" />{lbl}
                  </button>
                );
              })}
            </div>

            {/* OpenAI smart prompt button (shown for random + custom) */}
            {(promptSource === "random" || promptSource === "custom") && (
              <div className="flex items-center gap-2">
                <SmartPromptBtn onClick={handleSmartPrompt} loading={smartLoading} />
                {promptSource === "random" && !customPrompt && (
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Click to generate AI prompt</span>
                )}
              </div>
            )}

            {(promptSource === "custom" || (promptSource === "random" && customPrompt)) && (
              <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                rows={3}
                className="w-full px-3 py-2 text-xs outline-none resize-none"
                style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }} />
            )}

            {promptSource === "task" && (
              <>
                <SmartPromptBtn onClick={handleSmartPrompt} loading={smartLoading} />
                {todayTasks.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: "var(--gv-color-neutral-400)" }}>No tasks for today</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {todayTasks.map((t) => {
                      const sel = selectedTask?.id === t.id;
                      return (
                        <button key={t.id} onClick={() => setSelectedTask(t)}
                          className="w-full text-left p-2.5 text-xs transition-colors"
                          style={{ borderRadius: "var(--gv-radius-xs)", border: `1px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`, background: sel ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)" }}>
                          <p className="font-semibold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>{t.title}</p>
                          {t.target_platforms && <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{t.target_platforms.join(", ")}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedTask && customPrompt && (
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={2} className="w-full px-3 py-2 text-xs outline-none resize-none"
                    style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }} />
                )}
              </>
            )}

            {error && <p className="text-xs" style={{ color: "var(--gv-color-danger-500)" }}>{error}</p>}
            <button onClick={handleGenerate} disabled={loading || atLimit}
              className="gv-btn-primary w-full py-2.5 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <><span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />Generating...</> : "✨ Generate Image"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERATE VIDEO WIZARD
// ══════════════════════════════════════════════════════════════════════════════
function GenerateVideoWizard({
  brandId, currentTier, videosUsedToday, avatarsUsedThisMonth, trainedModels, historyImages, onResult, onUsed, onGenerateStart,
}: {
  brandId: string; currentTier: string; videosUsedToday: number; avatarsUsedThisMonth: number;
  trainedModels: TrainedModel[]; historyImages: GeneratedImage[];
  onResult: (v: GeneratedVideo) => void; onUsed: () => void;
  onGenerateStart?: () => void;
}) {
  const isPartner = currentTier === "partner";
  const avatarMonthlyLimit = VIDEO_AVATAR_MONTHLY[currentTier] ?? 0;

  const limit = VIDEO_DAILY_LIMITS[currentTier] ?? 1;
  const maxDuration = VIDEO_MAX_DURATION[currentTier] ?? 8;
  const atLimit = videosUsedToday >= limit;
  const atAvatarLimit = avatarsUsedThisMonth >= avatarMonthlyLimit;

  const [videoMode, setVideoMode] = useState<"short" | "avatar">("short");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [subjectType, setSubjectType] = useState<SubjectType>("product");
  const [videoInputType, setVideoInputType] = useState<VideoInputType>("text");
  const [promptSource, setPromptSource] = useState<PromptSource>("custom");
  const [textPrompt, setTextPrompt] = useState("");
  const [selectedTask, setSelectedTask] = useState<TodayTask | null>(null);
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<GeneratedImage | null>(null);
  const [uploadedRefUrl, setUploadedRefUrl] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [duration, setDuration] = useState(8);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [loading, setLoading] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar video state
  const [avatarScript, setAvatarScript] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [avatarVoiceId, setAvatarVoiceId] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (promptSource !== "task") return;
    const today = new Date().toISOString().split("T")[0];
    supabase.from("gv_task_board")
      .select("id, title, description, target_platforms")
      .eq("brand_id", brandId).eq("due_date", today).neq("status", "completed").limit(10)
      .then(({ data }) => setTodayTasks(data ?? []));
  }, [promptSource, brandId]);

  const handleSmartPrompt = async () => {
    setSmartLoading(true);
    const topic = VIDEO_TOPICS.find((t) => t.id === selectedTopic);
    try {
      const res = await studioFetch({
        action: "generate_smart_prompt",
        brand_id: brandId,
        prompt_type: "video",
        subject_type: subjectType,
        model_name: "",
        topic_style: topic?.label ?? "commercial video",
        task_context: selectedTask ? selectedTask.title : "",
      });
      if (res.success && res.prompt) {
        setTextPrompt(res.prompt);
        setPromptSource("custom");
      }
    } catch { /* ignore */ }
    setSmartLoading(false);
  };

  const handleRefUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingRef(true);
    try {
      const url = await uploadImage(files[0], brandId, "video-refs", `ref-${Date.now()}`);
      setUploadedRefUrl(url);
    } catch { setError("Reference upload failed"); }
    finally { setUploadingRef(false); }
  };

  const handleGenerateAvatar = async () => {
    if (!avatarScript.trim()) { setAvatarError("Enter a script for the avatar video"); return; }
    if (atAvatarLimit) return;
    setAvatarLoading(true); setAvatarError(null);
    onGenerateStart?.();
    try {
      const res = await studioFetch({
        action: "generate_avatar_video",
        brand_id: brandId,
        prompt: avatarScript.trim(),
        avatar_id: avatarId.trim() || "default",
        voice_id: avatarVoiceId.trim() || "default",
      });
      if (res.success) {
        let finalVideoUrl: string | null = res.video_url;
        let finalStatus: string = res.status ?? "processing";
        if (res.task_id && !finalVideoUrl && !["failed", "error"].includes(finalStatus)) {
          // HeyGen can take several minutes — poll up to 72×5s = 6 minutes
          for (let i = 0; i < 72; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const poll = await studioFetch({
                action: "check_task", brand_id: brandId,
                task_id: res.task_id, db_id: res.db_id, task_type: "video",
                generation_mode: "heygen",
              });
              finalStatus = poll.status ?? finalStatus;
              if (poll.video_url) { finalVideoUrl = poll.video_url; break; }
              if (["failed", "error", "cancelled"].includes(finalStatus)) break;
            } catch { break; }
          }
        }
        onResult({
          id: res.db_id ?? Date.now().toString(), hook: avatarScript.trim(),
          video_url: finalVideoUrl, video_thumbnail_url: null,
          video_status: finalStatus, ai_model: "heygen-avatar",
          target_platform: "youtube", video_aspect_ratio: "16:9",
          created_at: new Date().toISOString(),
        });
        onUsed();
        setAvatarScript(""); setAvatarId(""); setAvatarVoiceId("");
      } else { setAvatarError(res.error ?? "Avatar generation failed"); }
    } catch { setAvatarError("Network error. Try again."); }
    finally { setAvatarLoading(false); }
  };

  const handleGenerate = async () => {
    if (!selectedTopic) { setError("Please select a topic style"); return; }
    if (atLimit) return;
    setLoading(true); setError(null);
    onGenerateStart?.();

    const topicLabel = VIDEO_TOPICS.find((t) => t.id === selectedTopic)?.label ?? selectedTopic;

    let prompt = "";
    if (videoInputType === "text") {
      if (textPrompt.trim()) {
        prompt = `${topicLabel}: ${textPrompt.trim()}`;
      } else if (selectedTask) {
        prompt = `${topicLabel} style: ${selectedTask.title}. ${selectedTask.description ?? ""}. Platform: ${selectedTask.target_platforms?.join(", ") ?? "social media"}.`;
      } else {
        const type = subjectType === "both" ? "product and character" : subjectType;
        prompt = `${topicLabel} video for ${type}. Engaging, professional, social media optimized.`;
      }
    } else {
      const imageUrl = selectedHistoryImage?.image_url ?? uploadedRefUrl;
      if (!imageUrl) { setError("Select or upload a reference image"); setLoading(false); return; }
      prompt = `${topicLabel} style video showcasing the ${subjectType} in this image. Dynamic movement, professional, ${aspectRatio === "9:16" ? "vertical" : "horizontal"} format.`;
    }

    try {
      const useOpenAI = duration > 10;
      const genMode = useOpenAI ? "openai" : "kie";
      const payload: Record<string, unknown> = {
        action: "generate_video", brand_id: brandId, prompt,
        duration, aspect_ratio: aspectRatio, model: useOpenAI ? "sora-2" : "kling-v1", mode: "standard",
      };
      if (videoInputType === "image") {
        const imgUrl = selectedHistoryImage?.image_url ?? uploadedRefUrl;
        if (imgUrl) payload.image_url = imgUrl;
      }

      const res = await studioFetch(payload);
      if (res.success) {
        // Poll for video URL if async (OpenAI Sora-2 or Kie returning task_id)
        let finalVideoUrl: string | null = res.video_url;
        let finalStatus: string = res.status ?? "processing";
        if (res.task_id && !finalVideoUrl && !["failed", "error"].includes(finalStatus)) {
          const maxPolls = useOpenAI ? 36 : 24; // 3 min for Sora-2, 2 min for Kie
          for (let i = 0; i < maxPolls; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const poll = await studioFetch({
                action: "check_task", brand_id: brandId,
                task_id: res.task_id, db_id: res.db_id, task_type: "video",
                generation_mode: genMode,
              });
              finalStatus = poll.status ?? finalStatus;
              if (poll.video_url) { finalVideoUrl = poll.video_url; break; }
              if (["failed", "error", "cancelled"].includes(finalStatus)) break;
            } catch { break; }
          }
        }
        onResult({
          id: res.db_id ?? Date.now().toString(), hook: prompt,
          video_url: finalVideoUrl, video_thumbnail_url: null,
          video_status: finalStatus, ai_model: useOpenAI ? "sora-2" : "kling-v1",
          target_platform: "tiktok", video_aspect_ratio: aspectRatio,
          created_at: new Date().toISOString(),
        });
        onUsed();
        setStep(1); setTextPrompt(""); setSelectedTask(null); setSelectedTopic(null); setSelectedHistoryImage(null); setUploadedRefUrl(null);
      } else { setError(res.error ?? "Generation failed"); }
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const SUBJECT_OPTS: { id: SubjectType; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: "character", icon: <UserIcon className="w-5 h-5" />,          label: "Character Only",      desc: "Person or persona" },
    { id: "product",   icon: <BoxCubeIcon className="w-5 h-5" />,      label: "Product Only",        desc: "Item or product" },
    { id: "both",      icon: <ShootingStarIcon className="w-5 h-5" />, label: "Character + Product", desc: "Combined scene" },
  ];

  return (
    <div className="gv-card overflow-hidden">
      {videoMode === "short" && <StepBar steps={["Subject", "Content", "Topic & Generate"]} current={step} />}

      {/* Video type toggle — Partner only */}
      {isPartner && (
        <div className="flex items-center gap-1 px-4 pt-4">
          {(["short", "avatar"] as const).map((mode) => (
            <button key={mode} onClick={() => setVideoMode(mode)}
              className="flex-1 py-2 text-xs font-semibold transition-all"
              style={{
                borderRadius: "var(--gv-radius-sm)",
                background: videoMode === mode ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-100)",
                color: videoMode === mode ? "var(--gv-color-bg-surface)" : "var(--gv-color-neutral-500)",
              }}>
              {mode === "short" ? "⚡ Short Video" : "🎬 YouTube Avatar"}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 space-y-3">

        {/* ── AVATAR VIDEO FORM (Partner only) ── */}
        {videoMode === "avatar" && (
          <div className="space-y-4">
            <DailyQuota used={avatarsUsedThisMonth} limit={avatarMonthlyLimit} label="Avatar Videos This Month" />
            {atAvatarLimit && (
              <div className="p-3 text-center" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-danger-50)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--gv-color-danger-700)" }}>Monthly limit reached (1 avatar video/month)</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-danger-500)" }}>Resets on the 1st of next month.</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: "var(--gv-color-neutral-700)" }}>
                Video Script
              </label>
              <textarea
                value={avatarScript}
                onChange={(e) => setAvatarScript(e.target.value)}
                placeholder="Write the script your avatar will speak. Up to 3 minutes of content."
                rows={6}
                className="w-full px-3 py-2 text-xs outline-none resize-none"
                style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }}
              />
              <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>Powered by HeyGen · 16:9 YouTube format · up to 3 minutes</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--gv-color-neutral-500)" }}>Avatar ID</label>
                <input
                  type="text"
                  value={avatarId}
                  onChange={(e) => setAvatarId(e.target.value)}
                  placeholder="HeyGen avatar ID"
                  className="w-full px-3 py-2 text-xs outline-none"
                  style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--gv-color-neutral-500)" }}>Voice ID</label>
                <input
                  type="text"
                  value={avatarVoiceId}
                  onChange={(e) => setAvatarVoiceId(e.target.value)}
                  placeholder="HeyGen voice ID"
                  className="w-full px-3 py-2 text-xs outline-none"
                  style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }}
                />
              </div>
            </div>
            {avatarError && <p className="text-xs" style={{ color: "var(--gv-color-danger-500)" }}>{avatarError}</p>}
            <button
              onClick={handleGenerateAvatar}
              disabled={avatarLoading || atAvatarLimit || !avatarScript.trim()}
              className="gv-btn-primary w-full py-2.5 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {avatarLoading
                ? <><span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />Generating Avatar Video...</>
                : "🎬 Generate YouTube Avatar Video"}
            </button>
          </div>
        )}

        {/* ── SHORT VIDEO WIZARD ── */}
        {videoMode === "short" && (
          <>
        <DailyQuota used={videosUsedToday} limit={limit} label="Videos" />

        {atLimit && (
          <div className="p-3 text-center" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-danger-50)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--gv-color-danger-700)" }}>Daily limit reached ({limit} videos)</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-danger-500)" }}>Resets tomorrow at midnight. Upgrade for more.</p>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--gv-color-neutral-900)" }}>
              <VideoIcon className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} /> What to feature?
            </h3>
            <div className="space-y-2">
              {SUBJECT_OPTS.map((opt) => {
                const sel = subjectType === opt.id;
                return (
                  <button key={opt.id} onClick={() => { setSubjectType(opt.id); setStep(2); }}
                    className="w-full flex items-center gap-3 p-3 text-left transition-all"
                    style={{
                      borderRadius: "var(--gv-radius-md)",
                      border: `1.5px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`,
                      background: sel ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
                      boxShadow: sel ? "0 0 0 3px var(--gv-color-primary-50)" : "none",
                    }}>
                    <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>{opt.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{opt.desc}</p>
                    </div>
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-full)", border: `2px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-300)"}` }}>
                      {sel && <div style={{ width: 10, height: 10, borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-primary-500)" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2: Content */}
        {step === 2 && (
          <>
            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--gv-color-neutral-900)" }}>
              <AnimationIcon className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} /> Content Source
            </h3>
            <div className="space-y-2">
              {([["text","Text to Video","AI generates from prompt"],["image","Image to Video","Animate an image"]] as [VideoInputType,string,string][]).map(([id,lbl,desc]) => {
                const sel = videoInputType === id;
                const Icon = id === "text" ? PencilIcon : ImageIcon;
                return (
                  <button key={id} onClick={() => setVideoInputType(id)}
                    className="w-full flex items-center gap-3 p-3 text-left transition-all"
                    style={{
                      borderRadius: "var(--gv-radius-md)",
                      border: `1.5px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`,
                      background: sel ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
                      boxShadow: sel ? "0 0 0 3px var(--gv-color-primary-50)" : "none",
                    }}>
                    <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>{lbl}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{desc}</p>
                    </div>
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-full)", border: `2px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-300)"}` }}>
                      {sel && <div style={{ width: 10, height: 10, borderRadius: "var(--gv-radius-full)", background: "var(--gv-color-primary-500)" }} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: "var(--gv-color-neutral-500)" }}>Duration</span>
                  <span className="text-xs font-bold" style={{ color: "var(--gv-color-primary-600)" }}>{duration}s</span>
                </div>
                <input
                  type="range" min={1} max={maxDuration} value={Math.min(duration, maxDuration)}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--gv-color-primary-500)", background: "var(--gv-color-neutral-200)" }}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px]" style={{ color: "var(--gv-color-neutral-400)" }}>1s</span>
                  <span className="text-[9px]" style={{ color: "var(--gv-color-neutral-400)" }}>{maxDuration}s max</span>
                </div>
                {currentTier !== "partner" && <p className="text-[9px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{currentTier === "basic" ? "Upgrade for up to 25s" : "Partner: up to 25s"}</p>}
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--gv-color-neutral-500)" }}>Aspect Ratio</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2 text-xs outline-none"
                  style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }}>
                  <option value="9:16">9:16 Portrait (TikTok)</option>
                  <option value="16:9">16:9 Landscape (YouTube)</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>
            </div>

            {videoInputType === "text" && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {([["random","Random"],["custom","Custom"],["task","From Task"]] as [PromptSource,string][]).map(([id,lbl]) => {
                    const sel = promptSource === id;
                    const Icon = id === "random" ? BoltIcon : id === "custom" ? PencilIcon : TaskIcon;
                    return (
                      <button key={id} onClick={() => setPromptSource(id)}
                        className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-all"
                        style={{ borderRadius: "var(--gv-radius-sm)", border: `1.5px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`, background: sel ? "var(--gv-color-primary-50)" : "transparent", color: sel ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-500)" }}>
                        <Icon className="w-4 h-4" />{lbl}
                      </button>
                    );
                  })}
                </div>
                {(promptSource === "random" || promptSource === "custom") && (
                  <SmartPromptBtn onClick={handleSmartPrompt} loading={smartLoading} />
                )}
                {(promptSource === "custom" || (promptSource === "random" && textPrompt)) && (
                  <textarea value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder="Describe the video scene..." rows={3}
                    className="w-full px-3 py-2 text-xs outline-none resize-none"
                    style={{ borderRadius: "var(--gv-radius-xs)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-neutral-900)" }} />
                )}
                {promptSource === "task" && (
                  <>
                    <SmartPromptBtn onClick={handleSmartPrompt} loading={smartLoading} />
                    {todayTasks.length === 0 ? (
                      <p className="text-xs text-center py-2" style={{ color: "var(--gv-color-neutral-400)" }}>No tasks for today</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {todayTasks.map((t) => {
                          const sel = selectedTask?.id === t.id;
                          return (
                            <button key={t.id} onClick={() => setSelectedTask(t)}
                              className="w-full text-left p-2.5 text-xs transition-colors"
                              style={{ borderRadius: "var(--gv-radius-xs)", border: `1px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`, background: sel ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)" }}>
                              <p className="font-semibold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>{t.title}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {videoInputType === "image" && (
              <>
                {historyImages.length > 0 && (
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--gv-color-neutral-500)" }}>From History</label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto">
                      {historyImages.map((img) => {
                        const sel = selectedHistoryImage?.id === img.id;
                        return (
                          <button key={img.id} onClick={() => { setSelectedHistoryImage(img); setUploadedRefUrl(null); }}
                            className="aspect-square overflow-hidden transition-colors"
                            style={{ borderRadius: "var(--gv-radius-xs)", border: `2px solid ${sel ? "var(--gv-color-primary-500)" : "transparent"}` }}>
                            {img.image_url
                              ? <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--gv-color-neutral-100)" }}><span className="text-xs" style={{ color: "var(--gv-color-neutral-400)" }}>No img</span></div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="flex flex-col items-center justify-center gap-2 p-4 cursor-pointer transition-colors"
                  style={{ borderRadius: "var(--gv-radius-sm)", border: "2px dashed var(--gv-color-neutral-200)" }}>
                  {uploadedRefUrl
                    ? <img src={uploadedRefUrl} alt="ref" className="h-20 object-contain rounded" />
                    : <><ImageIcon className="w-6 h-6" style={{ color: "var(--gv-color-neutral-300)" }} /><p className="text-xs" style={{ color: "var(--gv-color-neutral-400)" }}>{uploadingRef ? "Uploading..." : "Upload reference image"}</p></>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleRefUpload(e.target.files)} disabled={uploadingRef} />
                </label>
              </>
            )}

            <button onClick={() => setStep(3)} className="gv-btn-primary w-full py-2.5 text-xs font-semibold">
              Next: Topic Style →
            </button>
          </>
        )}

        {/* STEP 3: Topic & Generate */}
        {step === 3 && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--gv-color-neutral-900)" }}><TaskIcon className="w-4 h-4" style={{ color: "var(--gv-color-primary-500)" }} /> Topic Style</h3>
              <SmartPromptBtn onClick={handleSmartPrompt} loading={smartLoading} />
            </div>
            <div className="space-y-1.5">
              {VIDEO_TOPICS.map((t) => {
                const sel = selectedTopic === t.id;
                return (
                  <button key={t.id} onClick={() => setSelectedTopic(t.id)}
                    className="w-full flex items-center gap-3 p-2.5 text-left transition-colors"
                    style={{ borderRadius: "var(--gv-radius-sm)", border: `1px solid ${sel ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)"}`, background: sel ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>{t.label}</p>
                      <p className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>{t.desc}</p>
                    </div>
                    {sel && <span className="flex-shrink-0 text-sm" style={{ color: "var(--gv-color-primary-500)" }}>●</span>}
                  </button>
                );
              })}
            </div>

            {textPrompt && (
              <div className="p-2" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-info-50)" }}>
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--gv-color-info-500)" }}>✨ OpenAI Prompt</p>
                <p className="text-[10px] line-clamp-2" style={{ color: "var(--gv-color-info-700)" }}>{textPrompt}</p>
              </div>
            )}

            {error && <p className="text-xs" style={{ color: "var(--gv-color-danger-500)" }}>{error}</p>}
            <button onClick={handleGenerate} disabled={loading || atLimit || !selectedTopic}
              className="gv-btn-primary w-full py-2.5 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <><span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />Generating Video...</> : <><VideoIcon className="w-4 h-4" /> Generate Video</>}
            </button>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORY CENTER
// ══════════════════════════════════════════════════════════════════════════════
function HistoryCenter({ brandId, onSelectImage, onSelectVideo }: {
  brandId: string;
  onSelectImage: (img: GeneratedImage) => void;
  onSelectVideo: (vid: GeneratedVideo) => void;
}) {
  const [tab, setTab] = useState<"images" | "videos" | "models">("images");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studioFetch({ action: "get_history", brand_id: brandId, type: "all", limit: 24 })
      .then((r) => { if (r.success) { setImages(r.images ?? []); setVideos(r.videos ?? []); setModels(r.trainings ?? []); } })
      .finally(() => setLoading(false));
  }, [brandId]);

  return (
    <div className="overflow-hidden" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
      <div className="flex" style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}>
        {(["images", "videos", "models"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-3 text-xs font-semibold capitalize transition-colors"
            style={{ color: tab === t ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-500)", borderBottom: tab === t ? "2px solid var(--gv-color-primary-500)" : "2px solid transparent" }}>
            {t === "images" ? `🖼️ Images (${images.length})` : t === "videos" ? `🎬 Videos (${videos.length})` : `🤖 Models (${models.length})`}
          </button>
        ))}
      </div>
      <div className="p-4">
        {loading && <div className="text-center py-8"><div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: "var(--gv-color-primary-500)", borderTopColor: "transparent" }} /></div>}
        {!loading && tab === "images" && (
          images.length === 0 ? <p className="text-center text-xs py-8" style={{ color: "var(--gv-color-neutral-400)" }}>No generated images yet</p> : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <button key={img.id} onClick={() => onSelectImage(img)}
                  className="aspect-square overflow-hidden transition-all"
                  style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-100)" }}>
                  {img.image_url
                    ? <img src={img.image_url} alt={img.prompt_text} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">{img.status === "processing" ? "⏳" : "❌"}</div>}
                </button>
              ))}
            </div>
          )
        )}
        {!loading && tab === "videos" && (
          videos.length === 0 ? <p className="text-center text-xs py-8" style={{ color: "var(--gv-color-neutral-400)" }}>No generated videos yet</p> : (
            <div className="space-y-2">
              {videos.map((vid) => (
                <button key={vid.id} onClick={() => onSelectVideo(vid)}
                  className="w-full flex items-center gap-3 p-3 text-left transition-colors"
                  style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)" }}>
                  <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-neutral-100)" }}>
                    {vid.video_thumbnail_url ? <img src={vid.video_thumbnail_url} alt="" className="w-full h-full object-cover" style={{ borderRadius: "var(--gv-radius-xs)" }} /> : <span className="text-lg">🎬</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>{vid.hook}</p>
                    <p className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>{vid.ai_model} · {vid.video_aspect_ratio} · {vid.video_status}</p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
        {!loading && tab === "models" && (
          models.length === 0 ? <p className="text-center text-xs py-8" style={{ color: "var(--gv-color-neutral-400)" }}>No trained models yet</p> : (
            <div className="space-y-2">
              {models.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)" }}>
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
                    {m.theme === "character" ? <UserIcon className="w-5 h-5" /> : <BoxCubeIcon className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>{m.dataset_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium" style={{ color: m.training_status === "completed" ? "var(--gv-color-success-500)" : "var(--gv-color-warning-500)" }}>{m.training_status}</span>
                      <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>· {m.image_count} images</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DETAIL PANEL (Right Column)
// ══════════════════════════════════════════════════════════════════════════════
const TOPIC_SOUNDS: Record<string, string[]> = {
  podcast:        ["Lo-fi beats", "Ambient chill", "Soft instrumental"],
  product_review: ["Upbeat pop", "Corporate upbeat", "Energetic positive"],
  edu_product:    ["Calm background", "Tutorial music", "Focus beats"],
  new_product:    ["Exciting reveal", "Hype beat", "Countdown music"],
  soft_selling:   ["Chill lifestyle", "Indie acoustic", "Morning vibes"],
  lifestyle:      ["Trendy pop", "Aesthetic lo-fi", "Summer vibes"],
  advertorial:    ["Viral trend audio", "TikTok trending sound", "Catchy hook"],
};

function DetailPanel({ item, brandId }: { item: DetailItem; brandId: string }) {
  const [feedback, setFeedback] = useState<"liked" | "disliked" | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Restore feedback state from DB when item changes (handles history items)
  useEffect(() => {
    if (!item || item.type === "model") {
      setFeedback(null);
      setFeedbackSubmitted(false);
      setFeedbackLoading(false);
      return;
    }
    const existing = (item.data as GeneratedImage & GeneratedVideo).feedback;
    if (existing === "liked" || existing === "disliked") {
      setFeedback(existing);
      setFeedbackSubmitted(true);
    } else {
      setFeedback(null);
      setFeedbackSubmitted(false);
    }
    setFeedbackLoading(false);
  }, [item?.data?.id, item?.type]);

  const submitFeedback = async (type: "liked" | "disliked") => {
    if (!item || item.type === "model" || feedbackLoading || feedbackSubmitted) return;
    setFeedback(type);
    setFeedbackLoading(true);
    try {
      await studioFetch({
        action: "submit_feedback",
        brand_id: brandId,
        db_id: item.data.id,
        content_type: item.type,
        feedback: type,
      });
      setFeedbackSubmitted(true);
    } catch (e) {
      console.error("Feedback submit error:", e);
      setFeedback(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const FeedbackSection = () => (
    <div className="p-3" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
      <p className="text-[10px] font-semibold mb-2" style={{ color: "var(--gv-color-neutral-500)" }}>🧠 TRAIN THE AI — Rate this result</p>
      {feedbackSubmitted ? (
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-success-50)" }}>
          <span className="text-base">{feedback === "liked" ? "👍" : "👎"}</span>
          <p className="text-xs font-semibold" style={{ color: "var(--gv-color-success-700)" }}>
            Thanks! AI is learning from your feedback.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => submitFeedback("liked")}
              disabled={feedbackLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all disabled:opacity-50"
              style={{ borderRadius: "var(--gv-radius-xs)", border: `1px solid ${feedback === "liked" ? "var(--gv-color-success-500)" : "var(--gv-color-neutral-200)"}`, background: feedback === "liked" ? "var(--gv-color-success-50)" : "transparent", color: feedback === "liked" ? "var(--gv-color-success-500)" : "var(--gv-color-neutral-500)" }}
            >
              {feedbackLoading && feedback === "liked"
                ? <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: "var(--gv-color-success-500)", borderTopColor: "transparent" }} />
                : "👍"
              }
              <span>Like</span>
            </button>
            <button
              onClick={() => submitFeedback("disliked")}
              disabled={feedbackLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all disabled:opacity-50"
              style={{ borderRadius: "var(--gv-radius-xs)", border: `1px solid ${feedback === "disliked" ? "var(--gv-color-danger-500)" : "var(--gv-color-neutral-200)"}`, background: feedback === "disliked" ? "var(--gv-color-danger-50)" : "transparent", color: feedback === "disliked" ? "var(--gv-color-danger-500)" : "var(--gv-color-neutral-500)" }}
            >
              {feedbackLoading && feedback === "disliked"
                ? <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: "var(--gv-color-danger-500)", borderTopColor: "transparent" }} />
                : "👎"
              }
              <span>Dislike</span>
            </button>
          </div>
          <p className="text-[9px] mt-1.5 text-center" style={{ color: "var(--gv-color-neutral-400)" }}>
            Your ratings train the AI to generate better content for your brand
          </p>
        </>
      )}
    </div>
  );

  if (!item) {
    return (
      <div className="h-full min-h-64 flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
        <span className="text-5xl opacity-20">✨</span>
        <p className="text-sm font-semibold" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-400)" }}>Select a result</p>
        <p className="text-xs" style={{ color: "var(--gv-color-neutral-400)" }}>Generate images, videos or train models — click any result to see details here.</p>
      </div>
    );
  }

  if (item.type === "image") {
    const img = item.data;
    const isComplete = ["completed","succeeded"].includes(img.status);
    return (
      <div className="space-y-3">
        <div className="aspect-square overflow-hidden" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-100)" }}>
          {img.image_url
            ? <img src={img.image_url} alt={img.prompt_text} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-4xl">{img.status === "processing" ? "⏳" : "🖼️"}</div>}
        </div>
        <div className="p-3 space-y-2.5" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="gv-badge" style={{ background: isComplete ? "var(--gv-color-success-50)" : "var(--gv-color-warning-50)", color: isComplete ? "var(--gv-color-success-700)" : "var(--gv-color-warning-700)" }}>{img.status}</span>
            {img.ai_model && <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>{img.ai_model}</span>}
            {img.style_preset && <span className="gv-badge" style={{ background: "var(--gv-color-info-50)", color: "var(--gv-color-info-700)" }}>LoRA: {img.style_preset}</span>}
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--gv-color-neutral-500)" }}>PROMPT</p>
            <p className="text-xs leading-relaxed line-clamp-4" style={{ color: "var(--gv-color-neutral-700)" }}>{img.prompt_text}</p>
          </div>
          {img.image_url && (
            <a href={img.image_url} target="_blank" rel="noopener noreferrer"
              className="gv-btn-primary block w-full text-center py-2 text-xs font-semibold">
              ↓ Download Image
            </a>
          )}
        </div>
        <FeedbackSection />
      </div>
    );
  }

  if (item.type === "video") {
    const vid = item.data;
    const topicKey = Object.keys(TOPIC_SOUNDS).find((k) => vid.hook?.toLowerCase().includes(k)) ?? "lifestyle";
    const sounds = TOPIC_SOUNDS[topicKey] ?? TOPIC_SOUNDS.lifestyle;
    const isVidComplete = vid.video_status === "completed";
    return (
      <div className="space-y-3">
        <div className="aspect-video overflow-hidden" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-900)" }}>
          {vid.video_url
            ? <video src={vid.video_url} controls className="w-full h-full" poster={vid.video_thumbnail_url ?? undefined} />
            : <div className="w-full h-full flex flex-col items-center justify-center gap-2"><span className="text-4xl animate-pulse">⏳</span><p className="text-xs" style={{ color: "var(--gv-color-neutral-400)" }}>{vid.video_status ?? "Processing..."}</p></div>}
        </div>
        <div className="p-3 space-y-2.5" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
          <div className="flex gap-2 flex-wrap">
            <span className="gv-badge" style={{ background: isVidComplete ? "var(--gv-color-success-50)" : "var(--gv-color-warning-50)", color: isVidComplete ? "var(--gv-color-success-700)" : "var(--gv-color-warning-700)" }}>{vid.video_status ?? "processing"}</span>
            <span className="gv-badge" style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-500)" }}>{vid.ai_model}</span>
            <span className="gv-badge" style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-500)" }}>{vid.video_aspect_ratio}</span>
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--gv-color-neutral-500)" }}>PROMPT</p>
            <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--gv-color-neutral-700)" }}>{vid.hook}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold mb-1.5" style={{ color: "var(--gv-color-neutral-500)" }}>🎵 RECOMMENDED SOUNDS</p>
            <div className="space-y-1">
              {sounds.map((s) => (
                <div key={s} className="flex items-center gap-2 text-xs" style={{ color: "var(--gv-color-neutral-500)" }}>
                  <span className="text-sm" style={{ color: "var(--gv-color-primary-500)" }}>♪</span> {s}
                </div>
              ))}
            </div>
          </div>
        </div>
        <FeedbackSection />
      </div>
    );
  }

  if (item.type === "model") {
    const m = item.data;
    return (
      <div className="p-4 space-y-4" style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-md)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
            {m.theme === "character" ? <UserIcon className="w-6 h-6" /> : <BoxCubeIcon className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}>{m.dataset_name}</h3>
            <p className="text-xs capitalize" style={{ color: "var(--gv-color-neutral-400)" }}>{m.theme} model · {m.image_count} images</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between"><span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Status</span><span className="text-[10px] font-semibold" style={{ color: m.training_status === "completed" ? "var(--gv-color-success-500)" : "var(--gv-color-warning-500)" }}>{m.training_status}</span></div>
          {m.metadata?.trigger_word && <div className="flex justify-between"><span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Trigger Word</span><span className="text-[10px] font-mono" style={{ color: "var(--gv-color-primary-600)" }}>{m.metadata.trigger_word}</span></div>}
          {m.image_count && <div className="flex justify-between"><span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Training Images</span><span className="text-[10px]" style={{ color: "var(--gv-color-neutral-500)" }}>{m.image_count}</span></div>}
        </div>
        {m.training_status === "completed" && (
          <div className="p-3" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-success-50)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--gv-color-success-700)" }}>✅ Ready to Use</p>
            <p className="text-[10px]" style={{ color: "var(--gv-color-success-500)" }}>Select this model in Generate Image or Video → choose "Trained" mode.</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// BOTTOM FLOATING STUDIO TAB — same pill style as NavColumn
// ══════════════════════════════════════════════════════════════════════════════
const ImageTabIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const VideoTabIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);
const ProductTabIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const CharTabIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const AssetsTabIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);

const STUDIO_TABS: { id: StudioSection; icon: React.ReactNode; label: string }[] = [
  { id: "generate_image",  icon: <ImageTabIcon />,   label: "Image" },
  { id: "generate_video",  icon: <VideoTabIcon />,   label: "Video" },
  { id: "assets",          icon: <AssetsTabIcon />,  label: "Assets" },
];

function BottomStudioTab({ active, onSelect }: { active: StudioSection; onSelect: (s: StudioSection) => void }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: "var(--gv-radius-2xl)",
        border: "1px solid var(--gv-color-glass-border)",
        background: "var(--gv-color-glass-bg)",
        backdropFilter: `blur(var(--gv-blur-lg))`,
        WebkitBackdropFilter: `blur(var(--gv-blur-lg))`,
        boxShadow: "var(--gv-shadow-sidebar)",
      }}
    >
      <div className="flex items-center px-3 py-2 gap-1">
        {STUDIO_TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className="flex items-center gap-2 h-10 px-4 transition-all duration-200"
              style={{
                borderRadius: "var(--gv-radius-full)",
                background: isActive ? "var(--gv-color-primary-50)" : "transparent",
                color: isActive ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-700)",
                border: isActive ? "1px solid rgba(95,143,139,0.3)" : "1px solid transparent",
              }}
            >
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {tab.icon}
              </span>
              <span className="text-[13px] font-[550] whitespace-nowrap leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORY RIGHT PANEL — right column showing generated images & videos
// ══════════════════════════════════════════════════════════════════════════════
function HistoryRight({ brandId, historyKey, activeSection, onSelect }: {
  brandId: string;
  historyKey: number;
  activeSection: StudioSection;
  onSelect: (item: DetailItem) => void;
}) {
  const defaultTab = activeSection === "generate_video" ? "videos" : "images";
  const [tab, setTab] = useState<"images" | "videos" | "models">(defaultTab);
  useEffect(() => {
    if (activeSection === "generate_video") setTab("videos");
    else if (activeSection === "generate_image") setTab("images");
  }, [activeSection]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studioFetch({ action: "get_history", brand_id: brandId, type: "all", limit: 30 })
      .then((r) => {
        if (r.success) {
          setImages(r.images ?? []);
          setVideos(r.videos ?? []);
          setModels(r.trainings ?? []);
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, historyKey]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}>
        <h3 className="text-[16px] font-bold" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}>
          History
        </h3>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>Generated images, videos & models</p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex" style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}>
        {([
          { id: "images" as const, icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Images", count: images.length },
          { id: "videos" as const, icon: <VideoIcon className="w-3.5 h-3.5" />, label: "Videos", count: videos.length },
          { id: "models" as const, icon: <AiIcon className="w-3.5 h-3.5" />, label: "Models", count: models.length },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors"
            style={{
              color: tab === t.id ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-400)",
              borderBottom: tab === t.id ? "2px solid var(--gv-color-primary-500)" : "2px solid transparent",
            }}
          >
            {t.icon}
            <span>{t.label} {t.count > 0 && <span style={{ opacity: 0.7 }}>({t.count})</span>}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "var(--gv-color-primary-500)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* Images grid */}
        {!loading && tab === "images" && (
          images.length === 0
            ? <p className="text-center text-[12px] py-8" style={{ color: "var(--gv-color-neutral-400)" }}>No generated images yet</p>
            : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => onSelect({ type: "image", data: img })}
                    className="aspect-square overflow-hidden transition-all"
                    style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-100)" }}
                  >
                    {img.image_url
                      ? <img src={img.image_url} alt={img.prompt_text} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><span className="text-[10px] font-medium" style={{ color: "var(--gv-color-neutral-400)" }}>{img.status === "processing" ? "..." : "—"}</span></div>}
                  </button>
                ))}
              </div>
            )
        )}

        {/* Videos list */}
        {!loading && tab === "videos" && (
          videos.length === 0
            ? <p className="text-center text-[12px] py-8" style={{ color: "var(--gv-color-neutral-400)" }}>No generated videos yet</p>
            : (
              <div className="space-y-2">
                {videos.map((vid) => (
                  <button
                    key={vid.id}
                    onClick={() => onSelect({ type: "video", data: vid })}
                    className="w-full flex items-center gap-3 p-3 text-left transition-colors"
                    style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)" }}
                  >
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ borderRadius: "var(--gv-radius-xs)", background: "var(--gv-color-neutral-100)" }}>
                      {vid.video_thumbnail_url
                        ? <img src={vid.video_thumbnail_url} alt="" className="w-full h-full object-cover" style={{ borderRadius: "var(--gv-radius-xs)" }} />
                        : <VideoIcon className="w-4 h-4" style={{ color: "var(--gv-color-neutral-400)" }} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>{vid.hook}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{vid.ai_model} · {vid.video_aspect_ratio} · {vid.video_status}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
        )}

        {/* Models list */}
        {!loading && tab === "models" && (
          models.length === 0
            ? <p className="text-center text-[12px] py-8" style={{ color: "var(--gv-color-neutral-400)" }}>No trained models yet</p>
            : (
              <div className="space-y-2">
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelect({ type: "model", data: m })}
                    className="w-full flex items-center gap-3 p-3 text-left transition-colors"
                    style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)" }}
                  >
                    <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
                      {m.theme === "character" ? <UserIcon className="w-4 h-4" /> : <BoxCubeIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>{m.dataset_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium" style={{ color: m.training_status === "completed" ? "var(--gv-color-success-500)" : "var(--gv-color-warning-500)" }}>{m.training_status}</span>
                        <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>· {m.image_count} images</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ContentStudioPage() {
  const [brandId, setBrandId] = useState(FALLBACK_BRAND_ID);
  const [currentTier, setCurrentTier] = useState("basic");
  const [activeSection, setActiveSection] = useState<StudioSection>("generate_image");
  const [assetSubSection, setAssetSubSection] = useState<AssetSubSection | null>(null);
  const [trainedModels, setTrainedModels] = useState<TrainedModel[]>([]);
  const [historyImages, setHistoryImages] = useState<GeneratedImage[]>([]);
  const [imagesUsedToday, setImagesUsedToday] = useState(0);
  const [videosUsedToday, setVideosUsedToday] = useState(0);
  const [avatarsUsedThisMonth, setAvatarsUsedThisMonth] = useState(0);
  const [detailItem, setDetailItem] = useState<DetailItem>(null);
  const [showGeneratingPopup, setShowGeneratingPopup] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  // Auth + brand
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: ub } = await supabase.from("user_brands").select("brand_id").eq("user_id", user.id).limit(1).single();
      if (ub?.brand_id) setBrandId(ub.brand_id);
    });
  }, []);

  // Subscription tier
  useEffect(() => {
    if (!brandId) return;
    fetch("/api/payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_subscription", brand_id: brandId }),
    }).then((r) => r.json()).then((d) => { if (d?.subscription?.plan) setCurrentTier(d.subscription.plan); });
  }, [brandId]);

  // Daily usage
  const refreshUsage = useCallback(() => {
    if (!brandId) return;
    studioFetch({ action: "check_daily_usage", brand_id: brandId })
      .then((r) => { if (r.success) { setImagesUsedToday(r.images_today ?? 0); setVideosUsedToday(r.videos_today ?? 0); setAvatarsUsedThisMonth(r.avatar_videos_this_month ?? 0); } })
      .catch(() => { /* quota display fails silently — non-critical */ });
  }, [brandId]);

  useEffect(() => { refreshUsage(); }, [refreshUsage]);

  // Trained models
  useEffect(() => {
    if (!brandId) return;
    studioFetch({ action: "get_history", brand_id: brandId, type: "training", limit: 50 })
      .then((r) => { if (r.success) setTrainedModels(r.trainings ?? []); })
      .catch(() => { /* non-critical */ });
  }, [brandId]);

  // History images (for video reference)
  useEffect(() => {
    if (!brandId) return;
    studioFetch({ action: "get_history", brand_id: brandId, type: "image", limit: 20 })
      .then((r) => { if (r.success) setHistoryImages(r.images ?? []); })
      .catch(() => { /* non-critical */ });
  }, [brandId]);

  const completedModels = trainedModels.filter((m) => m.training_status === "completed");
  const totalModelCount = trainedModels.length;

  const handleGenerateStart = () => setShowGeneratingPopup(true);

  const ASSET_OPTIONS: { id: AssetSubSection; icon: React.ReactNode; label: string; desc: string }[] = [
    { id: "design_system",  icon: <BrandIcon className="w-5 h-5" />,    label: "Design System",       desc: "Brand guidelines & visual identity" },
    { id: "product",        icon: <BoxTapped className="w-5 h-5" />,    label: "Product Training",    desc: "LoRA · 4-side product upload" },
    { id: "character",      icon: <CreatorIcon className="w-5 h-5" />,  label: "Character Training",  desc: "LoRA · persona model" },
  ];

  const wizardContent = () => {
    switch (activeSection) {
      case "generate_image":
        return (
          <GenerateImageWizard
            brandId={brandId} currentTier={currentTier} imagesUsedToday={imagesUsedToday}
            trainedModels={completedModels}
            onResult={(img) => { setHistoryImages((p) => [img, ...p]); setHistoryKey((k) => k + 1); }}
            onUsed={() => setImagesUsedToday((c) => c + 1)}
            onGenerateStart={handleGenerateStart}
          />
        );
      case "generate_video":
        return (
          <GenerateVideoWizard
            brandId={brandId} currentTier={currentTier} videosUsedToday={videosUsedToday}
            avatarsUsedThisMonth={avatarsUsedThisMonth}
            trainedModels={completedModels} historyImages={historyImages}
            onResult={() => setHistoryKey((k) => k + 1)}
            onUsed={() => setVideosUsedToday((c) => c + 1)}
            onGenerateStart={handleGenerateStart}
          />
        );
      case "assets":
        if (!assetSubSection) {
          return (
            <div className="space-y-3">
              {ASSET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAssetSubSection(opt.id)}
                  className="w-full flex items-center gap-4 p-4 text-left transition-all"
                  style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}
                >
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-neutral-50)", color: "var(--gv-color-primary-500)" }}>
                    {opt.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>{opt.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{opt.desc}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--gv-color-neutral-300)", flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          );
        }
        if (assetSubSection === "design_system") {
          return (
            <div className="space-y-4">
              <button onClick={() => setAssetSubSection(null)} className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gv-color-primary-500)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to Assets
              </button>
              <div className="p-6 text-center" style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-primary-50)", border: "1px solid var(--gv-color-primary-200)" }}>
                <div className="inline-flex items-center justify-center w-14 h-14 mb-3" style={{ borderRadius: "var(--gv-radius-md)", background: "var(--gv-color-primary-100)", color: "var(--gv-color-primary-600)" }}>
                  <BrandIcon className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}>Design System</h3>
                <p className="text-xs" style={{ color: "var(--gv-color-neutral-500)" }}>Brand guidelines, color palette, typography, and visual identity assets will be managed here.</p>
                <p className="text-[10px] mt-3" style={{ color: "var(--gv-color-neutral-400)" }}>Coming soon</p>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <button onClick={() => setAssetSubSection(null)} className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gv-color-primary-500)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back to Assets
            </button>
            <TrainingWizard
              brandId={brandId}
              trainingType={assetSubSection === "product" ? "product" : "character"}
              currentTier={currentTier}
              totalModelCount={totalModelCount}
              pastDatasets={trainedModels}
              onDone={(m) => { setTrainedModels((p) => [...p, m]); setHistoryKey((k) => k + 1); }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  /* ── Active tab label for center header ── */
  const activeTabLabel = STUDIO_TABS.find((t) => t.id === activeSection)?.label ?? "Studio";

  return (
    <div className="flex flex-col h-full">
      {/* ── Three-column layout — shrinks to fit above nav ── */}
      <div className="flex-1 min-h-0">
      <ThreeColumnLayout
        left={<NavColumn />}
        center={
          <div className="h-full flex flex-col overflow-hidden">
            {detailItem ? (
              /* ── DETAIL VIEW ── */
              <>
                {/* Back bar */}
                <div
                  className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
                  style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}
                >
                  <button
                    onClick={() => setDetailItem(null)}
                    className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors"
                    style={{ color: "var(--gv-color-primary-500)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to {activeTabLabel}
                  </button>
                </div>
                {/* Detail content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  <DetailPanel item={detailItem} brandId={brandId} />
                </div>
              </>
            ) : (
              /* ── WIZARD VIEW ── */
              <>
                {/* Header */}
                <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}>
                  <h3
                    className="text-[16px] font-bold"
                    style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}
                  >
                    {activeTabLabel} {activeSection === "generate_image" ? "Generation" : activeSection === "generate_video" ? "Generation" : activeSection === "assets" ? "Library" : ""}
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>
                    {activeSection === "generate_image" && "Powered by KIE Flux AI"}
                    {activeSection === "generate_video" && "Powered by KIE Kling AI"}
                    {activeSection === "assets" && "Design system · product · character training"}
                  </p>
                </div>
                {/* Wizard scrollable content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  {wizardContent()}
                </div>
              </>
            )}
          </div>
        }
        right={
          <HistoryRight
            brandId={brandId}
            historyKey={historyKey}
            activeSection={activeSection}
            onSelect={(item) => setDetailItem(item)}
          />
        }
      />
      </div>

      {/* ── Bottom tab bar — outside columns, flush at bottom ── */}
      <nav
        className="flex-shrink-0 flex justify-center pt-0 pb-4"
        style={{ background: "var(--gv-color-bg-base)" }}
      >
        <BottomStudioTab active={activeSection} onSelect={(s) => { setActiveSection(s); setDetailItem(null); setAssetSubSection(null); }} />
      </nav>

      {/* Generating popup */}
      {showGeneratingPopup && <GeneratingPopup onClose={() => setShowGeneratingPopup(false)} />}
    </div>
  );
}
