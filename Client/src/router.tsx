
import { createBrowserRouter } from "react-router-dom";

import MainLayout from "./layouts/Mainlayout";
import LandingPage from "./pages/LandingPage";
import Signup from "./pages/Signup";
import Signin from "./pages/Signin";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import StaffRoute from "./components/StaffRoute";

import TeamLogin from "./pages/TeamLogin";

// Admin
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminSection from "./pages/Admin/AdminSection";
import Team from "./pages/Admin/Team";

// Staff / stylist
import { StylistLayout } from "./stylist/components/StylistLayout";
import { DashboardPage as StaffOverview } from "./stylist/pages/DashboardPage";
import { AppointmentsPage as StaffAppointments } from "./stylist/pages/AppointmentsPage";
import { SchedulePage as StaffSchedule } from "./stylist/pages/SchedulePage";
import { ClientsPage as StaffClients } from "./stylist/pages/ClientsPage";
import { SettingsPage as StaffSettings } from "./stylist/pages/SettingsPage";

const router = createBrowserRouter([
  // PUBLIC AND CUSTOMER ROUTES
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "signup", element: <Signup /> },
      { path: "book", element: <Signup /> },
      { path: "studio", element: <h1>Our Studio</h1> },
      { path: "sign-up", element: <Signup /> },
      { path: "sign-in", element: <Signin /> },
      { path: "team/login", element: <TeamLogin /> },
      { path: "auth/callback", element: <AuthCallback /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: "dashboard", element: <Dashboard /> },
        ],
      },
    ],
  },

  // STAFF ROUTES
  {
    path: "/staff",
    element: <StaffRoute />,
    children: [
      {
        element: <StylistLayout />,
        children: [
          { index: true, element: <StaffOverview /> },
          { path: "dashboard", element: <StaffOverview /> },
          { path: "appointments", element: <StaffAppointments /> },
          { path: "schedule", element: <StaffSchedule /> },
          { path: "clients", element: <StaffClients /> },
          { path: "settings", element: <StaffSettings /> },
        ],
      },
    ],
  },

  // ADMIN ROUTES
  {
    path: "/admin",
    element: <AdminRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: "dashboard", element: <AdminDashboard /> },
          { path: "appointments", element: <Team /> },
          { path: "team", element: <Team /> },
          {
            path: "services",
            element: (
              <AdminSection
                title="Services & pricing"
                description="The server can read services. Add authenticated create, edit and delete endpoints before enabling administration here."
              />
            ),
          },
          {
            path: "settings",
            element: (
              <AdminSection
                title="Settings"
                description="Salon configuration has not been modelled in the supplied backend yet."
              />
            ),
          },
        ],
      },
    ],
  },
]);

export default router;
