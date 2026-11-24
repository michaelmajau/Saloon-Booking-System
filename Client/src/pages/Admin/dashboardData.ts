export type Appointment = {
  appointment_id: string;
  appointment_date: string;
  customer_id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  payment_status: string;
  customer: { full_name: string | null; email?: string } | null;
  staff: { full_name: string | null } | null;
  service: { service_name: string } | null;
};

export type TeamMember = { staff_id: string; is_active: boolean; profile: { full_name: string | null; email?: string } | null };
export type Service = { service_id: string; service_name: string; duration_minutes: number; price: number };
export type DashboardData = {
  date: string;
  metrics: { todayAppointments: number; activeStaff: number; onShiftStaff?: number };
  appointments: Appointment[];
};

export const salonZone = "Africa/Nairobi";
export const salonDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: salonZone }).format(new Date());
export const salonTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: salonZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
export const shortTime = (time: string) => time.slice(0, 5);
export const displayDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-KE", { ...options, timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const visibleBooking = (appointment: Pick<Appointment, "status">) => !["cancelled", "no_show"].includes(appointment.status);
export const staffName = (member: TeamMember) => member.profile?.full_name || member.profile?.email || "Staff member";

export function weekDates(date: string) {
  const monday = new Date(date + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
