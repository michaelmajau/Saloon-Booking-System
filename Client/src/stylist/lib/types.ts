export type Status = "confirmed" | "arrived" | "in-progress" | "completed" | "cancelled" | "no-show";

export interface Service {
  id: string;
  name: string;
  duration: number; // minutes
  price: number; // pounds
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  since: string; // YYYY-MM-DD
}

export interface Appointment {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  clientId: string;
  serviceId: string;
  status: Status;
  notes: string;
  tip: number;
}

export interface Block {
  id: string;
  date: string;
  start: string;
  end: string;
  reason: string;
}

export interface DayHours {
  start: string;
  end: string;
}

/** Keyed by weekday as a string: "0" = Sunday … "6" = Saturday. null = day off. */
export type WeekHours = Record<string, DayHours | null>;

export interface Stylist {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
}

export interface Prefs {
  newBooking: boolean;
  cancellations: boolean;
  reminders: boolean;
  dailySummary: boolean;
}

export interface Database {
  version: number;
  stylist: Stylist;
  hours: WeekHours;
  prefs: Prefs;
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  blocks: Block[];
}

export const STATUS_LABELS: Record<Status, string> = {
  confirmed: "Confirmed",
  arrived: "Arrived",
  "in-progress": "In chair",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
};

/** Statuses that no longer take up time in the diary. */
export const INACTIVE: Status[] = ["cancelled", "no-show"];
