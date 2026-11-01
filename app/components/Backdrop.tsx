/** The dimmed wallpaper behind every screen. */
export function Backdrop() {
  return (
    <div className="fixed inset-0 z-0" aria-hidden>
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/acewallpaper.webp')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/75 to-black/85" />
    </div>
  );
}
