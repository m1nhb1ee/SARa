import { NavLink, useLocation, useNavigate } from "react-router";
import { BookOpen, Stethoscope, BarChart2, Brain, X, Sun, Moon, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/api/authContext";
import { Button } from "@/app/components/ui/button";

const navItems = [
  { icon: BookOpen, label: "Tu on tap", sub: "Browse Library", path: "/cases" },
  { icon: Stethoscope, label: "Dashboard", sub: "Trang chủ", path: "/" },
  { icon: BarChart2, label: "Ket qua cua toi", sub: "My Performance", path: "/performance" },
];

interface SidebarProps {
  onClose?: () => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
}

export function Sidebar({ onClose, theme = "dark", toggleTheme = () => {} }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: "240px",
        backgroundColor: "var(--card)",
        borderRight: "1px solid var(--border)",
        minHeight: "100vh",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between px-4 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 36, height: 36, backgroundColor: "color-mix(in srgb, var(--primary) 13%, transparent)" }}
          >
            <Brain size={20} color="var(--primary)" />
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: "20px",
              color: "var(--primary)",
              letterSpacing: "-0.02em",
            }}
          >
            SARa
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden"
            style={{
              background: "none",
              border: "none",
              color: "var(--secondary-foreground)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              transition: "background-color 500ms ease, color 500ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
              (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--secondary-foreground)";
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/" ||
                location.pathname.startsWith("/session") ||
                location.pathname.startsWith("/answer-key")
              : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className="sidebar-nav-item flex items-center gap-3 rounded-lg"
              data-active={isActive ? "true" : "false"}
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "10px 12px",
                color: isActive ? "var(--primary)" : "var(--secondary-foreground)",
                textDecoration: "none",
                transition:
                  "background-color 500ms cubic-bezier(0.22, 1, 0.36, 1), color 500ms ease, transform 500ms ease",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                />
              )}
              <item.icon size={18} className="shrink-0" style={{ position: "relative", zIndex: 1 }} />
              <div className="flex flex-col min-w-0 flex-1" style={{ position: "relative", zIndex: 1 }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 400,
                    lineHeight: 1.3,
                    transition: "font-weight 500ms ease, color 500ms ease",
                  }}
                >
                  {item.label}
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: 1.2 }}>{item.sub}</span>
              </div>
              <div
                className="rounded-full shrink-0"
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: 6,
                  height: 6,
                  backgroundColor: "var(--primary)",
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? "scale(1)" : "scale(0.5)",
                  transition: "opacity 500ms ease, transform 500ms ease",
                }}
              />
            </NavLink>
          );
        })}
      </nav>

      {/* Theme toggle + User */}
      <div
        className="flex flex-col gap-3 px-4 py-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center gap-2 rounded-lg p-2"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--foreground)",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            width: "100%",
            transition: "background-color 500ms ease, color 500ms ease, transform 320ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in srgb, var(--primary) 12%, var(--muted))";
            (e.currentTarget as HTMLElement).style.color = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)";
            (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          }}
          title={theme === "dark" ? "Switch to light mode (Ivory Fog)" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>

        {/* User */}
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
              color: "var(--primary)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>{user?.username}</span>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              {user?.is_staff ? 'Admin' : 'Student'}
            </span>
          </div>
        </div>

        {/* Logout button */}
        <Button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-gray-0 hover:bg-red-800 text-red-100"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </Button>
      </div>
    </aside>
  );
}
