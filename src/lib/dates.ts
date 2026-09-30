export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function currentMonth(now = new Date()) {
  const month = jakartaDate(now).slice(0, 7);
  const [year, number] = month.split("-").map(Number);
  return {
    month,
    start: `${month}-01`,
    next: `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}-01`,
  };
}
export function monthStart(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null;
}
export function suggestedFundingMonth(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Follow the explicit product examples: Sep 24 stays Sep; Sep 25 suggests Oct.
  const next = day > lastDay - 6;
  return `${next && month === 12 ? year + 1 : year}-${String(next ? (month === 12 ? 1 : month + 1) : month).padStart(2, "0")}-01`;
}
export function billDueDate(month: string, day: number) {
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return `${month.slice(0, 7)}-${String(Math.min(lastDay, Math.max(1, day))).padStart(2, "0")}`;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+07:00`));
}
export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month.slice(0, 7)}-01T12:00:00+07:00`));
}
