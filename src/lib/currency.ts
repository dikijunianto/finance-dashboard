export const rupiah = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
export const percent = (value: number) => new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 0 }).format(value / 100);
