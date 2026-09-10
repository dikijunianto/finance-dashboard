import { listPlannerItems } from "@/actions/planner";
import { WorkspacePage } from "./workspace-page";
export async function WorkspaceRoute({ title, subtitle, section }: { title: string; subtitle: string; section: string }) { return <WorkspacePage title={title} subtitle={subtitle} section={section} items={await listPlannerItems(section)} />; }
