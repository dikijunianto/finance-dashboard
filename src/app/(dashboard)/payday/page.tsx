import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="Payday Plan" subtitle="Buat keputusan alokasi pada hari gajian." initial={[{id:1,name:"Tagihan",detail:"Selesai",amount:3200000},{id:2,name:"Dana darurat",detail:"Direncanakan",amount:1000000}]}/>; }
