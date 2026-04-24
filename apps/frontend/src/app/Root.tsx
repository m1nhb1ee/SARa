import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router";
import { Sidebar } from "./pages/Sidebar";
import { useAuth } from "@/api/authContext";

export function Root() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const html = document.documentElement;
    const body = document.body;
    html.setAttribute("data-theme", theme);
    if (theme === "light") {
      body.classList.add("light");
      body.classList.remove("dark");
    } else {
      body.classList.add("dark");
      body.classList.remove("light");
    }
  }, [theme]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900">
        <div className="text-center space-y-4">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-400">Đang kiểm tra...</p>
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
      style={{ backgroundColor: '#F5EDD6', fontFamily: "'Inter', sans-serif", color: '#2C1810' }}
    >
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet context={{ theme, toggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark") }} />
        </main>
      </div>
    </div>
  );
}
