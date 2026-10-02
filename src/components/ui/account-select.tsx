import Link from "next/link";
export type AccountOption = { id: string; name: string; isActive: boolean };
export function AccountSelect({
  accounts,
  label,
  name = "accountId",
  defaultValue = "",
  retainCurrent = false,
  required = true,
}: {
  accounts: AccountOption[];
  label: string;
  name?: string;
  defaultValue?: string;
  retainCurrent?: boolean;
  required?: boolean;
}) {
  return (
    <label className="mt-4 block text-sm">
      {label}
      <select
        aria-label={label}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full rounded-xl border p-2.5"
      >
        <option value="" disabled={required}>
          {required ? "Select an account" : "Keep unlinked (metadata only)"}
        </option>
        {accounts
          .filter((a) => a.isActive || (retainCurrent && a.id === defaultValue))
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
      {!accounts.some((a) => a.isActive) && (
        <span className="mt-2 block text-muted">
          Add an active account first.{" "}
          <Link href="/accounts" className="text-brand underline">
            Go to Accounts
          </Link>
        </span>
      )}
    </label>
  );
}
