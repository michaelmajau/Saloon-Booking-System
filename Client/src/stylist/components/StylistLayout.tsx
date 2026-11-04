/**
 * Shell for every /staff page: the stylist sidebar + the page content.
 * The site Navbar comes from the team's MainLayout above this.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { StoreProvider, useStore } from "../store/StoreProvider";
import { UIProvider } from "../store/UIProvider";
import "../stylist.css";

/** The signed-in stylist's name, from their Supabase account. */
interface StylistUser { firstName: string; fullName: string; email: string }
const UserContext = createContext<StylistUser | null>(null);

/** First name for greetings — Supabase account first, sample data as a fallback. */
export function useStylistFirstName(): string {
  const user = useContext(UserContext);
  const { db } = useStore();
  return user?.firstName || db.stylist.firstName;
}

const NAV = [
  ["/staff/dashboard", "Overview"],
  ["/staff/appointments", "Appointments"],
  ["/staff/schedule", "My schedule"],
  ["/staff/clients", "Clients"],
  ["/staff/settings", "Settings"],
] as const;

function Sidebar() {
  const navigate = useNavigate();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }
    navigate("/team/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <NavLink className="brand" to="/staff/dashboard" end>The Chair &amp; Co.</NavLink>
        <small>Stylist workspace</small>
      </div>
      <nav aria-label="Stylist">
        <ul className="side-nav">
          {NAV.map(([to, label]) => (
            // NavLink sets aria-current="page" on the active link, which the CSS styles.
            <li key={to}><NavLink to={to} end>{label}</NavLink></li>
          ))}
        </ul>
      </nav>
      <button type="button" className="signout" onClick={signOut}>Sign out</button>
    </aside>
  );
}

export function StylistLayout() {
  const [user, setUser] = useState<StylistUser | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      // Access is checked by the team's StaffRoute in router.tsx.
      const fullName: string = data.user.user_metadata?.full_name ?? "";
      setUser({ fullName, firstName: fullName.split(" ")[0] ?? "", email: data.user.email ?? "" });
    });
    return () => { active = false; };
  }, []);

  return (
    <UserContext.Provider value={user}>
      <StoreProvider>
        <StylistShell>
          <div className="app">
            <Sidebar />
            <main className="main"><Outlet /></main>
          </div>
        </StylistShell>
      </StoreProvider>
    </UserContext.Provider>
  );
}

/** Wrapper that scopes the stylist CSS and hosts dialogs and toasts. */
export function StylistShell({ children }: { children: ReactNode }) {
  return (
    <div className="stylist-app">
      <UIProvider>{children}</UIProvider>
    </div>
  );
}

/** Eyebrow, big serif title, lede and optional buttons at the top of a page. */
export function PageHead({ eyebrow, title, lede, actions }: { eyebrow: string; title: string; lede: ReactNode; actions?: ReactNode }) {
  return (
    <section className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </section>
  );
}
