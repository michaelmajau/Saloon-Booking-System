import { Link } from "react-router-dom";

const appointments = [
  ["09:00", "Amara Jones", "Silk finish", "Maya", "Confirmed"],
  ["10:30", "Ben Taylor", "Signature haircut", "Leo", "Confirmed"],
  ["12:00", "Priya Shah", "Colour refresh", "Sofia", "Arrived"],
  ["14:30", "Oliver James", "Beard sculpt", "Leo", "Confirmed"],
];

const metrics = [
  ["Today’s appointments", "12", "2 more than yesterday", "light"],
  ["Weekly revenue", "£615", "On track for this week", "sand"],
  ["Next appointment", "09:00", "Amara Jones", "light"],
  ["Client satisfaction", "4.9", "Excellent", "dark"],
];

export default function AdminDashboard() {
  return (
    <section className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#70263E]">Admin dashboard · today</p>
          <h1 className="mt-5 font-serif text-5xl leading-none text-[#34251F] sm:text-6xl">Studio overview</h1>
          <p className="mt-5 text-base text-[#82766E]">Bookings, revenue and team performance at a glance.</p>
        </div>
        <Link to="/admin/appointments" className="bg-[#70263E] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#5C1E32]">+ New appointment</Link>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, note, kind]) => (
          <article key={label} className={`min-h-52 border-t-4 p-8 ${kind === "dark" ? "border-[#34251F] bg-[#34251F] text-white" : kind === "sand" ? "border-[#E8DDCD] bg-[#E8DDCD] text-[#34251F]" : "border-[#70263E] bg-[#FFFCF8] text-[#34251F]"}`}>
            <p className={kind === "dark" ? "text-sm text-[#E8D8C9]" : "text-sm text-[#82766E]"}>{label}</p>
            <p className="mt-9 font-serif text-5xl">{value}</p>
            <p className={`mt-5 text-sm ${kind === "dark" ? "text-[#E8D8C9]" : "text-[#638062]"}`}>{note}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <article className="bg-[#FFFCF8] p-6 sm:p-10">
          <div className="flex items-end justify-between gap-4 border-b border-[#E7DED3] pb-5">
            <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#70263E]">Today</p><h2 className="mt-3 font-serif text-3xl text-[#34251F]">Appointments</h2></div>
            <Link className="text-sm font-medium text-[#70263E] hover:underline" to="/admin/appointments">View calendar →</Link>
          </div>
          <div className="divide-y divide-[#E7DED3]">
            {appointments.map(([time, client, service, stylist, status]) => (
              <div key={time} className="grid grid-cols-[72px_minmax(150px,1fr)_minmax(100px,0.7fr)] gap-4 py-6 text-sm">
                <p className="text-[#82766E]">{time}</p>
                <div><p className="font-semibold text-[#34251F]">{client}</p><p className="mt-1 text-[#82766E]">{service}</p></div>
                <div><p className="font-semibold text-[#34251F]">{stylist}</p><p className="mt-1 text-[#82766E]">{status}</p></div>
              </div>
            ))}
          </div>
        </article>
        <aside className="space-y-5">
          <article className="border-t-4 border-[#70263E] bg-[#FFFCF8] p-8"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#70263E]">Up next</p><h2 className="mt-6 font-serif text-4xl text-[#34251F]">Amara Jones</h2><p className="mt-3 text-sm text-[#82766E]">Silk finish · 45 min</p><Link to="/admin/appointments" className="mt-7 block border border-[#B9A796] px-5 py-4 text-center text-sm font-semibold text-[#34251F] hover:bg-[#F4ECE2]">View appointment</Link></article>
          <article className="bg-[#34251F] p-8 text-white"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E6B6C6]">A moment between visits</p><h2 className="mt-7 font-serif text-4xl">Your next opening</h2><p className="mt-6 font-serif text-3xl">13:00–14:30</p><p className="mt-2 text-sm text-[#E8D8C9]">Perfect for a break or a walk-in.</p></article>
        </aside>
      </div>
      <p className="mt-5 text-xs text-[#82766E]">Dashboard figures are a design preview only; live appointment and revenue queries were not supplied in the backend.</p>
    </section>
  );
}
