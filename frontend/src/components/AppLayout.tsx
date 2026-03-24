import type { ReactElement } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Home, 
  PlusCircle, 
  Film, 
  Library, 
  ListTodo, 
  Settings,
  Clapperboard
} from "./icons";
import "./AppLayout.css";

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }): ReactElement {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  
  return (
    <NavLink to={to} className={`nav-item ${isActive ? "active" : ""}`}>
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

export function AppLayout(): ReactElement {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <Clapperboard size={28} className="logo-icon" />
            <span className="logo-text">Clipity</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <NavItem to="/" icon={Home} label="Dashboard" />
          <NavItem to="/new" icon={PlusCircle} label="New Job" />
          <NavItem to="/runs" icon={Film} label="Runs" />
          <NavItem to="/library" icon={Library} label="Library" />
          <NavItem to="/queue" icon={ListTodo} label="Queue" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </nav>
        
        <div className="sidebar-footer">
          <div className="version">v1.0.0</div>
        </div>
      </aside>
      
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
