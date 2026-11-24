import { useEffect, useState } from "react";
import { Bell, ChevronRight, CircleHelp, Menu, Plus, Search } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import AdminSidebar from "./AdminSidebar";
import { initials, sections } from "./adminNavigation";
import { AdminError, AdminModal } from "./components/AdminUI";
import BookingModal from "./components/BookingModal";
import { salonDate } from "./dashboardData";
import type { Appointment, Service, TeamMember } from "./dashboardData";
import "./admin.css";
import "./workspace.css";

export type WorkspaceContext = { studio: string; name: string; revision: number; updateStudio: (studio: { name: string; location: string }) => void; openBooking: (date?: string) => void };
type BookingOptions = { date: string; team: TeamMember[]; services: Service[]; appointments: Appointment[] };

export default function AdminLayout() {
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [studio, setStudio] = useState({ name: "Bookify", location: "" });
  const [name, setName] = useState("Administrator");
  const [booking, setBooking] = useState<BookingOptions>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const links = sections.flatMap((section) => section.links);
  const page = links.find((link) => link.path === location.pathname)?.label ?? "Overview";

  useEffect(() => {
    const controller = new AbortController();
    api<{ settings: { salon_name: string; location: string } | null }>("/admin/settings", { signal: controller.signal })
      .then(({ settings }) => { if (settings) setStudio({ name: settings.salon_name, location: settings.location }); }).catch(() => {});
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !controller.signal.aborted) setName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Administrator");
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openBooking(date = salonDate()) {
    setLoading(true);
    setError("");
    const options = { signal: AbortSignal.timeout(15000) };
    try {
      const [roster, catalogue, history] = await Promise.all([
        api<{ staff: TeamMember[] }>("/admin/team", options),
        api<{ services: Service[] }>("/admin/services", options),
        api<{ appointments: Appointment[] }>("/admin/appointments", options),
      ]);
      setBooking({ date, team: roster.staff, services: catalogue.services, appointments: history.appointments });
    } catch {
      setError("Unable to load appointment options.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setError("Unable to sign out."); return; }
    navigate("/team/login", { replace: true });
  }

  const sidebar = { studio: studio.name, location: studio.location, name, onSignOut: signOut };
  return (
    <div className={`bookify-admin bk-shell ${collapsed ? "bk-collapsed" : ""}`}>
      <div className="bk-sidebar-slot"><AdminSidebar {...sidebar} onToggle={() => setCollapsed(true)} /></div>
      <div className="bk-main">
        <header className="bk-topbar">
          <button type="button" className="bk-menu admin-secondary" aria-label="Show navigation" onClick={() => collapsed && matchMedia("(min-width: 901px)").matches ? setCollapsed(false) : setMenu(true)}><Menu size={18} /></button>
          <div className="bk-breadcrumb"><span>{studio.name}</span><ChevronRight size={15} /><strong>{page}</strong></div>
          <button type="button" className="bk-search" onClick={() => { setQuery(""); setSearch(true); }}><Search size={17} /><span>Search anything...</span><kbd>Ctrl K</kbd></button>
          <Link className="admin-secondary bk-branch" to="/admin/settings"><i />Main branch</Link>
          <button className="admin-primary" type="button" disabled={loading} onClick={() => void openBooking()}><Plus size={17} />{loading ? "Loading…" : "Quick add"}</button>
          <Link className="admin-secondary bk-top-icon" aria-label="Recent activity" to="/admin/audit-logs"><Bell size={18} /></Link>
          <Link className="admin-secondary bk-top-icon" aria-label="Help" to="/help"><CircleHelp size={18} /></Link>
          <Link to="/admin/settings" className="bk-avatar" aria-label="Business settings">{initials(name)}</Link>
        </header>
        <main className="bk-content">
          {error && <AdminError message={error} onRetry={() => error.includes("sign out") ? void signOut() : void openBooking()} />}
          <Outlet context={{ studio: studio.name, name, revision, updateStudio: setStudio, openBooking } satisfies WorkspaceContext} />
        </main>
      </div>
      {menu && <AdminModal title="Workspace navigation" onClose={() => setMenu(false)}><AdminSidebar {...sidebar} onNavigate={() => setMenu(false)} /></AdminModal>}
      {search && <AdminModal title="Search workspace" onClose={() => setSearch(false)}><input className="bk-field" autoFocus placeholder="Search pages" aria-label="Search pages" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="bk-search-results">{links.filter(({ label }) => label.toLowerCase().includes(query.trim().toLowerCase())).map(({ label, path }) => <Link key={path} to={path} onClick={() => setSearch(false)}>{label}</Link>)}</div></AdminModal>}
      {booking && <BookingModal {...booking} onClose={() => setBooking(undefined)} onBooked={() => { setBooking(undefined); setRevision((value) => value + 1); }} />}
    </div>
  );
}
