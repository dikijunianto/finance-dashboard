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
