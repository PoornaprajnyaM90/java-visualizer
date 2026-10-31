export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <circle cx="14" cy="14" r="6.5" stroke="var(--on-accent)" strokeWidth="2.4" />
      <path d="M19 19l6 6" stroke="var(--on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11.5 14h5M14 11.5v5" stroke="var(--on-accent)" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}
