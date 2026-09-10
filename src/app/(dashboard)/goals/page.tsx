import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="Financial Goals" subtitle="Sasaran yang diberi prioritas dan dilacak progresnya." initial={[{id:1,name:"Dana Darurat",detail:"Target 6 bulan biaya hidup",amount:15000000},{id:2,name:"Laptop Baru",detail:"Target Desember 2026",amount:4500000}]}/>; }
