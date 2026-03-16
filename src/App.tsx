import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleGuard from "@/components/auth/RoleGuard";
import MainLayout from "@/components/layout/MainLayout";
import SignIn from "@/pages/SignIn";
import Dashboard from "@/pages/Dashboard";
import CasesPage from "@/pages/CasesPage";
import NewCasePage from "@/pages/NewCasePage";
import CaseDetailPage from "@/pages/CaseDetailPage";
import DocumentsPage from "@/pages/DocumentsPage";
import DocumentDetailPage from "@/pages/DocumentDetailPage";
import ExportsPage from "@/pages/ExportsPage";
import AdminPage from "@/pages/AdminPage";
import AuditLogPage from "@/pages/AuditLogPage";
import EvaluateWorkspacePage from "@/pages/EvaluateWorkspacePage";
import EvaluateCaseListPage from "@/pages/EvaluateCaseListPage";
import EvaluatePackageViewPage from "@/pages/EvaluatePackageViewPage";
import EvaluateConfigPage from "@/pages/EvaluateConfigPage";
import EvaluateAnalyticsPage from "@/pages/EvaluateAnalyticsPage";
import ModuleGuard from "@/components/auth/ModuleGuard";
import CalibrationPage from "@/pages/CalibrationPage";
import NegotiateWorkspacePage from "@/pages/NegotiateWorkspacePage";
import BenchmarkDashboardPage from "@/pages/BenchmarkDashboardPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<CasesPage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/cases/new" element={<NewCasePage />} />
              <Route path="/cases/:caseId" element={<CaseDetailPage />} />

              {/* EvaluateIQ routes */}
              <Route
                path="/evaluate"
                element={
                  <ModuleGuard moduleId="evaluateiq">
                    <EvaluateCaseListPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="/cases/:caseId/evaluate"
                element={
                  <ModuleGuard moduleId="evaluateiq">
                    <EvaluateWorkspacePage />
                  </ModuleGuard>
                }
              />
              <Route
                path="/cases/:caseId/evaluate/package"
                element={
                  <ModuleGuard moduleId="evaluateiq">
                    <EvaluatePackageViewPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="/evaluate/config"
                element={
                  <ModuleGuard moduleId="evaluateiq">
                    <EvaluateConfigPage />
                  </ModuleGuard>
                }
              />
              <Route
                path="/evaluate/analytics"
                element={
                  <ModuleGuard moduleId="evaluateiq">
                    <EvaluateAnalyticsPage />
                  </ModuleGuard>
                }
              />

              {/* NegotiateIQ routes */}
              <Route
                path="/cases/:caseId/negotiate"
                element={
                  <ModuleGuard moduleId="negotiateiq">
                    <NegotiateWorkspacePage />
                  </ModuleGuard>
                }
              />

              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:docId" element={<DocumentDetailPage />} />
              <Route
                path="/exports"
                element={
                  <RoleGuard permission="download_artifacts">
                    <ExportsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin"
                element={
                  <RoleGuard permission="view_admin">
                    <AdminPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/calibration"
                element={
                  <RoleGuard permission="view_admin">
                    <CalibrationPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/benchmarks"
                element={
                  <RoleGuard permission="view_admin">
                    <BenchmarkDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/audit"
                element={
                  <RoleGuard permission="view_audit_log">
                    <AuditLogPage />
                  </RoleGuard>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
