
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useState } from "react";

const menuItems = [
  { number: "01", label: "Overview", path: "/admin/dashboard" },
  { number: "02", label: "Appointments", path: "/admin/appointments" },
  { number: "03", label: "Team", path: "/admin/team" },
  { number: "04", label: "Services & pricing", path: "/admin/services" },
  { number: "05", label: "Settings", path: "/admin/settings" },
];

const AdminSidebar = () => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      setLoggingOut(false);
      return;
    }

    navigate("/team/login", { replace: true });
  };

  return (
    <aside className="flex min-h-screen w-[280px] shrink-0 flex-col bg-[#34251F] px-6 py-8 text-[#F7F2EA] max-lg:hidden">

      {/* BRAND */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#A98E7C] font-serif text-xl">
          B
        </div>

        <h2 className="font-serif text-[23px]">
          Bookify
        </h2>
      </div>

      <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-[#B99C89]">
        Admin workspace
      </p>

      <div className="mt-8 border-t border-[#5A453A]" />

      {/* NAVIGATION */}
      <nav className="mt-6 flex flex-col gap-3">
        {menuItems.map((item) => (
          <NavLink
            key={item.number}
            to={item.path}
            end={item.path === "/admin/dashboard"}
            className={({ isActive }) =>
              `flex h-[52px] items-center gap-5 rounded-sm px-4 text-[13px] transition-colors ${
                isActive
                  ? "bg-[#EEE3D3] font-medium text-[#34251F]"
                  : "text-[#E8D8C9] hover:bg-[#49362C]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`text-[11px] ${
                    isActive ? "text-[#70263E]" : "text-[#A58B7C]"
                  }`}
                >
                  {item.number}
                </span>

                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* PROFILE SECTION */}
      <div className="mt-auto pt-10">
        <div className="border-t border-[#5A453A] pt-6">

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEE3D3] font-serif text-lg text-[#34251F]">
              A
            </div>

            <div>
              <p className="text-[13px] font-semibold">
                Administrator
              </p>

              <p className="mt-1 text-[11px] text-[#B99C89]">
                Admin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-6 w-full border border-[#6B5246] px-4 py-3 text-left text-[12px] text-[#E8D8C9] transition-colors hover:bg-[#49362C] disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>

        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
