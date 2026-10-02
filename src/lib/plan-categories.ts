export const planCategories = [
  "bills_debt", "living", "savings", "investments", "lifestyle", "buffer",
] as const;
export type PlanCategory = (typeof planCategories)[number];
export const allocationLabels: Record<PlanCategory, string> = {
  bills_debt: "Bills & Debt",
  living: "Living Expenses",
  savings: "Savings",
  investments: "Investments",
  lifestyle: "Lifestyle",
  buffer: "Buffer",
};
export function isPlanCategory(value: unknown): value is PlanCategory {
  return planCategories.some((category) => category === value);
}
