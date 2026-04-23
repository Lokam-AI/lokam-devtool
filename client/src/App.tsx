import { lazy, Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoleGuard } from "@/components/layout/RoleGuard";
import LoginPage from "@/pages/LoginPage";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const MyCallsPage = lazy(() => import("@/pages/MyCallsPage"));
const EvalFormPage = lazy(() => import("@/pages/EvalFormPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const TeamPage = lazy(() => import("@/pages/TeamPage"));
const ChangePasswordPage = lazy(() => import("@/pages/ChangePasswordPage"));
const AllCallsPage = lazy(() => import("@/pages/AllCallsPage"));
const BugsPage = lazy(() => import("@/pages/BugsPage"));
const MyBugsPage = lazy(() => import("@/pages/MyBugsPage"));
const CallDetailPage = lazy(() => import("@/pages/CallDetailPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
            <Route path="/change-password" element={<Suspense fallback={<PageLoader />}><ChangePasswordPage /></Suspense>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/my-bugs" element={<MyBugsPage />} />
              <Route path="/calls" element={<MyCallsPage />} />
              <Route path="/eval/:id" element={<EvalFormPage />} />
              <Route path="/call/:id" element={<CallDetailPage />} />
              <Route
                path="/all-calls"
                element={<RoleGuard minRole="admin"><AllCallsPage /></RoleGuard>}
              />
              <Route
                path="/admin"
                element={<RoleGuard minRole="admin"><AdminPage /></RoleGuard>}
              />
              <Route
                path="/team"
                element={<RoleGuard minRole="admin"><TeamPage /></RoleGuard>}
              />
              <Route
                path="/bugs"
                element={<RoleGuard minRole="admin"><BugsPage /></RoleGuard>}
              />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
