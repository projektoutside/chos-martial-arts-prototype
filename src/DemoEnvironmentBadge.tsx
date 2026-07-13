import { appEnvironment } from "./appEnvironment";

export function DemoEnvironmentBadge({ demo = appEnvironment.demo }: { demo?: boolean }) {
  if (!demo) return null;
  return (
    <aside className="demo-environment-badge" role="status" aria-label="Demo Environment">
      Demo Environment
    </aside>
  );
}
