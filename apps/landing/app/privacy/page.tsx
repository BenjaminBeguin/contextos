import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Memmo — Privacy & Cookies",
  description: "How Memmo's website handles your data and cookies.",
};

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen">
      <div className="aurora opacity-50" />
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[var(--background)]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block h-4 w-4 rotate-45 rounded-sm bg-gradient-to-br from-violet-400 to-cyan-400" />
            Memmo
          </a>
          <a href="/" className="text-sm text-[var(--muted)] hover:text-white">
            ← Back
          </a>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Legal</p>
        <h1 className="gradient-text mt-3 text-4xl font-semibold">Privacy &amp; Cookies</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--muted)]">
          <section>
            <h2 className="text-lg font-semibold text-white">What this page covers</h2>
            <p className="mt-2">
              This policy explains how the Memmo marketing website handles your data and cookies.
              It applies to this site only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Cookies &amp; local storage</h2>
            <p className="mt-2">We keep this minimal and ask before anything non-essential:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Essential</strong> — we store your cookie choice and,
                if you join the waitlist, a flag in your browser so we don&apos;t ask twice. These
                are required for the site to function and are set without consent.
              </li>
              <li>
                <strong className="text-white">Analytics (optional)</strong> — only loaded if you
                press <em>Accept</em>. They help us understand which pages are useful. They are never
                used for advertising, and pressing <em>Decline</em> means none are set.
              </li>
            </ul>
            <p className="mt-3">
              You can change your choice anytime via the <strong className="text-white">Cookie
              settings</strong> link in the footer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">The waitlist</h2>
            <p className="mt-2">
              If you submit your email to the waitlist, it is sent to our form provider so we can
              contact you about early access. We use it only for that purpose and do not sell it.
              Ask us to delete it at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Your rights</h2>
            <p className="mt-2">
              Under the GDPR you can access, correct, export, or delete your data, and withdraw
              consent at any time. To exercise any of these, email{" "}
              <a href="mailto:privacy@memmo.dev" className="text-cyan-300 hover:underline">
                privacy@memmo.dev
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p className="mt-2">
              Questions about this policy? Email{" "}
              <a href="mailto:privacy@memmo.dev" className="text-cyan-300 hover:underline">
                privacy@memmo.dev
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
