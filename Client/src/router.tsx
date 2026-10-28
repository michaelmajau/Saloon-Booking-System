import { createBrowserRouter } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import LandingPage from "./pages/LandingPage";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Signin from "./pages/Signin";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "signup", element: <h1>Book an Appointment</h1> },
      { path: "studio", element: <h1>Our Studio</h1> },
      { path: "team", element: <h1>Team Portal</h1> },
      { path: "sign-up", element: <Signup /> },
      { path: "auth/callback", element: <AuthCallback /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "signin", element: <Signin /> },
    ],
  },
]);

export default router;