import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GuestOnlyRoute, ProtectedRoute } from "@/auth/route-guards";
import { AuthProvider } from "@/context/auth-context";
import Index from "./pages/Index.tsx";
import TaskDetail from "./pages/TaskDetail.tsx";
import Profile from "./pages/Profile.tsx";
import Analytics from "./pages/Analytics.tsx";
import AuthPage from "./pages/Auth.tsx";
import OnboardingPage from "./pages/Onboarding.tsx";
import NotFound from "./pages/NotFound.tsx";
import { InteractionStoreProvider } from "@/context/interaction-store";

const queryClient = new QueryClient();
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <InteractionStoreProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={routerBasename}>
            <Routes>
              <Route
                path="/auth"
                element={(
                  <GuestOnlyRoute>
                    <AuthPage />
                  </GuestOnlyRoute>
                )}
              />
              <Route
                path="/onboarding"
                element={(
                  <ProtectedRoute allowIncompleteProfile>
                    <OnboardingPage />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/"
                element={(
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/task/:id"
                element={(
                  <ProtectedRoute>
                    <TaskDetail />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/profile"
                element={(
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/analytics"
                element={(
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="*"
                element={(
                  <ProtectedRoute>
                    <NotFound />
                  </ProtectedRoute>
                )}
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </InteractionStoreProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
