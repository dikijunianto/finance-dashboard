export function MonthSelect({ month }: { month: string }) {
  return (
    <form method="get" className="flex items-center gap-2">
      <label className="text-sm">
        Month{" "}
        <input
          aria-label="Month"
          name="month"
          type="month"
          required
          defaultValue={month.slice(0, 7)}
          className="rounded-lg border bg-white p-2"
        />
      </label>
      <button className="button-secondary">View</button>
    </form>
  );
}
