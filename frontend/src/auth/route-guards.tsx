import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/context/auth-context";

function FullscreenState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="card-surface p-6 max-w-md w-full text-center">
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { status, profileCompleted } = useAuth();

  if (status === "loading") {
    return <FullscreenState message="Проверяем сессию..." />;
  }

  if (status === "authenticated") {
    return <Navigate to={profileCompleted ? "/" : "/onboarding"} replace />;
  }

  return <>{children}</>;
}

export function ProtectedRoute({
  children,
  allowIncompleteProfile = false,
}: {
  children: ReactNode;
  allowIncompleteProfile?: boolean;
}) {
  const { status, profileCompleted } = useAuth();

  if (status === "loading") {
    return <FullscreenState message="Загружаем данные профиля..." />;
  }

  if (status === "anonymous") {
    return <Navigate to="/auth" replace />;
  }

  if (!allowIncompleteProfile && !profileCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
