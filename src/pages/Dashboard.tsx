import { mockCases, mockDocuments, mockChronologyEvents, mockIssueFlags, mockJobs, mockReviewItems } from "@/data/mock/index";
import { CaseStatus, ReviewState, DocumentStatus, JobStatus, FlagStatus, ReviewStatus } from "@/types";
import {
  Briefcase,
  ClipboardCheck,
  FileText,
  Download,
  AlertTriangle,
  Clock,
} from "lucide-react";

const Dashboard = () => {
  const openCases = mockCases.filter(
    (c) => c.case_status !== CaseStatus.Archived && c.case_status !== CaseStatus.Exported
  ).length;

  const awaitingReview = mockCases.filter(
    (c) => c.case_status === CaseStatus.Review
  ).length;

  const docsProcessing = mockDocuments.filter(
    (d) => d.document_status === DocumentStatus.Processing
  ).length;

  const readyForExport = mockCases.filter(
    (c) => c.case_status === CaseStatus.Approved
  ).length;

  const pendingReviewItems = mockReviewItems.filter(
    (r) => r.review_status === ReviewStatus.Pending
  ).length;

  const openIssues = mockIssueFlags.filter(
    (i) => i.status === FlagStatus.Open
  ).length;

  const failedJobs = mockJobs.filter(
    (j) => j.job_status === JobStatus.Failed
  ).length;

  const stats = [
    { label: "Open Cases", value: openCases, icon: Briefcase, accent: "text-primary" },
    { label: "Awaiting Review", value: awaitingReview, icon: ClipboardCheck, accent: "text-[hsl(var(--status-review))]" },
    { label: "Docs Processing", value: docsProcessing, icon: FileText, accent: "text-primary" },
    { label: "Ready for Export", value: readyForExport, icon: Download, accent: "text-[hsl(var(--status-approved))]" },
  ];

  const workQueue = [
    { label: "Review items pending", value: pendingReviewItems },
    { label: "Open issue flags", value: openIssues },
    { label: "Failed jobs", value: failedJobs },
  ];

  const recentActivity = [
    { text: "Martinez v. Pacific Freight Lines — 2 events approved", time: "2 hours ago" },
    { text: "Thompson v. Meridian Properties — extraction job failed", time: "5 hours ago" },
    { text: "Park v. Summit Logistics — case approved for export", time: "1 day ago" },
    { text: "Nguyen v. Coastal Health Systems — case created", time: "3 days ago" },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Claims intelligence overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border rounded-lg px-4 py-4 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.accent}`} />
            </div>
            <p className="text-2xl font-semibold text-card-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-lg bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-review))]" />
              Work Queue
            </h2>
          </div>
          <div className="divide-y divide-border">
            {workQueue.map((item) => (
              <div key={item.label} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-card-foreground">{item.label}</span>
                <span className="text-sm font-semibold text-card-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-lg bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((item, idx) => (
              <div key={idx} className="px-4 py-3">
                <p className="text-sm text-card-foreground">{item.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
