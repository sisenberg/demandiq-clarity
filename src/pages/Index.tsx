import { useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import CaseList from "@/components/case/CaseList";
import CaseSidebarNav from "@/components/case/CaseSidebarNav";
import ChronologyView from "@/components/case/ChronologyView";
import DocumentsView from "@/components/case/DocumentsView";
import IssuesView from "@/components/case/IssuesView";
import EvidencePanel from "@/components/case/EvidencePanel";
import { mockCases, mockDocuments, mockEvents, mockIssues, mockTenant } from "@/data/mock/index";
import type { TimelineEvent } from "@/types";
import { EventStatus } from "@/types";

type WorkspaceTab = "chronology" | "documents" | "issues";

const Index = () => {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chronology");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>(mockEvents);

  const selectedCase = mockCases.find((c) => c.id === selectedCaseId) ?? null;
  const caseDocuments = mockDocuments.filter((d) => d.caseId === selectedCaseId);
  const caseEvents = events.filter((e) => e.caseId === selectedCaseId);
  const caseIssues = mockIssues.filter((i) => i.caseId === selectedCaseId);
  const selectedEvent = caseEvents.find((e) => e.id === selectedEventId) ?? null;

  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedEventId(null);
    setActiveTab("chronology");
  }, []);

  const handleBackToCases = useCallback(() => {
    setSelectedCaseId(null);
    setSelectedEventId(null);
  }, []);

  const handleApproveEvent = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              status: EventStatus.Approved,
              reviewedAt: new Date().toISOString(),
              version: e.version + 1,
            }
          : e
      )
    );
  }, []);

  const handleRejectEvent = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              status: EventStatus.Rejected,
              reviewedAt: new Date().toISOString(),
              version: e.version + 1,
            }
          : e
      )
    );
  }, []);

  // --- Sidebar ---
  const sidebar = (
    <div className="flex flex-col h-full">
      <AppHeader tenantName={mockTenant.name} />
      {selectedCase ? (
        <>
          <CaseSidebarNav
            caseData={selectedCase}
            documents={caseDocuments}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <button
            onClick={handleBackToCases}
            className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors text-left shrink-0"
          >
            ← All Cases
          </button>
        </>
      ) : (
        <CaseList
          cases={mockCases}
          selectedCaseId={selectedCaseId}
          onSelectCase={handleSelectCase}
        />
      )}
    </div>
  );

  // --- Workspace ---
  let workspace: React.ReactNode;
  if (!selectedCase) {
    workspace = (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">DemandIQ</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a case to begin review.
          </p>
        </div>
      </div>
    );
  } else if (activeTab === "chronology") {
    workspace = (
      <ChronologyView
        events={caseEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        onApproveEvent={handleApproveEvent}
        onRejectEvent={handleRejectEvent}
      />
    );
  } else if (activeTab === "documents") {
    workspace = <DocumentsView documents={caseDocuments} />;
  } else {
    workspace = <IssuesView issues={caseIssues} />;
  }

  // --- Evidence ---
  const evidence =
    selectedCase && activeTab === "chronology" ? (
      <EvidencePanel event={selectedEvent} documents={caseDocuments} />
    ) : undefined;

  return <AppLayout sidebar={sidebar} workspace={workspace} evidence={evidence} />;
};

export default Index;
