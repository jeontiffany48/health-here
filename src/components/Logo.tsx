export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#c6e47b" />
      <path d="M256 92c-70 0-126 55-126 124 0 92 126 204 126 204s126-112 126-204c0-69-56-124-126-124z" fill="#1f3d2c" />
      <path d="M236 156h40v44h44v40h-44v44h-40v-44h-44v-40h44z" fill="#c6e47b" />
    </svg>
  );
}

const SIZES = {
  md: { mark: "h-8 w-8", text: "text-xl" },
  header: { mark: "h-11 w-11", text: "text-2xl" },
  lg: { mark: "h-12 w-12", text: "text-3xl" },
};

export function Logo({ size = "md" }: { size?: keyof typeof SIZES }) {
  return (
    <span className="inline-flex items-center gap-3 text-forest">
      <LogoMark className={SIZES[size].mark} />
      <span className={`font-bold tracking-tight ${SIZES[size].text}`}>Health Here</span>
    </span>
  );
}
