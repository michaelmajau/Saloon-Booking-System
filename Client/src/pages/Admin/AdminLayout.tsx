import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-[#EFE8DE]">
      <AdminSidebar />

      <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-10 lg:px-12">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
