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
      <rect width="32" height="32" rx="7" fill="#4f46e5" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="8" y="8" width="16" height="16" rx="2" />
        <path d="M8 13.5h16M8 19h16M13.5 8v16M19 8v16" />
      </g>
    </svg>
  );
}
