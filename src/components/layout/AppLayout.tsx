import React from "react";

interface AppLayoutProps {
  sidebar: React.ReactNode;
  workspace: React.ReactNode;
  evidence?: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ sidebar, workspace, evidence }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Column — Context */}
      <aside className="w-[280px] min-w-[280px] border-r border-border bg-card flex flex-col overflow-hidden">
        {sidebar}
      </aside>

      {/* Center Column — Workspace */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {workspace}
      </main>

      {/* Right Column — Evidence */}
      {evidence && (
        <aside className="w-[420px] min-w-[420px] border-l border-border bg-card flex flex-col overflow-hidden">
          {evidence}
        </aside>
      )}
    </div>
  );
};

export default AppLayout;
