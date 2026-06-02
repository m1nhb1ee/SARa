import { Outlet, Navigate } from "react-router";
import { Sidebar } from "./pages/Sidebar";
import { useAuth } from "@/api/authContext";

export function Root() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div className="text-center space-y-4">
          <div className="inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-gold)', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'var(--ink-muted)' }}>Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-page)', fontFamily: 'var(--font-ui)', color: 'var(--ink)' }}
    >
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
