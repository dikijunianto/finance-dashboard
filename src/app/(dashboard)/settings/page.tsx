import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="CFO Notes" subtitle="Catat tindakan dan pengingat finansial paling penting." initial={[{id:1,name:"Review subscriptions",detail:"Prioritas sedang",amount:0},{id:2,name:"Fokus kartu kredit",detail:"Prioritas tinggi",amount:0}]}/>; }
