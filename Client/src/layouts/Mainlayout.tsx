import { Outlet } from "react-router-dom";
import Navbar from "../commponents/Navbar";
const MainLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
};

export default MainLayout;