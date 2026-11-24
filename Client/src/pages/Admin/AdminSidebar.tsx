import { CalendarCheck, ChevronDown, LogOut, PanelLeftClose } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { initials, sections } from "./adminNavigation";

export default function AdminSidebar({ studio, location, name, onToggle, onNavigate, onSignOut }: {
  studio: string; location: string; name: string; onToggle?: () => void; onNavigate?: () => void; onSignOut: () => void;
}) {
  const { pathname } = useLocation();
  return (
    <aside className="admin-sidebar">
      <div className="bk-brand"><Link to="/admin/dashboard" onClick={onNavigate}><i><CalendarCheck size={22} /></i><strong>Bookify<span>KE</span></strong></Link>
        {onToggle && <button type="button" onClick={onToggle} aria-label="Collapse navigation"><PanelLeftClose size={19} /></button>}
      </div>
      <Link className="bk-studio" to="/admin/settings" onClick={onNavigate}><i>{initials(studio)}</i><div><strong>{studio}</strong><small>{location ? location + " · " : ""}Main branch</small></div><ChevronDown size={16} /></Link>
      <nav aria-label="Admin navigation">
        {sections.map(({ title, links }) => <section key={title}><h2>{title}</h2>{links.map(({ label, path, icon: Icon }) =>
          <NavLink key={path} to={path} end onClick={onNavigate} className={({ isActive }) => isActive || (path === "/admin/dashboard" && pathname === "/admin") ? "admin-nav-active" : undefined}><Icon size={18} />{label}</NavLink>
        )}</section>)}
      </nav>
      <div className="bk-account"><i>{initials(name)}</i><div><strong>{name}</strong><small>Administrator</small></div><button type="button" onClick={onSignOut} aria-label="Sign out"><LogOut size={19} /></button></div>
    </aside>
  );
}
