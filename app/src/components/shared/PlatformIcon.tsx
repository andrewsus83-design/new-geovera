"use client";

/**
 * PlatformIcon — GeoVera Design System v5.9
 *
 * Consistent brand-accurate social platform icons.
 * Each icon uses official brand colors with a rounded container.
 * Use `size` to control dimensions (default 22px).
 */

interface PlatformIconProps {
  id: string;
  size?: number;
  className?: string;
}

export default function PlatformIcon({ id, size = 22, className = "" }: PlatformIconProps) {
  const props = { width: size, height: size, className };

  switch (id.toLowerCase()) {

    /* ── TikTok — black bg, white logo ── */
    case "tiktok":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#010101" />
          <path
            d="M17.5 7.8a4.1 4.1 0 0 1-2.5-.85v5.7A4.45 4.45 0 1 1 10.6 8.2c.13 0 .26.01.4.02v2.44a2.07 2.07 0 1 0 1.55 2v-9.1h2.4a4.1 4.1 0 0 0 2.55 3.77V7.8z"
            fill="white"
          />
          <path
            d="M17.5 7.8c.7.28 1.5.43 2.32.38V5.7a4.12 4.12 0 0 1-2.32-.7v2.8z"
            fill="#EE1D52"
          />
          <path
            d="M10.6 10.66a2.07 2.07 0 1 0 1.95 2.07V3.56h-2.4a4.09 4.09 0 0 0 .45 2.42"
            fill="#69C9D0"
            fillOpacity="0"
          />
        </svg>
      );

    /* ── Instagram — official gradient ── */
    case "instagram":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id="ig-g1" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="10%" stopColor="#fdf497" />
              <stop offset="50%" stopColor="#fd5949" />
              <stop offset="68%" stopColor="#d6249f" />
              <stop offset="100%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#ig-g1)" />
          <rect x="6.5" y="6.5" width="11" height="11" rx="3.5" stroke="white" strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="12" r="3.2" stroke="white" strokeWidth="1.5" fill="none" />
          <circle cx="17" cy="7" r="1" fill="white" />
        </svg>
      );

    /* ── Facebook — blue bg ── */
    case "facebook":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#1877F2" />
          <path
            d="M15.12 13H13v7h-3v-7H8.5v-2.88H10V8.47c0-2.1 1.3-3.24 3.15-3.24.9 0 1.85.16 1.85.16V7.4h-1.04c-1.03 0-1.35.64-1.35 1.3v1.43H15.5L15.12 13z"
            fill="white"
          />
        </svg>
      );

    /* ── YouTube — red bg, play button ── */
    case "youtube":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#FF0000" />
          <path
            d="M19.5 8.2s-.2-1.4-.85-1.9c-.8-.84-1.7-.85-2.1-.9C14.2 5.3 12 5.3 12 5.3s-2.2 0-4.55.1c-.4.05-1.3.06-2.1.9-.65.5-.85 1.9-.85 1.9S4.3 9.8 4.3 11.4v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.85 1.9c.8.84 1.85.82 2.32.9C9.05 19.05 12 19 12 19s2.2 0 4.55-.22c.4-.05 1.3-.06 2.1-.9.65-.5.85-1.9.85-1.9s.2-1.6.2-3.2v-1.5c0-1.6-.2-3.2-.2-3.2zm-8.1 6.5V9.5l5.1 2.6-5.1 2.6z"
            fill="white"
          />
        </svg>
      );

    /* ── LinkedIn — blue bg ── */
    case "linkedin":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#0A66C2" />
          <path
            d="M7.2 9.5H4.7V17h2.5V9.5zm-1.25-1a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zm10.3 1c-1.2 0-2.05.56-2.35 1.1V9.5H11.4V17H14v-4.2c0-1.3.42-2.08 1.52-2.08 1.1 0 1.48.82 1.48 2.05V17H19.5v-4.75c0-2.25-.97-3.25-3.25-3.25z"
            fill="white"
          />
        </svg>
      );

    /* ── X / Twitter — black bg ── */
    case "x":
    case "twitter":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#000000" />
          <path
            d="M17.75 4.5h-2.8l-3.45 4.6L7.8 4.5H3.5l5.6 7.65L3.5 19.5h2.8l3.85-5.15 3.6 5.15H18l-5.9-8.05 5.65-7.95zm-2.1 13.5-8.5-12.3h1.6l8.5 12.3h-1.6z"
            fill="white"
          />
        </svg>
      );

    /* ── Threads — black bg ── */
    case "threads":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#000000" />
          <path
            d="M16.1 11.3c-.1-.05-.2-.1-.3-.14-.18-2.37-1.43-3.73-3.62-3.74h-.03c-1.3 0-2.38.55-3.05 1.55l1.2.82c.5-.74 1.27-1.1 2.13-.9.77.18 1.3.7 1.48 1.49a6.6 6.6 0 0 0-1.53-.07c-1.7.1-2.8 1.06-2.73 2.4.03.7.38 1.3.98 1.7.51.34 1.16.52 1.83.48a3.15 3.15 0 0 0 2.53-1.38c.39-.6.6-1.37.62-2.27.38.23.66.53.83.9.3.65.32 1.72-.57 2.61-.78.78-1.93 1.12-3.44 1.13-1.7-.02-3-.57-3.85-1.63-.8-1.03-1.2-2.52-1.22-4.43.02-1.91.42-3.4 1.22-4.43.85-1.06 2.15-1.61 3.85-1.63 1.72.02 3.05.59 3.97 1.68.45.54.79 1.22 1.02 2.03l1.46-.39c-.27-1.03-.72-1.91-1.34-2.64C14.7 4.73 12.96 4 11.1 4h-.04C9.1 4 7.38 4.73 6.2 6.1c-1.1 1.33-1.67 3.17-1.7 5.47v.1c.03 2.3.6 4.14 1.7 5.47 1.18 1.37 2.9 2.1 4.86 2.1h.04c1.74-.02 3.2-.49 4.26-1.57 1.42-1.44 1.38-3.24.9-4.37-.3-.73-.87-1.32-1.86-1.73zm-4.26 2.06c-.74.04-1.52-.3-1.55-.98-.02-.55.4-1.08 1.52-1.15.34-.02.66-.02.95 0 .11 0 .23.02.34.03-.12 1.43-.66 2.07-1.26 2.1z"
            fill="white"
          />
        </svg>
      );

    /* ── Reddit — orange circle ── */
    case "reddit":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <path
            d="M20 12a1.83 1.83 0 0 0-1.83-1.83 1.8 1.8 0 0 0-1.22.47A8.9 8.9 0 0 0 12.4 9.2l.73-3.44 2.39.5a1.3 1.3 0 1 0 .13-.63l-2.68-.56a.24.24 0 0 0-.28.18l-.81 3.82a8.93 8.93 0 0 0-4.8 1.44 1.82 1.82 0 1 0-1.99 2.9 3.6 3.6 0 0 0 0 .45c0 2.3 2.68 4.16 5.98 4.16s5.98-1.86 5.98-4.16a3.6 3.6 0 0 0 0-.45A1.83 1.83 0 0 0 20 12zM8.5 13.17a1.08 1.08 0 1 1 1.08 1.08 1.08 1.08 0 0 1-1.08-1.08zm6.06 2.85a3.76 3.76 0 0 1-2.56.77 3.76 3.76 0 0 1-2.56-.77.19.19 0 0 1 .27-.27 3.39 3.39 0 0 0 2.29.67 3.39 3.39 0 0 0 2.29-.67.19.19 0 0 1 .27.27zm-.22-1.77a1.08 1.08 0 1 1 1.08-1.08 1.08 1.08 0 0 1-1.08 1.08z"
            fill="white"
          />
        </svg>
      );

    /* ── Pinterest — red bg, P mark ── */
    case "pinterest":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#E60023" />
          <path
            d="M12 3C7.03 3 3 7.03 3 12c0 3.74 2.24 6.97 5.46 8.43-.07-.68-.14-1.72.03-2.46l1.02-4.32s-.26-.52-.26-1.29c0-1.21.7-2.11 1.57-2.11.74 0 1.1.56 1.1 1.22 0 .75-.47 1.86-.72 2.9-.2.86.43 1.57 1.28 1.57 1.53 0 2.72-1.62 2.72-3.95 0-2.07-1.48-3.51-3.6-3.51a3.96 3.96 0 0 0-4.14 3.97c0 .78.3 1.63.67 2.09a.27.27 0 0 1 .06.26l-.25 1.01c-.04.16-.13.2-.3.12-1.12-.52-1.82-2.16-1.82-3.47 0-2.82 2.05-5.42 5.91-5.42 3.1 0 5.51 2.21 5.51 5.17 0 3.08-1.94 5.56-4.63 5.56-.9 0-1.76-.47-2.05-1.02l-.56 2.08c-.2.78-.75 1.76-1.12 2.36.84.26 1.73.4 2.65.4C16.97 21 21 16.97 21 12c0-4.97-4.03-9-9-9z"
            fill="white"
          />
        </svg>
      );

    /* ── Google Business Profile ── */
    case "gbp":
    case "google_business":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="1" />
          <path d="M21 11.5h-8.85v2.64h5.32c-.58 2.74-2.86 4.43-5.32 4.43A6.2 6.2 0 0 1 5.93 12a6.2 6.2 0 0 1 6.22-6.2c1.52 0 2.88.58 3.9 1.52l2.08-2.08A9.03 9.03 0 0 0 12.15 3a9.15 9.15 0 1 0 0 18.3c5.05 0 8.68-3.55 8.68-8.55 0-.57-.07-1.05-.83-1.25z" fill="#4285F4" />
          <path d="M3.77 7.26 6.2 9.14A6.18 6.18 0 0 1 12.15 5.8c1.52 0 2.88.58 3.9 1.52l2.08-2.08A9.03 9.03 0 0 0 12.15 3a9.13 9.13 0 0 0-8.38 4.26z" fill="#EA4335" />
          <path d="M12.15 21.3a9.04 9.04 0 0 0 6.1-2.34l-2.82-2.18a5.63 5.63 0 0 1-3.28 1.07 6.17 6.17 0 0 1-5.85-4.14l-2.53 1.95a9.13 9.13 0 0 0 8.38 5.64z" fill="#34A853" />
          <path d="M21 11.5c0-.57-.07-1.05-.18-1.5H12.15v2.64h5.32c-.26 1.2-.98 2.2-1.98 2.9l2.82 2.18C20 16.33 21 14.1 21 11.5z" fill="#4285F4" />
        </svg>
      );

    /* ── WhatsApp — green bg ── */
    case "whatsapp":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#25D366" />
          <path
            d="M17.47 6.53A7.47 7.47 0 0 0 4.6 16.53l-1.1 4 4.1-1.07A7.47 7.47 0 1 0 17.47 6.53zm-5.47 11.5a6.2 6.2 0 0 1-3.16-.87l-.23-.13-2.37.62.63-2.3-.15-.24A6.22 6.22 0 1 1 12 18.03zm3.4-4.66c-.19-.1-1.1-.54-1.27-.6-.17-.06-.29-.09-.41.09-.12.19-.46.6-.57.72-.1.12-.21.14-.4.05a5.07 5.07 0 0 1-2.53-2.21c-.19-.33.19-.31.55-1.03.06-.12.03-.23-.02-.32-.05-.09-.41-1-.56-1.37-.15-.36-.3-.31-.41-.31h-.35c-.12 0-.31.04-.47.23-.16.18-.63.61-.63 1.5 0 .88.65 1.73.74 1.85.09.12 1.28 1.95 3.1 2.74.43.19.77.3 1.03.38.43.14.83.12 1.14.07.35-.05 1.07-.44 1.23-.86.15-.42.15-.78.1-.86-.05-.08-.17-.13-.36-.22z"
            fill="white"
          />
        </svg>
      );

    /* ── Website / Web — globe ── */
    case "website":
    case "web":
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="var(--gv-color-neutral-100)" />
          <circle cx="12" cy="12" r="7" stroke="var(--gv-color-neutral-500)" strokeWidth="1.5" fill="none" />
          <path d="M12 5c-2 2-3 4.5-3 7s1 5 3 7M12 5c2 2 3 4.5 3 7s-1 5-3 7M5 12h14" stroke="var(--gv-color-neutral-500)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    /* ── Snapchat — yellow bg ── */
    case "snapchat":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#FFFC00" />
          <path
            d="M12 4c-2.2 0-4 1.7-4 3.8v.7c-.4.1-.7.4-.7.8 0 .3.2.6.5.8-.4.9-1.1 1.7-2 2.1.3.3.9.5 1.8.3l.1.2c.1.2.1.5-.2.7-.5.3-1.3.5-2.2.5h-.3c0 .3.5.5 1.3.7.1.4.2.8.5 1 .1.1.3.1.5.1.3 0 .6-.1.9-.2.5-.2 1-.3 1.6-.3.5 0 1 .1 1.4.3.5.2.8.3 1 .3.2 0 .4 0 .6-.1.3-.2.4-.6.5-1 .8-.2 1.3-.4 1.3-.7h-.3c-.9 0-1.7-.2-2.2-.5-.3-.2-.3-.5-.2-.7l.1-.2c.9.2 1.5 0 1.8-.3-.9-.4-1.6-1.2-2-2.1.3-.2.5-.5.5-.8 0-.4-.3-.7-.7-.8v-.7c0-2.1-1.8-3.8-4-3.8z"
            fill="#000"
          />
        </svg>
      );

    /* ── Telegram — blue bg ── */
    case "telegram":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="#26A5E4" />
          <path
            d="M5.5 11.8 18.5 6.5c.6-.2 1.1.1.9.8l-2.2 10.4c-.16.72-.62.9-1.25.55l-3.5-2.58-1.68 1.62c-.19.18-.34.33-.7.33l.25-3.55 6.4-5.78c.28-.25-.06-.38-.43-.14l-7.92 4.97-3.4-1.07c-.73-.23-.74-.73.15-1.08z"
            fill="white"
          />
        </svg>
      );

    /* ── Default fallback — neutral globe ── */
    default:
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none">
          <rect x="0" y="0" width="24" height="24" rx="6" fill="var(--gv-color-neutral-100)" />
          <circle cx="12" cy="12" r="6.5" stroke="var(--gv-color-neutral-400)" strokeWidth="1.5" fill="none" />
          <path d="M12 5.5c-1.5 1.5-2.5 3.8-2.5 6.5s1 5 2.5 6.5M12 5.5c1.5 1.5 2.5 3.8 2.5 6.5s-1 5-2.5 6.5M5.5 12h13" stroke="var(--gv-color-neutral-400)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}
