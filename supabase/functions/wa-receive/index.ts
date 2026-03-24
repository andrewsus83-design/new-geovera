import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// wa-receive v28 — Interactive menus with 2-level selection (1. manual / 2a, 2b, 3a...)
// Content gen (ARTIKEL/GAMBAR/VIDEO menu) ONLY triggers via @GeoveraAI mention in group

const BASE_URL   = 'https://vozjwptzutolvkvfpknk.supabase.co/functions/v1';
const FONNTE_URL = 'https://api.fonnte.com/send';

async function sendWA(to: string, message: string, token: string) {
  try {
    const isGroup = to.includes('@g.us') || to.includes('-');
    const params: Record<string, string> = { target: to, message, delay: '0' };
    if (!isGroup) params.countryCode = '62';
    const res = await fetch(FONNTE_URL, { method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
    console.log(`[sendWA] to:${to} status:${res.status}`);
  } catch (e) { console.error('sendWA error:', e); }
}

function resolveToken(stored: string | null, fallback: string): string {
  if (!stored) return fallback;
  if (/^[A-Z][A-Z0-9_]+$/.test(stored)) return Deno.env.get(stored) ?? fallback;
  return stored;
}

function parseCommand(text: string): { cmd: string; arg?: string; num?: number } {
  const cleaned = text.trim().replace(/^(@\S+\s*)+/i, '').trim();
  const t = cleaned || text.trim(); const tup = t.toUpperCase();
  // Session reply: "3 topik saya" or "3. topik saya" (any digit + space/dot + text) → manual input
  if (/^[1-9][\. ]\s*\S/.test(t) && !/^(\d)([a-f])$/i.test(t)) { const m = t.match(/^[1-9][\. ]\s*(.+)/i); if (m) return { cmd: 'MANUAL_INPUT', arg: m[1].trim() }; }
  // Session reply: "2a", "2b", "3c" etc → section pick
  if (/^(\d)([a-f])$/i.test(t)) { const m = t.match(/^(\d)([a-f])$/i)!; return { cmd: 'SECTION_PICK', num: parseInt(m[1]), arg: m[2].toLowerCase() }; }
  if (/^(DONE|D)\s*(\d+)$/i.test(t))  { const m = t.match(/(\d+)/); return { cmd: 'DONE',  num: m ? parseInt(m[1]) : undefined }; }
  if (/^\d+$/.test(t))                 return { cmd: 'DONE',  num: parseInt(t) };
  if (/^(SKIP|S)\s*(\d+)$/i.test(t))  { const m = t.match(/(\d+)/); return { cmd: 'SKIP',  num: m ? parseInt(m[1]) : undefined }; }
  if (/^(TUNDA|T)\s*(\d+)$/i.test(t)) { const m = t.match(/(\d+)/); return { cmd: 'TUNDA', num: m ? parseInt(m[1]) : undefined }; }
  if (/^APPROVE(\s+[A-Z0-9]+)?$/i.test(t)) { const m = t.match(/APPROVE\s+([A-Z0-9]+)/i); return { cmd: 'APPROVE', arg: m ? m[1].toUpperCase() : undefined }; }
  if (/^(REJECT|TOLAK)(\s+.*)?$/i.test(t)) { const m = t.match(/(?:REJECT|TOLAK)\s*(.*)/i); return { cmd: 'REJECT', arg: m?.[1]?.trim() || 'Tidak sesuai' }; }
  if (/^(REVISI|REVISE)(\s+.*)?$/i.test(t)) { const m = t.match(/(?:REVISI|REVISE)\s*(.*)/i); return { cmd: 'REVISI', arg: m?.[1]?.trim() || '' }; }
  if (/^QUEUE(\s+.*)?$/i.test(t)) return { cmd: 'QUEUE' };
  if (/^LAPORAN(\s+.*)?$/i.test(t)) return { cmd: 'LAPORAN' };
  // Content generation — with topic → direct generate; without → show menu
  // Strip all @mentions from extracted arg to prevent mention text leaking into topic
  if (/\b(ARTIKEL|ARTICLE|BUATKAN?\s+ARTIKEL|BUAT\s+ARTIKEL)\b/i.test(t)) {
    const m = t.match(/\b(?:ARTIKEL|ARTICLE)\s+(.+)/i);
    if (m) { const arg = m[1].trim().replace(/@\S+/g, '').trim(); if (arg) return { cmd: 'GEN_ARTICLE', arg }; }
    return { cmd: 'GEN_ARTICLE_MENU' };
  }
  if (/\b(GAMBAR|IMAGE|BUATKAN?\s+GAMBAR|BUAT\s+GAMBAR)\b/i.test(t)) {
    const m = t.match(/\b(?:GAMBAR|IMAGE)\s+(.+)/i);
    if (m) { const arg = m[1].trim().replace(/@\S+/g, '').trim(); if (arg) return { cmd: 'GEN_IMAGE', arg }; }
    return { cmd: 'GEN_IMAGE_MENU' };
  }
  if (/\b(VIDEO|BUATKAN?\s+VIDEO|BUAT\s+VIDEO)\b/i.test(t) && !/^(DONE|SKIP|TUNDA|APPROVE|REJECT)/i.test(t)) {
    const m = t.match(/\bVIDEO\s+(.+)/i);
    if (m) { const arg = m[1].trim().replace(/@\S+/g, '').trim(); if (arg) return { cmd: 'GEN_VIDEO', arg }; }
    return { cmd: 'GEN_VIDEO_MENU' };
  }
  if (tup === 'HELP' || tup === 'BANTUAN') return { cmd: 'HELP' };
  if (tup === 'STATUS' || tup === 'STAT')  return { cmd: 'STATUS' };
  if (tup === 'TASKS' || tup === 'LIST')   return { cmd: 'TASKS' };
  return { cmd: 'UNKNOWN' };
}

function isAgentMsg(msg: string, botPrefix: string, internalIds: string[], demoMode: boolean, isGroup: boolean): boolean {
  if (demoMode && isGroup) return true;
  if (new RegExp(`@${botPrefix}`, 'i').test(msg)) return true;
  if (/@geovera/i.test(msg)) return true;
  for (const id of internalIds) { if (id && msg.includes(`@${id}`)) return true; }
  const EMOJIS = ['\u274c','\u23f0','\u23ed\ufe0f','\u2705','\ud83d\udc4d','\ud83d\udd34'];
  if (EMOJIS.includes(msg.trim())) return false;
  if (msg.trim().length > 10) { const { cmd } = parseCommand(msg); if (cmd === 'UNKNOWN') return true; }
  return false;
}

async function isAuthorized(supabase: ReturnType<typeof createClient>, brandId: string, waNumber: string): Promise<{ authorized: boolean; name: string; role: string }> {
  const { data: bu } = await supabase.from('brand_users').select('name, role, is_active').eq('brand_id', brandId).eq('wa_number', waNumber).eq('is_active', true).maybeSingle();
  if (bu) return { authorized: true, name: bu.name || waNumber, role: bu.role || 'viewer' };
  const { data: wgm } = await supabase.from('wa_group_members').select('name, role, is_active').eq('brand_id', brandId).eq('wa_number', waNumber).eq('is_active', true).maybeSingle();
  if (wgm) return { authorized: true, name: wgm.name || waNumber, role: wgm.role || 'viewer' };
  const { data: brand } = await supabase.from('brands').select('wa_number').eq('id', brandId).maybeSingle();
  if (brand?.wa_number === waNumber) return { authorized: true, name: 'Owner', role: 'owner' };
  return { authorized: false, name: '', role: '' };
}

// ─── Session types ─────────────────────────────────────────────────────────────
interface ContentOption  { label: string; prompt: string; source?: string; source_id?: string; length?: string; }
interface ContentSection { num: number; label: string; opts: ContentOption[]; }
interface SessionData    { session_type: string; sections: ContentSection[]; }

async function getActiveSession(supabase: ReturnType<typeof createClient>, brandId: string, groupId: string): Promise<(SessionData & { id: string }) | null> {
  const { data } = await supabase
    .from('wa_content_sessions')
    .select('id, options')
    .eq('brand_id', brandId)
    .eq('group_id', groupId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const opts = data.options as SessionData;
  return { id: (data as Record<string,unknown>).id as string, ...opts };
}

async function saveSession(supabase: ReturnType<typeof createClient>, brandId: string, waNumber: string, groupId: string, sessionData: SessionData): Promise<void> {
  await supabase.from('wa_content_sessions').delete().eq('brand_id', brandId).eq('group_id', groupId);
  await supabase.from('wa_content_sessions').insert({
    brand_id: brandId, wa_number: waNumber, group_id: groupId,
    session_type: sessionData.session_type,
    options: sessionData,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}

async function deleteSession(supabase: ReturnType<typeof createClient>, sessionId: string): Promise<void> {
  await supabase.from('wa_content_sessions').delete().eq('id', sessionId);
}

// ─── Menu builders ─────────────────────────────────────────────────────────────
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

async function getTaskTopics(supabase: ReturnType<typeof createClient>, brandId: string, ctKeywords: string[]): Promise<ContentOption[]> {
  const { data } = await supabase.from('gv_tasks').select('id, title, content_type').eq('brand_id', brandId).in('status', ['pending', 'active', 'todo']).order('priority_score', { ascending: false }).limit(10);
  if (!data || data.length === 0) return [];
  return (data as Record<string, unknown>[])
    .filter(t => { const ct = String(t.content_type ?? '').toLowerCase(); return ctKeywords.some(k => ct.includes(k)); })
    .slice(0, 5)
    .map(t => ({ label: String(t.title ?? '').slice(0, 80), prompt: String(t.title ?? ''), source: 'task', source_id: String(t.id) }));
}

function buildMenuText(sessionType: string, sections: ContentSection[], hint: string): string {
  const lines: string[] = [`Silahkan memilih opsi di bawah:`];
  for (const sec of sections) {
    lines.push(``, `*${sec.num}.* ${sec.label}:`);
    sec.opts.forEach((o, i) => lines.push(`   ${ALPHA[i]}. ${o.label}`));
  }
  const manualNum = (sections[sections.length - 1]?.num ?? 0) + 1;
  lines.push(``, `*${manualNum}.* Topik manual — ketik: *${manualNum} [deskripsi]*`);
  lines.push(``, `Contoh balas: *1a*, *1b*, *2a* atau *${manualNum} ${hint}*`);
  return lines.join('\n');
}

async function buildArticleMenu(supabase: ReturnType<typeof createClient>, brandId: string, brandName: string): Promise<{ menu: string; sessionData: SessionData }> {
  const taskTopics = await getTaskTopics(supabase, brandId, ['artikel', 'article', 'blog', 'konten', 'content', 'tulisan']);
  const rawTopics = taskTopics.length > 0 ? taskTopics.slice(0, 3) : [
    { label: `Tips ${brandName} untuk pemula`, prompt: `Tips ${brandName} untuk pemula`, source: 'suggested' },
    { label: `Tren terbaru di industri ${brandName}`, prompt: `Tren terbaru di industri ${brandName}`, source: 'suggested' },
    { label: `FAQ seputar ${brandName}`, prompt: `FAQ seputar ${brandName}`, source: 'suggested' },
  ];
  const defaultTopic = rawTopics[0]?.prompt || brandName;
  const lengthOpts: ContentOption[] = [
    { label: 'Short (s/d 500 karakter, cocok untuk X/LinkedIn)', prompt: defaultTopic, length: 'short' },
    { label: 'Medium (s/d 800 kata)', prompt: defaultTopic, length: 'medium' },
    { label: 'Long (s/d 1500 kata)', prompt: defaultTopic, length: 'long' },
    { label: 'Very Long (s/d 3000 kata)', prompt: defaultTopic, length: 'very_long' },
  ];
  const topicOpts: ContentOption[] = rawTopics.map(t => ({ ...t, label: `"${t.label}"` }));
  const sections: ContentSection[] = [
    { num: 1, label: 'Pilih panjang artikel', opts: lengthOpts },
    { num: 2, label: 'Pilih topik rekomendasi hari ini', opts: topicOpts },
  ];
  const sessionData: SessionData = { session_type: 'artikel', sections };
  return { menu: buildMenuText('artikel', sections, `tips jualan online`), sessionData };
}

async function buildImageMenu(supabase: ReturnType<typeof createClient>, brandId: string, brandName: string): Promise<{ menu: string; sessionData: SessionData }> {
  const taskTopics = await getTaskTopics(supabase, brandId, ['gambar', 'image', 'visual', 'foto', 'photo', 'desain', 'grafis', 'banner', 'poster']);
  const { data: recentArticles } = await supabase.from('gv_article_generations').select('id, topic').eq('brand_id', brandId).not('article_url', 'is', null).order('created_at', { ascending: false }).limit(5);

  const rawTopics = taskTopics.length > 0 ? taskTopics.slice(0, 3) : [
    { label: `Visual produk ${brandName}`, prompt: `Professional product photo for ${brandName}, clean white background, high quality`, source: 'suggested' },
    { label: `Konten promo ${brandName}`, prompt: `Modern promotional social media graphic for ${brandName}, vibrant colors`, source: 'suggested' },
    { label: `Behind the scenes ${brandName}`, prompt: `Behind the scenes authentic photo for ${brandName}, candid and professional`, source: 'suggested' },
  ];
  const topicOpts: ContentOption[] = rawTopics.map(t => ({ ...t, label: `Topik "${t.label}"` }));

  const sections: ContentSection[] = [{ num: 2, label: 'Pilih topik yang direkomendasikan hari ini', opts: topicOpts }];

  const articleOpts: ContentOption[] = ((recentArticles ?? []) as Record<string, unknown>[]).slice(0, 3).map(a => ({
    label: `Judul artikel "${String(a.topic ?? 'Artikel terbaru').slice(0, 60)}"`,
    prompt: `Create a compelling featured image for article: "${String(a.topic ?? '')}". Professional, eye-catching, suitable for blog and social media`,
    source: 'article',
    source_id: String(a.id),
  }));
  if (articleOpts.length > 0) sections.push({ num: 3, label: 'Gambar untuk artikel terbaru', opts: articleOpts });

  const sessionData: SessionData = { session_type: 'gambar', sections };
  return { menu: buildMenuText('gambar', sections, `foto produk background putih`), sessionData };
}

async function buildVideoMenu(supabase: ReturnType<typeof createClient>, brandId: string, brandName: string): Promise<{ menu: string; sessionData: SessionData }> {
  const taskTopics = await getTaskTopics(supabase, brandId, ['video', 'reel', 'tiktok', 'short', 'cinematic']);
  const [{ data: recentArticles }, { data: recentImages }] = await Promise.all([
    supabase.from('gv_article_generations').select('id, topic').eq('brand_id', brandId).not('article_url', 'is', null).order('created_at', { ascending: false }).limit(4),
    supabase.from('gv_image_generations').select('id, prompt_text').eq('brand_id', brandId).not('image_url', 'is', null).order('created_at', { ascending: false }).limit(4),
  ]);

  const rawTopics = taskTopics.length > 0 ? taskTopics.slice(0, 3) : [
    { label: `Video promo ${brandName}`, prompt: `Cinematic promotional video showcasing ${brandName} products, modern and energetic`, source: 'suggested' },
    { label: `Brand story ${brandName}`, prompt: `Brand story video for ${brandName}, authentic and inspiring narrative`, source: 'suggested' },
    { label: `Tutorial ${brandName}`, prompt: `Step-by-step tutorial video for ${brandName}, clear and professional`, source: 'suggested' },
  ];
  const topicOpts: ContentOption[] = rawTopics.map(t => ({ ...t, label: `Topik "${t.label}"` }));

  const sections: ContentSection[] = [{ num: 2, label: 'Pilih topik yang direkomendasikan hari ini', opts: topicOpts }];

  const articleOpts: ContentOption[] = ((recentArticles ?? []) as Record<string, unknown>[]).slice(0, 3).map(a => ({
    label: `Judul artikel "${String(a.topic ?? 'Artikel terbaru').slice(0, 55)}"`,
    prompt: `Cinematic video based on article: "${String(a.topic ?? '')}". Visual storytelling, engaging and professional`,
    source: 'article',
    source_id: String(a.id),
  }));
  if (articleOpts.length > 0) sections.push({ num: 3, label: 'Video dari artikel terbaru', opts: articleOpts });

  const imageOpts: ContentOption[] = ((recentImages ?? []) as Record<string, unknown>[]).slice(0, 3).map(img => ({
    label: `Gambar "${String(img.prompt_text ?? 'Gambar terbaru').slice(0, 55)}"`,
    prompt: String(img.prompt_text ?? `Cinematic video for ${brandName}`),
    source: 'image_set',
    source_id: String(img.id),
  }));
  if (imageOpts.length > 0) sections.push({ num: (sections[sections.length - 1]?.num ?? 1) + 1, label: 'Video dari gambar tersedia', opts: imageOpts });

  const sessionData: SessionData = { session_type: 'video', sections };
  return { menu: buildMenuText('video', sections, `video promo produk terbaru ${brandName}`), sessionData };
}

// ─── Content generation fire-and-forget ───────────────────────────────────────
async function fireContentGeneration(params: {
  cmd: 'GEN_ARTICLE' | 'GEN_IMAGE' | 'GEN_VIDEO';
  prompt: string;
  brandId: string;
  brandName: string;
  replyTo: string;
  token: string;
  memberName: string;
  waNumber: string;
  supabase: ReturnType<typeof createClient>;
  deviceNumber: string;
  isGroup: boolean;
  length?: string;
}) {
  const { cmd, prompt, brandId, brandName, replyTo, token, memberName, waNumber, supabase, deviceNumber, isGroup, length } = params;
  const actionMap: Record<string, { action: string; emoji: string; label: string }> = {
    GEN_ARTICLE: { action: 'generate_article', emoji: '📝', label: 'artikel' },
    GEN_IMAGE:   { action: 'generate_image',   emoji: '🎨', label: 'gambar' },
    GEN_VIDEO:   { action: 'generate_video',   emoji: '🎬', label: 'video' },
  };
  const { action, emoji, label } = actionMap[cmd];
  const waitMsg = cmd === 'GEN_VIDEO'
    ? `${emoji} _Sedang generate ${label}: "${prompt.slice(0, 80)}"..._\n\n_Video pipeline: Scene Director → Flux Schnell → Quality Gate → Flux Dev → Runway Gen4 → Smart Loop.\nEstimasi 3-5 menit. Hasil akan dikirim otomatis ke group ini._`
    : `${emoji} _Sedang generate ${label}: "${prompt.slice(0, 80)}"..._\n\n_Mohon tunggu, proses ini memakan waktu beberapa menit._`;
  await sendWA(replyTo, waitMsg, token);

  const csPayload: Record<string, unknown> = { action, brand_id: brandId, prompt, wa_callback: replyTo, wa_token: token, requested_by: memberName || waNumber };
  if (cmd === 'GEN_ARTICLE') { csPayload.topic = prompt; csPayload.objective = 'random'; csPayload.length = length || 'medium'; }
  if (cmd === 'GEN_IMAGE')   { csPayload.aspect_ratio = '1:1'; csPayload.num_images = 1; }
  if (cmd === 'GEN_VIDEO')   { csPayload.aspect_ratio = '16:9'; }

  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const csUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/content-studio-handler`;
  fetch(csUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${svcKey}`, 'apikey': svcKey }, body: JSON.stringify(csPayload) })
    .then(async (res) => {
      const result = await res.json().catch(() => ({}));
      // Background mode: content-studio-handler runs EdgeRuntime.waitUntil and sends WA reply directly
      if (result?.status === 'background') {
        console.log(`[fireContent] bg task started db_id:${result.db_id}`);
        return;
      }
      const fnErr = res.ok ? null : { message: result.error || `HTTP ${res.status}` };
      if (!fnErr && result && result.ok !== false) {
        const Label = label.charAt(0).toUpperCase() + label.slice(1);
        let successMsg = `${emoji} *${Label} berhasil di-generate!*`;
        if (result.url)         successMsg += `\n\n🔗 ${result.url}`;
        if (result.article_url) successMsg += `\n\n🔗 ${result.article_url}`;
        if (result.images && Array.isArray(result.images) && result.images.length > 0) {
          successMsg += `\n\n🖼️ *${result.images.length} gambar:*`;
          result.images.slice(0, 4).forEach((img: Record<string,string>, i: number) => { if (img?.url) successMsg += `\n${i+1}. ${img.url}`; });
          if (result.images.length > 4) successMsg += `\n_...dan ${result.images.length - 4} lainnya_`;
        }
        if (result.video_url) successMsg += `\n\n🎬 ${result.video_url}`;
        if (result.job_id)    successMsg += `\n\n⏳ _Video sedang diproses (${result.job_id}), akan dikirim setelah selesai._`;
        if (!result.url && !result.article_url && !result.images && !result.video_url && !result.job_id) successMsg += `\n\n_Konten tersimpan di dashboard._`;
        await sendWA(replyTo, successMsg, token);
      } else {
        const errMsg = fnErr?.message || (result && (result.error || result.message)) || 'Unknown error';
        await sendWA(replyTo, `❌ Gagal generate ${label}: ${errMsg}`, token);
      }
    })
    .catch(async (err: Error) => { await sendWA(replyTo, `❌ Error generate ${label}: ${err.message}`, token); });

  await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'out', message: `[${cmd}] ${prompt.slice(0,200)}`, command: cmd.toLowerCase(), device_number: deviceNumber||null, group_id: isGroup?replyTo:null, processed: true, received_at: new Date().toISOString() });
}

// ─── Main serve ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, service: 'wa-receive v28' }), { headers: { 'Content-Type': 'application/json' } });
  let p: Record<string, unknown> = {};
  try { const raw = await req.text(); try { p = JSON.parse(raw); } catch { p = Object.fromEntries(new URLSearchParams(raw)); } } catch { return new Response('PARSE_FAIL'); }
  const debugMode = req.headers.get('x-debug') === 'true';
  if (debugMode) {
    try { const result = await handleMessage(p); return new Response(JSON.stringify({ ok: true, debug: result, keys: Object.keys(p) }), { headers: { 'Content-Type': 'application/json' } }); }
    catch (e: unknown) { return new Response(JSON.stringify({ ok: false, error: (e as Error).message, stack: (e as Error).stack, keys: Object.keys(p) }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
  }
  const promise = handleMessage(p).catch(e => console.error('wa-receive err:', e));
  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined') { EdgeRuntime.waitUntil(promise); }
  return new Response('OK', { status: 200 });
});

async function handleMessage(p: Record<string, unknown>) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const FONNTE_TOKEN = Deno.env.get('FONNTE_TOKEN')!;

  const rawIsGroup  = p.isgroup ?? p.isGroup ?? p.is_group ?? false;
  const isGroup     = rawIsGroup === true || rawIsGroup === 'true' || rawIsGroup === '1';
  const senderField = String(p.sender ?? p.pengirim ?? '');
  const memberField = String(p.member ?? p.from ?? '');
  const waNumber    = isGroup ? memberField.replace(/[^0-9]/g, '') : senderField.replace(/[^0-9]/g, '');
  const replyTo     = isGroup ? senderField : waNumber;
  const message     = String(p.message ?? p.pesan ?? p.text ?? p.msg ?? '');
  const message_id  = String(p.id ?? p.inboxid ?? '');
  const deviceNumber = String(p.device ?? '').replace(/[^0-9]/g, '');

  console.log(`[recv] isGroup:${isGroup} from:${waNumber} replyTo:${replyTo} device:${deviceNumber} msg:"${message.slice(0,60)}" raw_keys:${Object.keys(p).join(',')}`);
  if (!waNumber || !message) return;

  // GROUP RULE: Only process messages with "@" mention
  // Exception: session replies (bare numbers, "2a", "1. topik") don't need @mention
  const isSessionReply = /^[1-9][\. ]\s*\S/.test(message.trim()) || /^\d[a-f]$/i.test(message.trim()) || /^\d+$/.test(message.trim());
  if (isGroup && !message.includes('@') && !isSessionReply) { console.log('[skip] No @ mention in group'); return; }

  const rawStatus = String(p.status ?? '');
  if (rawStatus && ['sent','delivered','read','failed','pending'].includes(rawStatus.toLowerCase())) { console.log(`[skip] Fonnte status: ${rawStatus}`); return; }
  if (p.fromMe === true || p.fromMe === 'true' || p.self === true || p.self === 'true') { console.log('[skip] fromMe echo'); return; }

  const { data: allDevices } = await supabase.from('wa_devices').select('device_number, fonnte_token, brand_id, forced_agent, group_only, wa_internal_id, demo_mode, is_active').eq('is_active', true);
  const allDeviceNums = (allDevices ?? []).map(d => String(d.device_number));

  if (!isGroup && allDeviceNums.includes(waNumber)) { console.log(`[skip] Bot device echo: ${waNumber}`); return; }
  if (message.includes('fonnte.com') || message.includes('Sent via fonnte')) { console.log('[skip] Fonnte signature echo'); return; }
  const BOT_PATTERNS = ['_Sedang generate', '✅ *', '❌ Gagal', 'Pilih opsi di bawah ini', 'Sedang generate laporan', 'Balas dengan *"1.'];
  if (BOT_PATTERNS.some(pat => message.includes(pat))) { console.log('[skip] Bot pattern echo'); return; }

  const devices     = (allDevices ?? []) as Array<Record<string, unknown>>;
  const dev         = devices.find(d => d.device_number === deviceNumber) || devices[0];
  const token       = resolveToken(dev?.fonnte_token as string | null, FONNTE_TOKEN);
  const internalIds = devices.map(d => d.wa_internal_id as string).filter(Boolean);
  const demoMode    = dev?.demo_mode === true;

  const m0 = message.match(/@(\d{10,})/);
  if (isGroup && m0 && dev && !dev.wa_internal_id) { supabase.from('wa_devices').update({ wa_internal_id: m0[1] }).eq('device_number', deviceNumber); internalIds.push(m0[1]); }

  const { data: admin } = await supabase.from('master_admins').select('wa_number').eq('wa_number', waNumber).eq('is_active', true).maybeSingle();
  if (admin) {
    const upper = message.trim().toUpperCase();
    const isCmd = ['ONBOARD ','STATUS ONBOARD','COMPLETE ONBOARD','CANCEL ONBOARD','LIST BRANDS','BRANDS','HELP ADMIN','ADMIN HELP'].some(k => upper.startsWith(k));
    if (isCmd) { fetch(`${BASE_URL}/wa-master-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, admin_wa_number: waNumber, group_wa_number: replyTo }) }); return; }
  }

  let brandId = '', brandName = '', botPrefix = 'Geovera', groupOnly = true;
  if (dev) {
    brandId   = dev.brand_id as string;
    groupOnly = dev.group_only !== false;
    const { data: b } = await supabase.from('brands').select('name, bot_prefix').eq('id', brandId).maybeSingle();
    brandName = (b?.name as string) ?? ''; botPrefix = (b?.bot_prefix as string) || 'Geovera';
  }
  if (!brandId) {
    const { data: ob } = await supabase.from('brands').select('id, name, bot_prefix').eq('wa_number', waNumber).maybeSingle();
    if (ob) { brandId = ob.id as string; brandName = ob.name as string; botPrefix = (ob.bot_prefix as string) || 'Geovera'; }
    else {
      const { data: mb } = await supabase.from('wa_group_members').select('brand_id').eq('wa_number', waNumber).eq('is_active', true).maybeSingle();
      if (mb) { brandId = mb.brand_id as string; const { data: b } = await supabase.from('brands').select('name, bot_prefix').eq('id', brandId).maybeSingle(); brandName = (b?.name as string) ?? ''; botPrefix = (b?.bot_prefix as string) || 'Geovera'; }
    }
  }
  if (!brandId) { console.log('Brand not found:', waNumber); return; }

  const auth = await isAuthorized(supabase, brandId, waNumber);
  if (!auth.authorized && !admin) {
    console.log(`[BLOCKED] Unregistered number ${waNumber} for brand ${brandId}`);
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'in', message: message.slice(0,500), processed: false, command: 'blocked_unregistered', device_number: deviceNumber||null, group_id: isGroup?replyTo:null, received_at: new Date().toISOString() });
    return;
  }

  const memberName = auth.name;
  const memberRole = auth.role;

  if (groupOnly && !isGroup && !demoMode) {
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'in', message: message.slice(0,500), processed: false, command: 'private_ignored', device_number: deviceNumber||null, group_id: null, received_at: new Date().toISOString() });
    return;
  }
  await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'in', message: message.slice(0,500), processed: false, device_number: deviceNumber||null, group_id: isGroup?replyTo:null, received_at: new Date().toISOString() });

  const { cmd, arg, num } = parseCommand(message);
  const useAgent = isAgentMsg(message, botPrefix, internalIds, demoMode, isGroup);

  // ─── Session reply handlers ────────────────────────────────────────────────
  if (cmd === 'MANUAL_INPUT' && arg) {
    const session = await getActiveSession(supabase, brandId, replyTo);
    if (session) {
      await deleteSession(supabase, session.id);
      const genCmd = session.session_type === 'artikel' ? 'GEN_ARTICLE' : session.session_type === 'gambar' ? 'GEN_IMAGE' : 'GEN_VIDEO';
      console.log(`[MANUAL_INPUT] session:${session.session_type} desc:"${arg}"`);
      await fireContentGeneration({ cmd: genCmd as 'GEN_ARTICLE'|'GEN_IMAGE'|'GEN_VIDEO', prompt: arg, brandId, brandName, replyTo, token, memberName, waNumber, supabase, deviceNumber, isGroup });
      return;
    }
  }

  if (cmd === 'SECTION_PICK' && num !== undefined && arg) {
    const session = await getActiveSession(supabase, brandId, replyTo);
    if (session) {
      const section = session.sections.find(s => s.num === num);
      if (section) {
        const subIdx = ALPHA.indexOf(arg);
        if (subIdx >= 0 && subIdx < section.opts.length) {
          const chosen = section.opts[subIdx];
          await deleteSession(supabase, session.id);
          const genCmd = session.session_type === 'artikel' ? 'GEN_ARTICLE' : session.session_type === 'gambar' ? 'GEN_IMAGE' : 'GEN_VIDEO';
          console.log(`[SECTION_PICK] session:${session.session_type} sec:${num}${arg} chosen:"${chosen.label}" length:${chosen.length||'default'}`);
          await fireContentGeneration({ cmd: genCmd as 'GEN_ARTICLE'|'GEN_IMAGE'|'GEN_VIDEO', prompt: chosen.prompt, brandId, brandName, replyTo, token, memberName, waNumber, supabase, deviceNumber, isGroup, length: chosen.length });
          return;
        }
      }
    }
    // No valid session → fall through
  }

  // ─── Bare number reply (e.g. "2") → treat as first option of that section ──
  if (cmd === 'DONE' && num !== undefined && num >= 2) {
    const session = await getActiveSession(supabase, brandId, replyTo);
    if (session) {
      const section = session.sections.find(s => s.num === num);
      if (section && section.opts.length > 0) {
        const chosen = section.opts[0];
        await deleteSession(supabase, session.id);
        const genCmd = session.session_type === 'artikel' ? 'GEN_ARTICLE' : session.session_type === 'gambar' ? 'GEN_IMAGE' : 'GEN_VIDEO';
        console.log(`[NUM_PICK] session:${session.session_type} sec:${num} → first opt "${chosen.label}"`);
        await fireContentGeneration({ cmd: genCmd as 'GEN_ARTICLE'|'GEN_IMAGE'|'GEN_VIDEO', prompt: chosen.prompt, brandId, brandName, replyTo, token, memberName, waNumber, supabase, deviceNumber, isGroup, length: chosen.length });
        return;
      }
    }
  }

  // ─── AGENT router ──────────────────────────────────────────────────────────
  if (useAgent && cmd === 'UNKNOWN') {
    const routerRes = await fetch(`${BASE_URL}/wa-router`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, wa_number: waNumber, brand_id: brandId, brand_name: brandName, message_id }) });
    if (!routerRes.ok) { console.error('Router error:', routerRes.status); return; }
    const routing = await routerRes.json();
    console.log(`[router] agent:${routing.agent}`);
    if (!routing.ok || routing.agent === 'none') return;
    const ep: Record<string,string> = { ai:`${BASE_URL}/geovera-ai`, analytic:`${BASE_URL}/geovera-analytic`, social:`${BASE_URL}/geovera-social`, alert:`${BASE_URL}/geovera-alert`, ops:`${BASE_URL}/geovera-ops` };
    const endpoint = ep[routing.agent] ?? '';
    if (!endpoint) { await sendWA(replyTo, `@${botPrefix}${routing.agent} dalam pengembangan.`, token); return; }
    const ar = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand_id: brandId, brand_name: brandName, wa_number: waNumber, member_name: memberName, member_role: memberRole, message, clean_message: routing.clean_message || message, intent: routing.intent, persona_hint: routing.persona_hint, is_question: routing.is_question, thread_id: routing.thread_id, last_context: routing.last_context, urgency: routing.urgency }) });
    const ad = await ar.json();
    if (!ar.ok || !ad.ok || !ad.wa_message) { await sendWA(replyTo, `Error: ${ad.error ?? 'gagal'}`, token); return; }
    await sendWA(replyTo, ad.wa_message, token);
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'out', message: ad.wa_message.slice(0,500), command: `agent:${routing.agent}`, device_number: deviceNumber||null, group_id: isGroup?replyTo:null, processed: true, received_at: new Date().toISOString() });
    return;
  }

  let reply = '';

  // ─── MENU commands ─────────────────────────────────────────────────────────
  if (cmd === 'GEN_ARTICLE_MENU') {
    const { menu, sessionData } = await buildArticleMenu(supabase, brandId, brandName);
    await saveSession(supabase, brandId, waNumber, replyTo, sessionData);
    await sendWA(replyTo, menu, token);
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'out', message: '[ARTIKEL MENU]', command: 'gen_article_menu', device_number: deviceNumber||null, group_id: isGroup?replyTo:null, processed: true, received_at: new Date().toISOString() });
    return;
  }
  if (cmd === 'GEN_IMAGE_MENU') {
    const { menu, sessionData } = await buildImageMenu(supabase, brandId, brandName);
    await saveSession(supabase, brandId, waNumber, replyTo, sessionData);
    await sendWA(replyTo, menu, token);
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'out', message: '[GAMBAR MENU]', command: 'gen_image_menu', device_number: deviceNumber||null, group_id: isGroup?replyTo:null, processed: true, received_at: new Date().toISOString() });
    return;
  }
  if (cmd === 'GEN_VIDEO_MENU') {
    const { menu, sessionData } = await buildVideoMenu(supabase, brandId, brandName);
    await saveSession(supabase, brandId, waNumber, replyTo, sessionData);
    await sendWA(replyTo, menu, token);
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'out', message: '[VIDEO MENU]', command: 'gen_video_menu', device_number: deviceNumber||null, group_id: isGroup?replyTo:null, processed: true, received_at: new Date().toISOString() });
    return;
  }

  // ─── DIRECT content generation ─────────────────────────────────────────────
  if (cmd === 'GEN_ARTICLE' || cmd === 'GEN_IMAGE' || cmd === 'GEN_VIDEO') {
    await fireContentGeneration({ cmd: cmd as 'GEN_ARTICLE'|'GEN_IMAGE'|'GEN_VIDEO', prompt: arg || brandName, brandId, brandName, replyTo, token, memberName, waNumber, supabase, deviceNumber, isGroup });
    return;
  }

  // ─── LAPORAN ───────────────────────────────────────────────────────────────
  if (cmd === 'LAPORAN') {
    await sendWA(replyTo, `📊 _Sedang generate laporan PDF untuk *${brandName}*..._`, token);
    fetch(`${BASE_URL}/wa-report-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand_id: brandId, target: replyTo }) });
    await supabase.from('wa_log').insert({ brand_id: brandId, wa_number: waNumber, direction: 'out', message: `[PDF] Generating report for ${brandName}`, command: 'laporan', device_number: deviceNumber||null, group_id: isGroup?replyTo:null, processed: true, received_at: new Date().toISOString() });
    return;
  }

  if (cmd === 'APPROVE') {
    let q: Record<string,unknown>|null = null;
    if (arg) { const {data} = await supabase.from('wa_social_queue').select('*').eq('brand_id',brandId).eq('queue_ref',arg).eq('status','draft').maybeSingle(); q=data as Record<string,unknown>|null; }
    else { const {data} = await supabase.from('wa_social_queue').select('*').eq('brand_id',brandId).eq('status','draft').order('created_at',{ascending:false}).limit(1).maybeSingle(); q=data as Record<string,unknown>|null; }
    if (!q) { reply='Tidak ada konten draft. Ketik QUEUE.'; }
    else {
      await supabase.from('wa_social_queue').update({status:'approved',approved_by:waNumber,approved_at:new Date().toISOString()}).eq('id',q.id as string);
      await supabase.from('social_publish_log').insert({brand_id:brandId,queue_id:q.id,platform:q.platform,content_type:q.content_type,status:'pending',metadata:{approved_by:waNumber}});
      const icons: Record<string,string>={instagram:'\ud83d\udcf8',tiktok:'\ud83c\udfb5',linkedin:'\ud83d\udcbc',facebook:'\ud83d\udc65',twitter:'\ud83d\udc26'};
      reply=['\u2705 *APPROVED!*','',`${icons[q.platform as string]??'\ud83d\udcdd'} *${String(q.platform).charAt(0).toUpperCase()+String(q.platform).slice(1)}* - ${q.content_type}`,`_Ref: ${q.queue_ref}_`,'',String(q.generated).slice(0,350),'','\ud83e\udd16 _Generating report..._'].join('\n');
      fetch(`${BASE_URL}/wa-post-approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brand_id:brandId,brand_name:brandName,bot_prefix:botPrefix,queue_id:q.id,queue_ref:q.queue_ref,wa_number:replyTo,platform:q.platform,content_type:q.content_type,prompt:q.prompt,generated:q.generated,member_name:memberName,member_role:memberRole})}).catch(()=>{});
    }
  } else if (cmd === 'REJECT') {
    const {data} = await supabase.from('wa_social_queue').select('id,platform,content_type,queue_ref').eq('brand_id',brandId).in('status',['draft','approved']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (!data) { reply='Tidak ada konten yang bisa ditolak.'; }
    else { const q=data as Record<string,unknown>; await supabase.from('wa_social_queue').update({status:'rejected',rejected_at:new Date().toISOString(),reject_reason:arg??'Tidak sesuai'}).eq('id',q.id as string); reply=`\ud83d\udd34 REJECTED. _${q.queue_ref}_${arg?` - ${arg}`:''}`;  }
  } else if (cmd === 'QUEUE') {
    const {data:items}=await supabase.from('wa_social_queue').select('queue_ref,platform,content_type,status,created_at').eq('brand_id',brandId).order('created_at',{ascending:false}).limit(5);
    if (!items||items.length===0){reply=`Queue kosong.`;}
    else { const si: Record<string,string>={draft:'\ud83d\udfe1',approved:'\u2705',rejected:'\ud83d\udd34',published:'\ud83d\udccc'}; const lines=(items as Array<Record<string,unknown>>).map((q,i)=>{const d=new Date(q.created_at as string).toLocaleDateString('id-ID',{day:'numeric',month:'short'});return `${i+1}. ${si[q.status as string]??'\u26aa'} *${q.queue_ref}* - ${q.platform}/${q.content_type} _${d}_`;}).join('\n'); const drafts=(items as Array<Record<string,unknown>>).filter(q=>q.status==='draft').length; reply=[`\ud83d\udcdd *Queue - ${brandName}*`,'',lines,'',drafts>0?`\ud83d\udfe1 ${drafts} menunggu APPROVE`:'Semua selesai'].join('\n'); }
  } else if (cmd==='DONE') {
    const {data:at}=await supabase.from('tasks').select('id,persona_icon,priority,action_text,odrip,deadline').eq('brand_id',brandId).eq('status','active').order('priority_score',{ascending:false}).limit(10);
    const tasks=(at??[]) as Record<string,unknown>[];
    if (!num||num<1||num>tasks.length){reply=`Task #${num??'?'} tidak ditemukan.`;}
    else { const t=tasks[num-1]; await supabase.from('tasks').update({status:'done',completed_at:new Date().toISOString()}).eq('id',t.id as string);await supabase.from('learning_signals').insert({brand_id:brandId,task_id:t.id,source:'wa_command',outcome:'done',signal_type:'task_done',created_at:new Date().toISOString()}).catch(()=>{});reply=`\u2705 DONE #${num} ${t.persona_icon}\n_${String(t.action_text).slice(0,100)}_`; }
  } else if (cmd==='SKIP') {
    const {data:at}=await supabase.from('tasks').select('id,persona_icon,priority,action_text,odrip,deadline').eq('brand_id',brandId).eq('status','active').order('priority_score',{ascending:false}).limit(10);
    const tasks=(at??[]) as Record<string,unknown>[];
    if (!num||num<1||num>tasks.length){reply=`Task #${num??'?'} tidak ditemukan.`;}
    else { const t=tasks[num-1]; await supabase.from('tasks').update({status:'skipped',skipped_at:new Date().toISOString()}).eq('id',t.id as string);reply=`SKIP #${num}`; }
  } else if (cmd==='TUNDA') {
    const {data:at}=await supabase.from('tasks').select('id,persona_icon,priority,action_text,odrip,deadline').eq('brand_id',brandId).eq('status','active').order('priority_score',{ascending:false}).limit(10);
    const tasks=(at??[]) as Record<string,unknown>[];
    if (!num||num<1||num>tasks.length){reply=`Task #${num??'?'} tidak ditemukan.`;}
    else { const t=tasks[num-1]; await supabase.from('tasks').update({snoozed_until:new Date(Date.now()+86400000).toISOString()}).eq('id',t.id as string);reply=`TUNDA #${num} - 24 jam.`; }
  } else if (cmd==='STATUS') {
    const [{data:h},{data:g},{count:d7},{count:dr}]=await Promise.all([supabase.from('health_scores').select('score,grade').eq('brand_id',brandId).maybeSingle(),supabase.from('geo_scores').select('geo_score').eq('brand_id',brandId).order('recorded_at',{ascending:false}).limit(1).maybeSingle(),supabase.from('tasks').select('id',{count:'exact',head:true}).eq('brand_id',brandId).eq('status','done').gte('completed_at',new Date(Date.now()-604800000).toISOString()),supabase.from('wa_social_queue').select('id',{count:'exact',head:true}).eq('brand_id',brandId).eq('status','draft')]);
    const sc=(h?.score as number)??0; const ic=sc>=80?'\ud83d\udfe2':sc>=60?'\ud83d\udfe1':'\ud83d\udd34';
    reply=[`\ud83e\udde0 *${brandName}*`,`${ic} Health: ${sc}/100`,`\ud83d\udcca GEO: ${(g?.geo_score as number)?.toFixed(1)??'-'}/100`,`\u2705 Done 7d: ${d7??0}`,dr&&dr>0?`\ud83d\udfe1 Queue: ${dr}`:''].filter(Boolean).join('\n');
  } else if (cmd==='TASKS') {
    const {data:at}=await supabase.from('tasks').select('id,persona_icon,priority,action_text,odrip,deadline').eq('brand_id',brandId).eq('status','active').order('priority_score',{ascending:false}).limit(7);
    const tasks=(at??[]) as Record<string,unknown>[];
    if(!tasks.length){reply='Belum ada tasks aktif.';} else{const lines=tasks.map((t,i)=>{const net=(((t.odrip as Record<string,unknown>)?.risk_reward as Record<string,unknown>)?.net as number)??0; return `${i+1}. [${t.priority} ${t.persona_icon}] ${String(t.action_text).slice(0,70)} Net:${net>=0?'+':''}${net}`;}).join('\n'); reply=[`\ud83d\udcc8 *TASKS (${tasks.length})*`,'',lines,'','DONE N | SKIP N | TUNDA N'].join('\n');}
  } else if (cmd==='HELP') {
    reply=[
      `\ud83e\udde0 *${brandName} AI*`,
      ``,
      `@${botPrefix}AI | @${botPrefix}Analytic | @${botPrefix}Social | @${botPrefix}OPS`,
      ``,
      `*Content Generation (via @${botPrefix}):*`,
      `ARTIKEL \u2192 pilih topik hari ini`,
      `ARTIKEL <topik> \u2192 langsung generate`,
      `GAMBAR \u2192 pilih topik atau artikel`,
      `GAMBAR <deskripsi> \u2192 langsung generate`,
      `VIDEO \u2192 pilih topik, artikel, atau gambar`,
      `VIDEO <deskripsi> \u2192 langsung generate`,
      ``,
      `*Task & Queue:*`,
      `TASKS | STATUS | QUEUE | APPROVE | LAPORAN`,
    ].join('\n');
  }

  if (reply) {
    await sendWA(replyTo, reply, token);
    await supabase.from('wa_log').insert({brand_id:brandId,wa_number:waNumber,direction:'out',message:reply.slice(0,500),command:cmd,device_number:deviceNumber||null,group_id:isGroup?replyTo:null,processed:true,received_at:new Date().toISOString()});
  }
}
