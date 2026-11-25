import { useId } from "react";

export function Mark({ size = 40 }: { size?: number }) {
  const raw = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={raw} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1ec99a" />
          <stop offset="0.55" stopColor="#0e8f6e" />
          <stop offset="1" stopColor="#075844" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${raw})`} />
      <path
        d="M32 10c7.2 9.2 16 18.2 16 28.2A16 16 0 1 1 16 38.2C16 28.2 24.8 19.2 32 10z"
        fill="white"
      />
      <circle cx="24.5" cy="44" r="4.2" fill="none" stroke="#12382e" strokeWidth="2.4" />
      <circle cx="39.5" cy="44" r="4.2" fill="none" stroke="#12382e" strokeWidth="2.4" />
      <path
        d="M24.5 44h6.2l4.4-6.2h6.2"
        fill="none"
        stroke="#12382e"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="43" cy="22" r="4" fill="#ff7a1a" />
    </svg>
  );
}

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const mark = size === "lg" ? 56 : size === "sm" ? 32 : 40;
  const text = size === "lg" ? "text-5xl" : size === "sm" ? "text-xl" : "text-[1.7rem]";
  const badge = size === "lg" ? "text-3xl px-2 py-1" : size === "sm" ? "text-sm px-1.5 py-0.5" : "text-lg px-1.5 py-0.5";
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={mark} />
      <span className={`font-display leading-none tracking-tight text-ink ${text}`}>Lava</span>
      <span className={`rounded-lg bg-mango font-display leading-none text-ink ${badge}`}>Ya</span>
    </span>
  );
}
