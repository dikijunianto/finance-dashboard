import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { jakartaDate, currentMonth } from "../src/lib/dates.ts";
import { rupiah } from "../src/lib/currency.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const database = new URL(process.env.QA_DATABASE_URL);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3005";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert(
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
    /^\/myfinance_qa(?:_[a-z0-9]+)?$/.test(database.pathname),
  "Only isolated local QA allowed",
);
const sql = postgres(database.href);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.QA_BROWSER_CHANNEL || "msedge",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  consoleErrors = [],
  actionRequests = new Map();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning")
    consoleErrors.push(message.text());
});
page.on("request", (request) => {
  if (
    request.method() === "POST" &&
    request.headers()["next-action"] &&
    !request.url().endsWith("/login")
  ) {
    actionRequests.set(request.headers()["next-action"], {
      url: request.url(),
      body: request.postDataBuffer(),
      headers: request.headers(),
    });
  }
});
const prefix = "QA-browser-" + Date.now();
const snapshots = await mkdtemp(join(tmpdir(), "myfinance-qa-"));
const dialog = () => page.getByRole("dialog");
const go = async (path) => {
  await page.goto(base + path);
  await page.getByRole("heading", { level: 1 }).waitFor();
};
const button = (name) => page.getByRole("button", { name, exact: true });
const fill = async (values) => {
  for (const [label, value] of Object.entries(values))
    await dialog().getByLabel(label, { exact: true }).fill(String(value));
};
const save = async (name) => {
  await dialog().getByRole("button", { name, exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
};
const rowCounts = async () =>
  (
    await sql`select (select count(*) from income)::int income,(select count(*) from expenses)::int expenses,(select count(*) from bills)::int bills,(select count(*) from bill_payments)::int bill_payments,(select count(*) from debts)::int debts,(select count(*) from debt_payments)::int debt_payments,(select count(*) from financial_goals)::int goals,(select count(*) from budgets)::int budgets,(select count(*) from cfo_notes)::int notes`
  )[0];
async function closeChecks(trigger, label) {
  const before = await rowCounts();
  for (const close of ["Cancel", "Close dialog", "Escape"]) {
    await trigger.click();
    await dialog().waitFor();
    const input = dialog().getByLabel(label, { exact: true });
    const initial = await input.inputValue();
    await input.fill(
      initial === "0"
        ? "12"
        : initial ||
            ((await input.getAttribute("type")) === "number"
              ? "12"
              : "Unsaved QA"),
    );
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
      "Focus must stay in dialog",
    );
    if (close === "Escape") await page.keyboard.press("Escape");
    else
      await dialog().getByRole("button", { name: close, exact: true }).click();
    await dialog().waitFor({ state: "hidden" });
    assert(
      await trigger.evaluate((el) => el === document.activeElement),
      "Focus returns to trigger",
    );
    await trigger.click();
    await dialog().waitFor();
    assert.equal(
      await dialog().getByLabel(label, { exact: true }).inputValue(),
      initial,
      "Reopening restores clean form",
    );
    await page.keyboard.press("Escape");
    await dialog().waitFor({ state: "hidden" });
  }
  assert.deepEqual(await rowCounts(), before, "Closing must not write");
}
try {
  for (const route of [
    "/dashboard",
    "/cash-flow",
    "/bills",
    "/budget",
    "/goals",
    "/reports",
    "/settings",
    "/payday",
  ]) {
    await page.goto(base + route);
    assert(
      new URL(page.url()).pathname === "/login",
      route + " requires login",
    );
  }
  await page.getByLabel("Username", { exact: true }).fill("qa-local");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await button("Sign In").click();
  await page.getByRole("alert").waitFor();
  await page.getByLabel("Username", { exact: true }).fill("qa-local");
  await page.getByLabel("Password", { exact: true }).fill("qa-local-password");
  await button("Sign In").click();
  await page.waitForURL(base + "/dashboard");
  await page.getByText("No cash-flow history yet.", { exact: false }).waitFor();
  assert.equal(await page.getByText(/\bNaN\b/).count(), 0);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "finance_session",
  );
  assert(
    cookie?.httpOnly && cookie.sameSite === "Lax" && cookie.secure,
    "Production cookie flags",
  );

  await go("/cash-flow");
  await closeChecks(button("Add Transaction"), "Source");
  await button("Add Transaction").click();
  await fill({
    Source: prefix + " income",
    Amount: 2000000,
    Date: jakartaDate(),
    Notes: "QA",
  });
  let releaseIncome;
  const incomeGate = new Promise((resolve) => {
    releaseIncome = resolve;
  });
  await page.route("**/cash-flow", async (route) => {
    if (route.request().method() === "POST") await incomeGate;
    await route.continue();
  });
  await dialog()
    .getByRole("button", { name: "Save Income", exact: true })
    .click();
  await dialog().getByRole("status").waitFor();
  assert(
    await dialog()
      .getByRole("button", { name: "Save Income", exact: true })
      .isDisabled(),
    "Pending mutation prevents double submit",
  );
  releaseIncome();
  await dialog().waitFor({ state: "hidden" });
  await page.unroute("**/cash-flow");
  await page.reload();
  await page.getByText(prefix + " income", { exact: true }).waitFor();
  assert.equal(
    (await sql`select amount from income where source=${prefix + " income"}`)[0]
      .amount,
    2000000,
  );
  await button("Add Transaction").click();
  await dialog().getByRole("button", { name: "Expense", exact: true }).click();
  await fill({
    Description: prefix + " expense",
    Amount: 250000,
    Date: jakartaDate(),
    Category: "living",
  });
  await save("Save Expense");
  await page.reload();
  await page.getByText(prefix + " expense", { exact: true }).waitFor();
  assert.equal(
    (
      await sql`select amount from expenses where description=${prefix + " expense"}`
    )[0].amount,
    250000,
  );
  console.log(
    "PASS browser: login, Cash Flow income/expense persistence, cancel/X/Escape/focus/reset",
  );

  await go("/bills");
  await closeChecks(button("+ Add Bill"), "Bill name");
  await button("+ Add Bill").click();
  await fill({
    "Bill name": prefix + " bill",
    Amount: 100000,
    "Due day": 31,
    Category: "utilities",
    Notes: "QA",
  });
  await save("Save Bill");
  let billRow = page
    .locator("div.border-b")
    .filter({ has: page.getByText(prefix + " bill", { exact: true }) })
    .last();
  await billRow.getByRole("button", { name: "Mark Paid", exact: true }).click();
  await billRow.getByText("Paid", { exact: true }).waitFor();
  await page.reload();
  assert.equal(
    (
      await sql`select bp.status from bill_payments bp join bills b on b.id=bp.bill_id where b.name=${prefix + " bill"}`
    )[0].status,
    "paid",
  );
  billRow = page
    .locator("div.border-b")
    .filter({ has: page.getByText(prefix + " bill", { exact: true }) })
    .last();
  assert.equal(
    await billRow
      .getByRole("button", { name: "Mark Paid", exact: true })
      .count(),
    0,
  );
  await billRow.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    (
      await sql`select count(*)::int n from bills where name=${prefix + " bill"}`
    )[0].n,
    1,
  );

  await button("Debt").click();
  await closeChecks(button("+ Add Debt"), "Debt name");
  await button("+ Add Debt").click();
  await fill({
    "Debt name": prefix + " debt",
    Lender: "QA",
    "Original amount": 500000,
    "Remaining amount": 600000,
    "Monthly payment": 100000,
    "Due day": 20,
  });
  await dialog()
    .getByRole("button", { name: "Save Debt", exact: true })
    .click();
  await dialog().getByRole("alert").waitFor();
  assert.equal(
    await dialog().getByLabel("Debt name", { exact: true }).inputValue(),
    prefix + " debt",
  );
  await fill({ "Remaining amount": 500000 });
  await save("Save Debt");
  let debtCard = page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " debt", { exact: true }) });
  await closeChecks(
    debtCard.getByRole("button", { name: "Record Payment", exact: true }),
    "Payment amount",
  );
  await debtCard
    .getByRole("button", { name: "Record Payment", exact: true })
    .click();
  await dialog()
    .getByText(prefix + " debt", { exact: false })
    .waitFor();
  await fill({ "Payment amount": 100000 });
  await save("Record Payment");
  await page.reload();
  await button("Debt").click();
  assert.equal(
    (
      await sql`select remaining_amount from debts where name=${prefix + " debt"}`
    )[0].remaining_amount,
    400000,
  );
  debtCard = page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " debt", { exact: true }) });
  await debtCard
    .getByRole("button", { name: "Record Payment", exact: true })
    .click();
  await fill({ "Payment amount": 400000 });
  await save("Record Payment");
  await page.reload();
  await button("Debt").click();
  await debtCard.getByText("Paid Off", { exact: true }).waitFor();
  assert.equal(
    await debtCard
      .getByRole("button", { name: "Record Payment", exact: true })
      .count(),
    0,
  );
  assert((await debtCard.innerText()).includes("100% paid"));
  assert.equal(
    (
      await sql`select remaining_amount from debts where name=${prefix + " debt"}`
    )[0].remaining_amount,
    0,
  );
  console.log(
    "PASS browser: bill paid state, debt error recovery, partial/full payment, paid-off persistence",
  );

  await go("/budget");
  await closeChecks(button("Edit Plan"), "Living Expenses");
  await button("Edit Plan").click();
  await fill({
    "Bills & Debt": 100000,
    "Living Expenses": 500000,
    Savings: 200000,
    Investments: 100000,
    Lifestyle: 100000,
    Buffer: 100000,
  });
  await save("Save Plan");
  await page.reload();
  assert.equal(
    Number(
      (
        await sql`select sum(allocated_amount) total from budgets where month=${currentMonth().start}`
      )[0].total,
    ),
    1100000,
  );
  await go("/goals");
  await closeChecks(button("+ New Goal"), "Goal name");
  await button("+ New Goal").click();
  await fill({
    "Goal name": prefix + " goal",
    "Target amount": 500000,
    "Already saved": 0,
  });
  await save("Create Goal");
  let goalCard = page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " goal", { exact: true }) });
  await closeChecks(
    goalCard.getByRole("button", { name: "Add Progress", exact: true }),
    "Contribution",
  );
  await goalCard
    .getByRole("button", { name: "Add Progress", exact: true })
    .click();
  await fill({ Contribution: 500000 });
  await save("Add Progress");
  await page.reload();
  await goalCard.getByText("Completed", { exact: true }).waitFor();
  assert.equal(
    await goalCard
      .getByRole("button", { name: "Add Progress", exact: true })
      .count(),
    0,
  );
  assert.equal(
    (
      await sql`select current_amount from financial_goals where name=${prefix + " goal"}`
    )[0].current_amount,
    500000,
  );
  console.log(
    "PASS browser: Plan allocations and goal contribution survive refresh",
  );

  const metric = async (label) =>
    page
      .locator("section")
      .filter({ has: page.getByText(label, { exact: true }) })
      .first()
      .innerText();
  await go("/reports");
  assert.equal(
    await page.locator("main > div form").count(),
    0,
    "Reports has no finance mutation forms",
  );
  assert((await metric("Income")).includes(rupiah(2000000)));
  assert((await metric("Expenses")).includes(rupiah(250000)));
  assert((await metric("Net Cash Flow")).includes(rupiah(1750000)));
  await go("/dashboard");
  assert((await metric("Monthly Surplus")).includes(rupiah(1750000)));
  assert((await metric("Bills Remaining")).includes(rupiah(0)));
  assert((await metric("Total Debt")).includes(rupiah(0)));
  assert((await metric("Monthly Plan")).includes(rupiah(1100000)));
  assert((await metric("Financial Goals")).includes("Completed"));
  await go("/settings");
  await closeChecks(button("Add Note"), "Financial note");
  await button("Add Note").click();
  await fill({ "Financial note": prefix + " note", Category: "QA" });
  await save("Save Note");
  await page.reload();
  await page.getByText(prefix + " note", { exact: true }).waitFor();
  await page.goto(base + "/payday");
  await page.waitForURL(base + "/budget");

  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/dashboard",
      "/cash-flow",
      "/bills",
      "/budget",
      "/goals",
      "/reports",
      "/settings",
    ]) {
      await go(route);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        route + " horizontal overflow at " + width,
      );
      const nav = page.getByRole("navigation", {
        name: width >= 1024 ? "Primary navigation" : "Mobile navigation",
        exact: true,
      });
      await nav.getByRole("link", { name: "Cash Flow", exact: true }).waitFor();
      if (route === "/dashboard")
        await page.screenshot({
          path: join(snapshots, "overview-" + width + ".png"),
          fullPage: true,
        });
    }
    await go("/bills");
    await button("Debt").click();
    await button("+ Add Debt").click();
    const box = await dialog().boundingBox();
    assert(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= width &&
        box.y + box.height <= 900,
      "Dialog fits viewport",
    );
    await page.screenshot({
      path: join(snapshots, "debt-dialog-" + width + ".png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
  }
  console.log(
    "PASS browser: Reports/Overview agreement, Settings, legacy redirect, desktop/tablet/mobile layouts",
  );

  // Delete only the new isolated QA records, through confirmation dialogs.
  await go("/goals");
  goalCard = page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " goal", { exact: true }) });
  await goalCard.getByRole("button", { name: "Delete", exact: true }).click();
  await save("Delete");
  assert.equal(
    (
      await sql`select count(*)::int n from financial_goals where name=${prefix + " goal"}`
    )[0].n,
    0,
  );
  await go("/bills");
  await button("Debt").click();
  debtCard = page
    .getByRole("article")
    .filter({ has: page.getByText(prefix + " debt", { exact: true }) });
  await debtCard.getByRole("button", { name: "Delete", exact: true }).click();
  await save("Delete");
  assert.equal(
    (
      await sql`select count(*)::int n from debts where name=${prefix + " debt"}`
    )[0].n,
    0,
  );
  await button("Bills").click();
  billRow = page
    .locator("div.border-b")
    .filter({ has: page.getByText(prefix + " bill", { exact: true }) })
    .last();
  await billRow.getByRole("button", { name: "Delete", exact: true }).click();
  await save("Delete");
  assert.equal(
    (
      await sql`select count(*)::int n from bills where name=${prefix + " bill"}`
    )[0].n,
    0,
  );
  await button("Logout").filter({ visible: true }).click();
  await page.waitForURL(base + "/login");
  const before = await rowCounts();
  for (const request of actionRequests.values()) {
    const response = await context.request.post(request.url, {
      data: request.body,
      headers: {
        "next-action": request.headers["next-action"],
        "content-type": request.headers["content-type"],
        origin: base,
      },
    });
    assert(
      (response.headers()["x-action-redirect"] ?? "").includes("/login"),
      "Unauthenticated direct action redirects",
    );
  }
  assert.deepEqual(await rowCounts(), before);
  await context.addCookies([
    { ...cookie, value: cookie.value.slice(0, -10) + "tampered!!" },
  ]);
  await page.goto(base + "/dashboard");
  await page.waitForURL(base + "/login");
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(consoleErrors, [], "No console warnings/errors");
  console.log(
    "PASS browser: confirmed deletes, logout, tampered cookie, direct unauthenticated mutations; no console/runtime warnings.",
  );
  console.log("Screenshots:", snapshots);
} catch (error) {
  console.error(
    "Failed page:",
    page.url(),
    await page.locator("main").innerText(),
  );
  console.error(
    "Cookie metadata:",
    (await context.cookies()).map(({ name, secure, httpOnly, domain }) => ({
      name,
      secure,
      httpOnly,
      domain,
    })),
  );
  console.error("Browser errors:", errors, consoleErrors);
  throw error;
} finally {
  await browser.close();
  // Delete only this run's generated rows in the guarded, isolated local database.
  await sql`delete from income where source=${prefix + " income"}`;
  await sql`delete from expenses where description=${prefix + " expense"}`;
  await sql`delete from bills where name=${prefix + " bill"}`;
  await sql`delete from debts where name=${prefix + " debt"}`;
  await sql`delete from financial_goals where name=${prefix + " goal"}`;
  await sql`delete from cfo_notes where content=${prefix + " note"}`;
  await sql.end();
}
