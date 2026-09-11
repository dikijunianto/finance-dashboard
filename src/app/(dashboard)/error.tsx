"use client";
export default function FinanceError({ reset }: { reset: () => void }) {
  return (
    <section className="m-5 rounded-2xl border bg-white p-6">
      <h1 className="text-xl font-semibold">
        Financial data could not be loaded
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Your saved data has not been replaced. Check your connection and try
        again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-white"
      >
        Try Again
      </button>
    </section>
  );
}
