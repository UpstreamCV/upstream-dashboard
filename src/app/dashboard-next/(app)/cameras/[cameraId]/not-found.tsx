import Link from "next/link";
import { CameraOff, ChevronLeft } from "lucide-react";

export default function CameraNotFound() {
  return (
    <section className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard-next/cameras"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Cameras
        </Link>
      </div>
      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
        <CameraOff
          className="mx-auto h-7 w-7 text-[var(--dn-text-50)]"
          aria-hidden
        />
        <h1 className="mt-3 font-bold text-[clamp(1.2rem,1.8vw,1.6rem)]">
          Camera not found
        </h1>
        <p className="mt-2 max-w-md mx-auto text-sm text-[var(--dn-text-50)]">
          This camera either doesn&rsquo;t exist or belongs to a different
          account. Head back to the fleet to try another.
        </p>
        <Link
          href="/dashboard-next/cameras"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] text-white font-bold px-4 py-2 text-sm transition hover:brightness-110"
        >
          Back to Cameras
        </Link>
      </div>
    </section>
  );
}
