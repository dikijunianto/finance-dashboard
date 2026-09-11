"use client";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { login, type LoginState } from "@/actions/auth";
const initialState: LoginState = {};
export default function Login() {
  const [state, action, pending] = useActionState(login, initialState);
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form
        action={action}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-emerald-700 text-white">
          <LockKeyhole size={22} />
        </div>
        <p className="mt-6 text-sm font-semibold text-emerald-700">MyFinance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Your Personal CFO
        </h1>
        <p className="mt-2 text-slate-600">
          Masuk untuk membuka dashboard finansial pribadi Anda.
        </p>
        <label className="mt-7 block text-sm font-medium">
          Username
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-600"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <div className="relative mt-1.5">
            <input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-11 outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-3 text-slate-400"
              aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
          >
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          className="mt-6 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </main>
  );
}
