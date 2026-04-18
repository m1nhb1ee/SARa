import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { BookOpen, Stethoscope, BarChart2, Brain, Sun, Moon, LogOut } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return (
        location.pathname === "/" ||
        location.pathname.startsWith("/session") ||
        location.pathname.startsWith("/answer-key")
      );
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        width: isExpanded ? "280px" : "70px",
        backgroundColor: "var(--card)",
        borderRight: "1px solid var(--border)",
        borderRadius: "0 16px 16px 0",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        transition: "width 250ms ease-in-out",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Logo Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "20px 12px",
          borderBottom: "1px solid var(--border)",
          minHeight: "70px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: "color-mix(in srgb, var(--primary) 13%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Brain size={24} color="var(--primary)" />
        </div>
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: "20px",
            color: "var(--primary)",
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            opacity: isExpanded ? 1 : 0,
            transition: "opacity 250ms ease-in-out 50ms",
          }}
        >
          SARa
        </span>
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 8px",
          overflowY: "auto",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                onClose?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 10px",
                borderRadius: 10,
                textDecoration: "none",
                color: active ? "var(--primary)" : "var(--secondary-foreground)",
                transition: "all 250ms ease-in-out",
                backgroundColor: active
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
                border: active ? "1px solid color-mix(in srgb, var(--primary) 30%, transparent)" : "1px solid transparent",
              }}
              title={item.label}
            >
              <item.icon size={22} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  flex: 1,
                  opacity: isExpanded ? 1 : 0,
                  transition: "opacity 250ms ease-in-out 50ms",
                  visibility: isExpanded ? "visible" : "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: active ? 600 : 500,
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--muted-foreground)",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.sub}
                </span>
              </div>
              {active && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    backgroundColor: "var(--primary)",
                    flexShrink: 0,
                  }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 8px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {/* Theme Toggle - Always visible */}
        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",  // luôn center
            gap: isExpanded ? 12 : 0,  // bỏ gap khi collapsed
            padding: "10px 10px",
            borderRadius: 10,
            backgroundColor: "var(--muted)",
            color: "var(--foreground)",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 250ms ease-in-out",
            width: "100%",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "color-mix(in srgb, var(--primary) 12%, var(--muted))";
            (e.currentTarget as HTMLElement).style.color = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)";
            (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
          }}
          title={theme === "dark" ? "Light Mode" : "Dark Mode"}
          >
          {theme === "dark" ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
          <span
            style={{
              opacity: isExpanded ? 1 : 0,
              width: isExpanded ? "auto" : 0,       // không chiếm space khi ẩn
              overflow: "hidden",                    // tránh text bị tràn ra
              whiteSpace: "nowrap",
              transition: "opacity 250ms ease-in-out 50ms, width 250ms ease-in-out",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>

        {/* User Info with Logout inside */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 10,
            backgroundColor: "transparent",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {user?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              flex: 1,
              opacity: isExpanded ? 1 : 0,
              transition: "opacity 250ms ease-in-out 50ms",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--foreground)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.username}
            </span>
            <span style={{ fontSize: "10px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
              {user?.is_staff ? "Admin" : "Student"}
            </span>
          </div>
          {/* Logout Button inside User section */}
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: "transparent",
              color: "#ef4444",
              border: "none",
              cursor: "pointer",
              transition: "all 250ms ease-in-out",
              padding: 0,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239, 68, 68, 0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
            title="Logout"
          >
            <LogOut size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
