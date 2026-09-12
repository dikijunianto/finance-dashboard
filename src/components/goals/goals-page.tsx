"use client";
import { useState } from "react";
import { createGoal, addGoalProgress, deleteGoal } from "@/actions/goals";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rupiah } from "@/lib/currency";
import {
  MutationForm,
  DeleteConfirmation,
} from "@/components/ui/mutation-form";
import { isGoalCompleted, progressPercent } from "@/lib/finance/calculations";
import { formatDate } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  priority: number;
  status: string;
};
export function GoalsPage({ goals }: { goals: Goal[] }) {
  const [open, setOpen] = useState(false);
  const active = goals.filter((g) => !isGoalCompleted(g));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="page">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Financial Goals</h1>
            <p className="mt-2 text-slate-600">
              Build toward the things that matter.
            </p>
          </div>
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              + New Goal
            </button>
          </DialogTrigger>
        </header>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Active Goals" value={active.length} />
          <Metric
            label="Completed Goals"
            value={goals.length - active.length}
          />
          <Metric
            label="Amount Remaining"
            value={active.reduce(
              (n, g) => n + g.targetAmount - g.currentAmount,
              0,
            )}
            money
          />
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
        {!goals.length && (
          <div className="panel mt-6">
            <EmptyState
              title="No goals yet"
              description="Create a financial target such as an emergency fund or major purchase."
            />
          </div>
        )}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Goal</DialogTitle>
          </DialogHeader>
          <GoalForm onDone={() => setOpen(false)} />
        </DialogContent>
      </div>
    </Dialog>
  );
}
function GoalCard({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(false);
  const done = isGoalCompleted(goal);
  const p = done ? 100 : progressPercent(goal.currentAmount, goal.targetAmount);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <article className={`panel ${done ? "muted-record" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{goal.name}</h2>
          <StatusBadge
            tone={done ? "good" : goal.priority === 3 ? "attention" : "neutral"}
          >
            {done
              ? "Completed"
              : `${goal.priority === 3 ? "High" : goal.priority === 2 ? "Medium" : goal.priority === 1 ? "Low" : goal.priority} Priority`}
          </StatusBadge>
        </div>
        <p className="mt-6 money">{rupiah(goal.currentAmount)}</p>
        <p className="text-sm text-slate-500">of {rupiah(goal.targetAmount)}</p>
        <div className="mt-4 h-2 rounded bg-slate-100">
          <div
            className="h-full rounded bg-emerald-600"
            style={{ width: `${p}%` }}
          />
        </div>
        <p className="mt-2 text-sm">
          {p}% ·{" "}
          {rupiah(
            done ? 0 : Math.max(goal.targetAmount - goal.currentAmount, 0),
          )}{" "}
          remaining
        </p>
        {goal.targetDate && (
          <p className="mt-3 text-xs text-slate-500">
            Target {formatDate(goal.targetDate)}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          {!done && (
            <DialogTrigger asChild>
              <button type="button" className="button-primary">
                Add Progress
              </button>
            </DialogTrigger>
          )}
          <DeleteConfirmation
            id={goal.id}
            name={goal.name}
            action={deleteGoal}
          />
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Progress · {goal.name}</DialogTitle>
          </DialogHeader>
          <MutationForm
            action={addGoalProgress}
            onSuccess={() => setOpen(false)}
          >
            <input name="id" type="hidden" value={goal.id} />
            <p className="text-sm text-slate-500">
              Current {rupiah(goal.currentAmount)} · Target{" "}
              {rupiah(goal.targetAmount)}
            </p>
            <label className="mt-3 block text-sm">
              Contribution
              <input
                name="amount"
                type="number"
                min="1"
                max={goal.targetAmount - goal.currentAmount}
                className="mt-4 w-full rounded-lg border p-2"
                required
              />
            </label>
            <DialogFooter>
              <DialogClose
                type="button"
                className="rounded-xl border px-4 py-2"
              >
                Cancel
              </DialogClose>
              <button className="rounded-xl bg-emerald-700 px-4 py-2 text-white">
                Add Progress
              </button>
            </DialogFooter>
          </MutationForm>
        </DialogContent>
      </article>
    </Dialog>
  );
}
function GoalForm({ onDone }: { onDone: () => void }) {
  return (
    <MutationForm action={createGoal} onSuccess={onDone}>
      <label className="mt-3 block text-sm">
        Goal name
        <input name="name" className="w-full rounded-lg border p-2" required />
      </label>
      <label className="mt-3 block text-sm">
        Target amount
        <input
          name="targetAmount"
          type="number"
          className="mt-3 w-full rounded-lg border p-2"
          required
          min="1"
          max={2147483647}
        />
      </label>
      <label className="mt-3 block text-sm">
        Already saved
        <input
          name="currentAmount"
          type="number"
          defaultValue="0"
          className="mt-3 w-full rounded-lg border p-2"
          required
          min="0"
          max={2147483647}
        />
      </label>
      <label className="mt-3 block text-sm">
        Target date (optional)
        <input
          name="targetDate"
          type="date"
          className="mt-3 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-3 block text-sm">
        Priority
        <select
          name="priority"
          defaultValue="2"
          className="mt-3 w-full rounded-lg border p-2"
        >
          <option value="1">Low priority</option>
          <option value="2">Medium priority</option>
          <option value="3">High priority</option>
        </select>
      </label>
      <DialogFooter>
        <DialogClose type="button" className="rounded-xl border px-4 py-2">
          Cancel
        </DialogClose>
        <button className="rounded-xl bg-emerald-700 px-4 py-2 text-white">
          Create Goal
        </button>
      </DialogFooter>
    </MutationForm>
  );
}
function Metric({
  label,
  value,
  money,
}: {
  label: string;
  value: number;
  money?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <strong className="mt-2 block text-2xl">
        {money ? rupiah(value) : value}
      </strong>
    </div>
  );
}
