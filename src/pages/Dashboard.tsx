import { Link } from "react-router-dom";
import { useCases } from "@/hooks/useCases";
import { useAllDocuments } from "@/hooks/useDocuments";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  Briefcase,
  FileText,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Inbox,
} from "lucide-react";

const Dashboard = () => {
  const { data: cases = [], isLoading: casesLoading } = useCases();
  const { data: documents = [], isLoading: docsLoading } = useAllDocuments();

  const loading = casesLoading || docsLoading;

  const openCases = cases.filter(
    (c) => c.case_status !== "closed" && c.case_status !== "exported"
  ).length;

  const docsProcessing = documents.filter(
    (d) => d.document_status === "ocr_in_progress" || d.document_status === "queued"
  ).length;

  const readyToComplete = cases.filter(
    (c) => c.case_status === "complete"
  ).length;

  const totalDocs = documents.length;

  const stats = [
    { label: "Open Cases", value: openCases, icon: Briefcase, color: "text-primary" },
    { label: "Docs Processing", value: docsProcessing, icon: FileText, color: "text-status-processing" },
    { label: "Ready to Complete", value: readyToComplete, icon: CheckCircle2, color: "text-status-approved" },
    { label: "Total Documents", value: totalDocs, icon: TrendingUp, color: "text-status-attention" },
  ];

  const recentCases = [...cases]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">Claims intelligence overview</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => <CardSkeleton key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="card-elevated px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="section-label">{stat.label}</span>
                <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Cases */}
        <div className="card-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-semibold text-foreground">Recent Cases</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-4 space-y-2.5">
                {[1,2,3].map(i => <div key={i} className="animate-pulse h-10 bg-accent rounded-lg" />)}
              </div>
            ) : recentCases.length === 0 ? (
              <EmptyState icon={Inbox} title="No cases yet" description="Create your first case to get started." />
            ) : (
              recentCases.map((c) => (
                <Link key={c.id} to={`/cases/${c.id}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/40 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors truncate">{c.title || `${c.claimant} v. ${c.insured}`}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.case_number} · {new Date(c.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="card-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-semibold text-foreground">Recent Documents</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-4 space-y-2.5">
                {[1,2,3].map(i => <div key={i} className="animate-pulse h-10 bg-accent rounded-lg" />)}
              </div>
            ) : recentDocs.length === 0 ? (
              <EmptyState icon={FileText} title="No documents yet" description="Upload documents through a case to begin." />
            ) : (
              recentDocs.map((d) => (
                <div key={d.id} className="px-4 py-2.5 hover:bg-accent/40 transition-colors">
                  <p className="text-[13px] font-medium text-foreground truncate">{d.file_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {d.document_type.replace(/_/g, " ")} · {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
