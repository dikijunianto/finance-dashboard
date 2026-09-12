export const accountTypes = [
  "bank",
  "cash",
  "e_wallet",
  "investment",
  "other",
] as const;
export const accountTypeLabels: Record<string, string> = {
  bank: "Bank",
  cash: "Cash",
  e_wallet: "E-Wallet",
  investment: "Investment",
  other: "Other",
};
export function accountTypeLabel(type: string) {
  return Object.hasOwn(accountTypeLabels, type)
    ? accountTypeLabels[type]
    : type;
}
export function isLiquidAccount(account: { type: string; isActive: boolean }) {
  return (
    account.isActive && ["bank", "cash", "e_wallet"].includes(account.type)
  );
}
