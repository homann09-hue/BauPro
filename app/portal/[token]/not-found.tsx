import Link from "next/link";

export default function CustomerPortalNotFound() {
  return (
    <main className="min-h-screen bg-fog px-4 py-10 text-ink">
      <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6 shadow-soft">
        <p className="section-kicker">Kundenportal</p>
        <h1 className="mt-2 text-2xl font-black">Portal-Link ist abgelaufen oder ungültig.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Bitte fordere beim Handwerksbetrieb einen neuen Link an. Interne BauPro-Daten bleiben ohne gültigen Link geschuetzt.
        </p>
        <Link href="/login" className="btn-secondary mt-5">
          Zur Anmeldung
        </Link>
      </section>
    </main>
  );
}
