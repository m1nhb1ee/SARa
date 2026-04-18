import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router";
import { Sidebar } from "./pages/Sidebar";
import { Menu, Brain, Sun, Moon } from "lucide-react";
import { useAuth } from "@/api/authContext";

export function Root() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  });
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    localStorage.setItem("theme", theme);
    // Apply theme via data-theme attribute on html + body class
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

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Show loading while checking auth
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className={`flex min-h-screen`}
      style={{ backgroundColor: "var(--background)", fontFamily: "'Inter', sans-serif", color: "var(--foreground)" }}
    >
      {/* Sidebar  hidden on mobile, always visible on md+ */}
      <div className="hidden md:flex">
        <Sidebar theme={theme} toggleTheme={toggleTheme} />
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          onClick={() => setMobileOpen(false)}
          style={{ backgroundColor: "color-mix(in srgb, var(--background) 75%, transparent)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 260, backgroundColor: "var(--card)", height: "100%", borderRight: "1px solid var(--border)" }}
          >
            <Sidebar onClose={() => setMobileOpen(false)} theme={theme} toggleTheme={toggleTheme} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <div
          className="flex items-center justify-between px-4 py-3 md:hidden"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, backgroundColor: "color-mix(in srgb, var(--primary) 13%, transparent)" }}
            >
              <Brain size={16} color="var(--primary)" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--primary)" }}>SARa</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              style={{ 
                background: "none", 
                border: "none", 
                color: "var(--foreground)", 
                cursor: "pointer", 
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              style={{ background: "none", border: "none", color: "var(--secondary-foreground)", cursor: "pointer", padding: 4 }}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet context={{ theme, toggleTheme }} />
        </main>
      </div>
    </div>
  );
}


