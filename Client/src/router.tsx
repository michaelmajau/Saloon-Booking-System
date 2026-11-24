
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
import BarberRoute from "./components/BarberRoute";
import TeamLogin from "./pages/TeamLogin";
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminCalendar from "./pages/Admin/AdminCalendar";
import AdminFinance from "./pages/Admin/AdminFinance";
import AdminNotifications from "./pages/Admin/AdminNotifications";
import AdminSettings from "./pages/Admin/AdminSettings";
import AdminTeam from "./pages/Admin/AdminTeam";
import AdminPOS from "./pages/Admin/AdminPOS";
import { CustomersPage, InventoryPage } from "./pages/Admin/AdminDirectory";
import AdminOperations from "./pages/Admin/AdminOperations";
import StaffDashboard from "./pages/StaffDashboard";
import BarberPage from "./pages/BarberPage";
import SetStaffPassword from "./pages/SetStaffPassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Help from "./pages/Help";
import Reports from "./pages/Admin/Reports";
import AuditLogs from "./pages/Admin/AuditLogs";

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
      {
        path: "forgot-password",
        element: <ForgotPassword />,
      },
      {
        path: "reset-password",
        element: <ResetPassword />,
      },
      {
        path: "help",
        element: <Help />,
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
      {
        element: <BarberRoute />,
        children: [{ path: "barber", element: <BarberPage /> }],
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
          { path: "calendar", element: <AdminCalendar /> },
          { path: "pos", element: <AdminPOS /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "inventory", element: <InventoryPage /> },
          { path: "transactions", element: <AdminFinance key="transactions" mode="transactions" /> },
          { path: "expenses", element: <AdminFinance key="expenses" mode="expenses" /> },
          { path: "notifications", element: <AdminNotifications /> },
          { path: "appointments", element: <AdminOperations mode="appointments" /> },
          { path: "team", element: <AdminTeam /> },
          { path: "services", element: <AdminOperations mode="services" /> },
          { path: "settings", element: <AdminSettings /> },
          { path: "reports", element: <Reports /> },
          { path: "audit-logs", element: <AuditLogs /> },
        ],
      },
    ],
  },
]);

export default router;
