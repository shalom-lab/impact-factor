/** Spreadsheet mark used in the topbar (matches favicon.svg). */
export function SheetLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="topbar__logo-svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="svLogoG" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#svLogoG)" />
      <rect x="6.5" y="7.5" width="19" height="17" rx="2.2" fill="#fff" fillOpacity="0.95" />
      <path
        stroke="#6366f1"
        strokeWidth="1.35"
        strokeLinecap="round"
        d="M6.5 12.5h19M6.5 17.5h19M6.5 22.5h19M13 7.5v17M20 7.5v17"
      />
      <rect x="6.5" y="7.5" width="6.5" height="5" rx="1.2" fill="#93c5fd" />
    </svg>
  );
}
