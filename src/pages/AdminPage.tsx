import { Settings, Users, Building2, ShieldCheck } from "lucide-react";

const sections = [
  {
    label: "Tenant Settings",
    description: "Organization name, slug, and configuration",
    icon: Building2,
  },
  {
    label: "User Management",
    description: "Manage users, roles, and permissions",
    icon: Users,
  },
  {
    label: "Role-Based Access",
    description: "Admin, Reviewer, Analyst, Viewer roles",
    icon: ShieldCheck,
  },
  {
    label: "System Settings",
    description: "Extraction defaults, export formats, integrations",
    icon: Settings,
  },
];

const AdminPage = () => {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tenant administration and system settings
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div
            key={section.label}
            className="border border-border rounded-lg bg-card px-4 py-4 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <section.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{section.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPage;
