import { WorkspacePage } from "@/components/dashboard/workspace-page";
export default function Page() { return <WorkspacePage title="Budget" subtitle="Alokasikan penghasilan sebelum membelanjakannya." initial={[{id:1,name:"Esensial",detail:"30% dari penghasilan",amount:3000000},{id:2,name:"Tabungan",detail:"20% dari penghasilan",amount:2000000}]}/>; }
