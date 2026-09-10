import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="Monthly Reports" subtitle="Ringkasan yang membantu keputusan finansial bulan berikutnya." initial={[{id:1,name:"Net worth",detail:"Naik dari bulan lalu",amount:40900000},{id:2,name:"Monthly surplus",detail:"September 2026",amount:1800000}]}/>; }
