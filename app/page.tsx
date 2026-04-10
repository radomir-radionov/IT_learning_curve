import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#02050b] via-[#050c1d] to-[#071426] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
              App
            </p>
            <h1 className="text-2xl font-semibold text-white">Home</h1>
          </div>
          <nav className="flex items-center gap-6 text-sm font-semibold">
            <Link
              href="/profile"
              className="text-emerald-300 transition hover:text-emerald-200"
            >
              Profile
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-lg text-slate-300">
          You are signed in. Open your profile or continue exploring the app.
        </p>
      </main>
    </div>
  );
}
