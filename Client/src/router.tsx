
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
import AdminOperations from "./pages/Admin/AdminOperations";
import StaffDashboard from "./pages/StaffDashboard";
import SetStaffPassword from "./pages/SetStaffPassword";

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

      {
      path: "auth/set-password",
      element: <SetStaffPassword />,
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
          { path: "appointments", element: <AdminOperations mode="appointments" /> },
          { path: "team", element: <AdminOperations mode="team" /> },
          { path: "services", element: <AdminOperations mode="services" /> },
          { path: "settings", element: <AdminOperations mode="settings" /> },
        ],
      },
    ],
  },
]);

export default router;
