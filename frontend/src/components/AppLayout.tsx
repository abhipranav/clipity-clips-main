import type { ReactElement } from "react";
import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, 
  PlusCircle, 
  Film, 
  Library, 
  ListTodo, 
  Settings,
  Clapperboard,
  Menu,
  X
} from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import "./AppLayout.css";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

function NavItem({ to, icon: Icon, label, onClick }: NavItemProps): ReactElement {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  
  return (
    <NavLink 
      to={to} 
      className={`nav-item ${isActive ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon size={20} />
      <span>{label}</span>
      {isActive && (
        <motion.div
          className="nav-indicator"
          layoutId="nav-indicator"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }): ReactElement {
  return (
    <>
      <div className="sidebar-header">
        <div className="logo">
          <Clapperboard size={28} className="logo-icon" />
          <span className="logo-text">Clipity</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <NavItem to="/" icon={Home} label="Dashboard" onClick={onNavClick} />
        <NavItem to="/new" icon={PlusCircle} label="New Job" onClick={onNavClick} />
        <NavItem to="/runs" icon={Film} label="Runs" onClick={onNavClick} />
        <NavItem to="/library" icon={Library} label="Library" onClick={onNavClick} />
        <NavItem to="/queue" icon={ListTodo} label="Queue" onClick={onNavClick} />
        <NavItem to="/settings" icon={Settings} label="Settings" onClick={onNavClick} />
      </nav>
      
      <div className="sidebar-footer">
        <div className="version">v1.0.0</div>
        <ThemeToggle size="sm" />
      </div>
    </>
  );
}

export function AppLayout(): ReactElement {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleMobileNav = (): void => setMobileNavOpen(!mobileNavOpen);
  const closeMobileNav = (): void => setMobileNavOpen(false);

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <SidebarContent />
      </aside>
      
      {/* Mobile Top Bar */}
      <header className="top-bar">
        <div className="mobile-logo">
          <Clapperboard size={24} style={{ color: "var(--color-accent)" }} />
          <span className="mobile-logo-text">Clipity</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ThemeToggle size="sm" />
          <button 
            className="mobile-menu-btn" 
            onClick={toggleMobileNav}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              className="mobile-nav-overlay open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileNav}
            />
            <motion.aside
              className="mobile-nav open"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "var(--space-4) var(--space-5)",
                borderBottom: "1px solid var(--color-border-subtle)"
              }}>
                <div className="mobile-logo">
                  <Clapperboard size={24} style={{ color: "var(--color-accent)" }} />
                  <span className="mobile-logo-text">Clipity</span>
                </div>
                <button 
                  className="mobile-menu-btn" 
                  onClick={closeMobileNav}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ flex: 1, padding: "var(--space-4)" }}>
                <nav style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <NavItem to="/" icon={Home} label="Dashboard" onClick={closeMobileNav} />
                  <NavItem to="/new" icon={PlusCircle} label="New Job" onClick={closeMobileNav} />
                  <NavItem to="/runs" icon={Film} label="Runs" onClick={closeMobileNav} />
                  <NavItem to="/library" icon={Library} label="Library" onClick={closeMobileNav} />
                  <NavItem to="/queue" icon={ListTodo} label="Queue" onClick={closeMobileNav} />
                  <NavItem to="/settings" icon={Settings} label="Settings" onClick={closeMobileNav} />
                </nav>
              </div>
              <div style={{ 
                padding: "var(--space-4)", 
                borderTop: "1px solid var(--color-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <span className="version">v1.0.0</span>
                <ThemeToggle variant="segmented" size="sm" />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
