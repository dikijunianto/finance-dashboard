import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="Cash Flow" subtitle="Tinjau pemasukan, pengeluaran besar, dan surplus bulanan." initial={[{id:1,name:"Gaji September",detail:"Pemasukan",amount:10000000},{id:2,name:"Pengeluaran tetap",detail:"Tagihan dan utang",amount:6200000}]}/>; }
