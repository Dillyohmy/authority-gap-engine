import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Index from "./pages/Index.tsx";
import ScanPage from "./pages/ScanPage.tsx";
import ScanLoading from "./pages/ScanLoading.tsx";
import ResultsPage from "./pages/ResultsPage.tsx";
import PricingPage from "./pages/PricingPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import AdminLeadsPage from "./pages/AdminLeadsPage.tsx";
import StrategyCallPage from "./pages/StrategyCallPage.tsx";
import ProjectsPage from "./pages/ProjectsPage.tsx";
import NewProjectPage from "./pages/NewProjectPage.tsx";
import IntakePage from "./pages/IntakePage.tsx";
import IntakeReviewPage from "./pages/IntakeReviewPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/scan/loading" element={<ScanLoading />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin/leads" element={<AdminLeadsPage />} />
            <Route path="/strategy-call" element={<StrategyCallPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:projectId/intake" element={<IntakePage />} />
            <Route path="/projects/:projectId/review" element={<IntakeReviewPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
