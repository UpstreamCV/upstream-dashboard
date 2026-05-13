import Link from "next/link";
import { Video } from "lucide-react";

export default function CameraNotFound() {
  return (
    <section className="glass rounded-3xl px-6 py-12 text-center">
      <Video className="w-7 h-7 mx-auto text-accent" />
      <h2 className="display text-xl font-semibold mt-3">
        Camera <em>not found</em>
      </h2>
      <p className="text-sm text-ink-soft mt-3 max-w-md mx-auto">
        This camera doesn&rsquo;t exist in the active account, or it&rsquo;s
        been removed.
      </p>
      <Link
        href="/dashboard/cameras"
        className="inline-flex mt-5 rounded-full bg-ink text-base-deep font-medium px-4 py-2 text-sm transition hover:bg-white"
      >
        Back to cameras
      </Link>
    </section>
  );
}
