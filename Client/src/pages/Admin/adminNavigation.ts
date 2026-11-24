import { Bell, BookOpen, Boxes, ContactRound, CreditCard, ReceiptText, ShoppingBag, CalendarDays, ChartNoAxesColumn, CircleHelp, LayoutDashboard, Scissors, Settings2, ShieldCheck, UsersRound } from "lucide-react";

export const sections = [
  { title: "Workspace", links: [
    { label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Calendar", path: "/admin/calendar", icon: CalendarDays },
    { label: "Appointments", path: "/admin/appointments", icon: BookOpen },
    { label: "Point of Sale", path: "/admin/pos", icon: ShoppingBag },
  ] },
  { title: "Management", links: [
    { label: "Customers", path: "/admin/customers", icon: ContactRound },
    { label: "Team Management", path: "/admin/team", icon: UsersRound },
    { label: "Services", path: "/admin/services", icon: Scissors },
    { label: "Inventory", path: "/admin/inventory", icon: Boxes },
  ] },
  { title: "Finance", links: [
    { label: "Transactions", path: "/admin/transactions", icon: CreditCard },
    { label: "Expenses", path: "/admin/expenses", icon: ReceiptText },
    { label: "Reports & Analytics", path: "/admin/reports", icon: ChartNoAxesColumn },
  ] },
  { title: "Settings", links: [
    { label: "Business Settings", path: "/admin/settings", icon: Settings2 },
    { label: "Notifications", path: "/admin/notifications", icon: Bell },
    { label: "Security & Audit Logs", path: "/admin/audit-logs", icon: ShieldCheck },
    { label: "Help & Support", path: "/help", icon: CircleHelp },
  ] },
];

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
