
import { createBrowserRouter } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Hero from "./pages/Hero";
import Signup from "./pages/Signup";
import Signin from "./pages/Signin";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Hero />,
      },
      {
        path: "signup",
        element: <h1>Book an Appointment</h1>,
      },
      {
        path: "studio",
        element: <h1>Our Studio</h1>,
      },
      {
        path: "team",
        element: <h1>Team Portal</h1>,
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
        path: "auth/callback",
        element: <AuthCallback />,
      },
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
]);

export default router;
