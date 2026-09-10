import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="Bills & Debt" subtitle="Kelola tagihan berulang dan kewajiban pembayaran." initial={[{id:1,name:"Internet",detail:"Jatuh tempo 15 Sep",amount:350000},{id:2,name:"Kartu Kredit",detail:"Jatuh tempo 21 Sep",amount:1200000}]}/>; }
