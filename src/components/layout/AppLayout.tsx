import { type ReactNode } from "react";

interface AppLayoutProps {
  sidebar: ReactNode;
  workspace: ReactNode;
  evidence?: ReactNode;
}

const AppLayout = ({ sidebar, workspace, evidence }: AppLayoutProps) => {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        {sidebar}
      </aside>

      {/* Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {workspace}
      </main>

      {/* Evidence Panel */}
      {evidence && (
        <aside className="w-[420px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          {evidence}
        </aside>
      )}
    </div>
  );
};

export default AppLayout;
