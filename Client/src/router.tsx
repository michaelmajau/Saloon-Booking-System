
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
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminSection from "./pages/Admin/AdminSection";
import StaffDashboard from "./pages/StaffDashboard";

const router = createBrowserRouter([
  // PUBLIC AND CUSTOMER ROUTES
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "signup",
        element: <Signup />,
      },
      {
        path: "book",
        element: <Signup />,
      },
      {
        path: "studio",
        element: <h1>Our Studio</h1>,
      },
      {
        path: "sign-up",
        element: <Signup />,
      },
      {
        path: "sign-in",
        element: <Signin />,
      },
      {
        path: "team/login",
        element: <TeamLogin />,
      },
      {
        path: "auth/callback",
        element: <AuthCallback />,
      },

      // Customer dashboard
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "dashboard",
            element: <Dashboard />,
          },
        ],
      },
    ],
  },

  {
    path: "/staff",
    element: <StaffRoute />,
    children: [
      { path: "dashboard", element: <StaffDashboard /> },
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
          { path: "appointments", element: <AdminSection title="Appointments" description="Appointment management will connect here once booking records and their API are available." /> },
          { path: "team", element: <AdminSection title="Team" description="The secure staff-invite API exists; this screen needs a staff listing endpoint before it can show live team members." /> },
          { path: "services", element: <AdminSection title="Services & pricing" description="The server can read services. Add authenticated create, edit and delete endpoints before enabling administration here." /> },
          { path: "settings", element: <AdminSection title="Settings" description="Salon configuration has not been modelled in the supplied backend yet." /> },
        ],
      },
    ],
  },
]);

export default router;
