import React, { useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import CaseList from "@/components/case/CaseList";
import CaseSidebarNav from "@/components/case/CaseSidebarNav";
import ChronologyView from "@/components/case/ChronologyView";
import DocumentsView from "@/components/case/DocumentsView";
import IssuesView from "@/components/case/IssuesView";
import EvidencePanel from "@/components/case/EvidencePanel";
import { mockCases, mockDocuments, mockEvents, mockIssues } from "@/data/mock";
import { TimelineEvent, EventStatus } from "@/types";

type WorkspaceTab = "chronology" | "documents" | "issues";

const Index = () => {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>("case-001");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chronology");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>(mockEvents);
  const [currentPage] = useState(1);

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

  const handleApproveEvent = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, status: EventStatus.Approved, reviewedAt: new Date().toISOString(), version: e.version + 1 }
          : e
      )
    );
  }, []);

  const handleRejectEvent = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, status: EventStatus.Rejected, reviewedAt: new Date().toISOString(), version: e.version + 1 }
          : e
      )
    );
  }, []);

  // Sidebar content
  const sidebar = (
    <div className="flex flex-col h-full">
      <AppHeader />
      {selectedCase ? (
        <CaseSidebarNav
          caseData={selectedCase}
          documents={caseDocuments}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      ) : (
        <CaseList
          cases={mockCases}
          selectedCaseId={selectedCaseId}
          onSelectCase={handleSelectCase}
        />
      )}
      {selectedCase && (
        <button
          onClick={() => {
            setSelectedCaseId(null);
            setSelectedEventId(null);
          }}
          className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
        >
          ← All Cases
        </button>
      )}
    </div>
  );

  // Workspace content
  let workspace: React.ReactNode;
  if (!selectedCase) {
    workspace = (
      <CaseList
        cases={mockCases}
        selectedCaseId={selectedCaseId}
        onSelectCase={handleSelectCase}
      />
    );
  } else if (activeTab === "chronology") {
    workspace = (
      <ChronologyView
        events={caseEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        onApproveEvent={handleApproveEvent}
        onRejectEvent={handleRejectEvent}
        currentPage={currentPage}
        totalPages={1}
        onPageChange={() => {}}
      />
    );
  } else if (activeTab === "documents") {
    workspace = <DocumentsView documents={caseDocuments} />;
  } else {
    workspace = <IssuesView issues={caseIssues} />;
  }

  // Evidence panel (only in chronology view)
  const evidence =
    selectedCase && activeTab === "chronology" ? (
      <EvidencePanel event={selectedEvent} />
    ) : undefined;

  return (
    <AppLayout sidebar={sidebar} workspace={workspace} evidence={evidence} />
  );
};

export default Index;
