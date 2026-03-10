import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleGuard from "@/components/auth/RoleGuard";
import MainLayout from "@/components/layout/MainLayout";
import SignIn from "@/pages/SignIn";
import Dashboard from "@/pages/Dashboard";
import CasesPage from "@/pages/CasesPage";
import CaseDetailPage from "@/pages/CaseDetailPage";
import DocumentsPage from "@/pages/DocumentsPage";
import ReviewQueuePage from "@/pages/ReviewQueuePage";
import ExportsPage from "@/pages/ExportsPage";
import AdminPage from "@/pages/AdminPage";
import AuditLogPage from "@/pages/AuditLogPage";
import NotFound from "@/pages/NotFound";

const App = () => (
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:caseId" element={<CaseDetailPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route
              path="/review"
              element={
                <RoleGuard permission="approve_review">
                  <ReviewQueuePage />
                </RoleGuard>
              }
            />
            <Route
              path="/exports"
              element={
                <RoleGuard permission="export_package">
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
);

export default App;
