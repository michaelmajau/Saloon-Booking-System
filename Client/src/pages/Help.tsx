import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

/**
 * /help — Help centre for customers, staff and admins.
 * Searchable questions, plus a list of the app's error messages and what to do.
 */

type Topic = { q: string; a: string };
type Section = { id: string; title: string; intro: string; topics: Topic[] };

const SECTIONS: Section[] = [
  {
    id: "customers",
    title: "For customers",
    intro: "Booking and managing your salon visits.",
    topics: [
      {
        q: "How do I create an account?",
        a: "Click “Book an appointment” and choose Create Account. Enter your name, email and a password, then open the confirmation email we send you and click the link. After that you can sign in.",
      },
      {
        q: "How do I book an appointment?",
        a: "Sign in and go to your dashboard. The booking section has three steps: 1) choose a service, 2) choose your professional (barber or stylist), 3) pick a date and one of the free times shown, then confirm. Only times that are still free are shown.",
      },
      {
        q: "Why does my booking say “Pending”?",
        a: "New bookings are pending until the salon confirms them. You'll see the status change on your dashboard once it's confirmed.",
      },
      {
        q: "Where can I see my bookings?",
        a: "Your dashboard shows your next appointment at the top and your past visits below it, including the service, professional, time and price.",
      },
      {
        q: "How do I change or cancel a booking?",
        a: "On your dashboard, click Cancel appointment on your upcoming booking. You can cancel a pending or confirmed booking up to 2 hours before it starts. To change a booking, cancel it and book a new time. Closer to the time, please contact the salon.",
      },
      {
        q: "A time I wanted is no longer there.",
        a: "Someone else booked it, or it has already passed today. Choose another time, another day or another professional.",
      },
    ],
  },
  {
    id: "staff",
    title: "For barbers & stylists",
    intro: "Getting access and running your day.",
    topics: [
      {
        q: "How do I get a staff account?",
        a: "Staff accounts are created by the salon administrator, who sends you an invitation email. Open it and follow the link to set your password.",
      },
      {
        q: "I was invited but never set a password.",
        a: "Go to Team portal, click “Forgot password?”, enter the email you were invited with and follow the reset link to choose a password.",
      },
      {
        q: "How do I sign in?",
        a: "Go to Team portal, select your workspace (Barber or Stylist), and enter your email and password. If you pick the wrong workspace you'll be told which one to choose.",
      },
      {
        q: "How do I manage today's appointments?",
        a: "Your dashboard lists today's bookings with the time, client and service. Use “Previous”, “Next” or the date box to see other days. Use “Confirm” on a new booking, “Check in” when the client arrives, “Complete & paid” when you finish, or “No-show” if they don't come.",
      },
      {
        q: "Why can't I check in a booking?",
        a: "Each booking only shows the next step: “Confirm” for a pending booking, then “Check in”, then “Complete & paid”. Cancelled, completed and no-show bookings can't be changed. If a button is missing, refresh the page.",
      },
    ],
  },
  {
    id: "admins",
    title: "For administrators",
    intro: "Managing the salon, team and records.",
    topics: [
      {
        q: "How do I sign in as an admin?",
        a: "Go to Team portal, choose the Admin workspace and sign in with your admin account.",
      },
      {
        q: "How do I confirm or update a booking?",
        a: "Open Appointments. Change a booking's status (for example from Pending to Confirmed) or its payment status using the dropdowns. Every change is recorded in the Audit trail.",
      },
      {
        q: "How do I add a barber or stylist?",
        a: "Open Team, fill in “Send invitation” with their name, email and role (Barber or Stylist), then send. They'll receive an email to set their password. You can deactivate or reactivate team members from the same page.",
      },
      {
        q: "How do I add, edit or remove a service?",
        a: "Open Services & pricing. You can add services with a price in KES and a duration, edit them, or delete them. A service that already has bookings can't be deleted, so its history is kept.",
      },
      {
        q: "How do I change opening hours or salon details?",
        a: "Open Settings. Opening and closing times decide which booking times customers can choose.",
      },
      {
        q: "How do I produce a report?",
        a: "Open Reports, choose the period and press “Update period”. Filter by status, payment or professional, search by name, and click a column heading to sort. Use “Print / Save as PDF” for a printed report with the salon name, logo and date, or “Export CSV” to open it in Excel.",
      },
      {
        q: "How do I see who changed something?",
        a: "Open Audit trail. It lists every change with the person, the time and what changed. Click the arrow on a row to see the values before and after.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & security",
    intro: "Passwords, emails and keeping your account safe.",
    topics: [
      {
        q: "I forgot my password.",
        a: "Click “Forgot password?” on the sign-in page (customers) or the Team portal (staff and admins). Enter your email and follow the link we send to choose a new password.",
      },
      {
        q: "My reset or confirmation link doesn't work.",
        a: "Links work once and expire after a short time. Request a new one and click the newest email only once.",
      },
      {
        q: "I didn't receive an email.",
        a: "Check your spam or junk folder and wait a few minutes. Only a few emails can be sent per hour, so avoid requesting several in a row.",
      },
      {
        q: "How is my password protected?",
        a: "Passwords are never stored in plain text. They are hashed by our authentication provider, and only you can set or change yours.",
      },
      {
        q: "I'm using a shared computer.",
        a: "Always click “Sign out” when you finish.",
      },
    ],
  },
];

/** Messages the app can show, and what to do about each. */
const MESSAGES: [string, string][] = [
  ["Invalid login credentials", "The email or password is wrong. Check for typos, or use “Forgot password?”."],
  ["Email not confirmed", "Open the confirmation email we sent when you signed up and click its link, then sign in again."],
  ["Please select the … workspace", "On the Team portal, pick the workspace named in the message (Admin, Barber or Stylist)."],
  ["This portal is only available to salon team members", "Customer accounts can't use the Team portal. Sign in from the main sign-in page instead."],
  ["Your staff account is inactive. Contact your administrator.", "An admin has deactivated your account. Ask them to reactivate it from the Team page."],
  ["Appointments can only be cancelled at least 2 hours before they start", "It's too close to your appointment to cancel online. Please contact the salon directly."],
  ["A … appointment can't be changed to …", "The booking changed since you opened the page (for example the client cancelled). Refresh the page to see its current status."],
  ["Only pending or confirmed appointments can be cancelled", "This booking has already been checked in, completed or cancelled, so it can't be cancelled."],
  ["This email is already registered", "You already have an account. Sign in, or use “Forgot password?”."],
  ["Unable to check email availability", "The server isn't reachable. Make sure it's running, then try again."],
  ["This time is no longer available. Please choose another slot.", "Someone booked that time just before you. Pick another free time."],
  ["Link not valid", "The reset link expired or was already used. Request a new one."],
  ["Too many requests / Too many reset requests", "Wait a minute (or a few minutes) before trying again."],
  ["Unable to load … / Request failed", "The server couldn't be reached or had a problem. Refresh the page; if it continues, contact the administrator."],
];

export default function Help() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        topics: s.topics.filter((t) => !q || `${t.q} ${t.a}`.toLowerCase().includes(q)),
      })).filter((s) => s.topics.length > 0),
    [q],
  );
  const messages = MESSAGES.filter(([m, fix]) => !q || `${m} ${fix}`.toLowerCase().includes(q));

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-6 py-14 text-[#35231E] md:px-12 lg:px-20">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#70263E]">Help centre</p>
        <h1 className="mt-4 font-serif text-5xl leading-tight md:text-6xl">How can we help?</h1>
        <p className="mt-4 max-w-2xl text-lg text-[#82766E]">
          Answers for customers, barbers & stylists and administrators, plus what each message in the app means.
        </p>

        <label className="relative mt-8 block">
          <span className="sr-only">Search help</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9A8B80]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. “book”, “password”, “report”"
            className="h-14 w-full border border-[#DDD5CC] bg-white pl-12 pr-4 text-base outline-none focus:border-[#70263E]"
          />
        </label>

        {!q && (
          <nav aria-label="Help sections" className="mt-6 flex flex-wrap gap-3 text-sm">
            {[...SECTIONS.map((s) => [s.id, s.title]), ["messages", "Messages & errors"]].map(([id, title]) => (
              <a key={id} href={`#${id}`} className="border border-[#DDD5CC] bg-white px-4 py-2 hover:border-[#70263E] hover:text-[#70263E]">
                {title}
              </a>
            ))}
          </nav>
        )}

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-3xl">{s.title}</h2>
            <p className="mt-1 text-sm text-[#82766E]">{s.intro}</p>
            <div className="mt-5 divide-y divide-[#E7DED3] border-y border-[#E7DED3] bg-white">
              {s.topics.map((t) => (
                <details key={t.q} className="group px-5 py-4" open={Boolean(q)}>
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    <span className="mr-2 inline-block text-[#70263E] transition-transform group-open:rotate-90">›</span>
                    {t.q}
                  </summary>
                  <p className="mt-3 pl-5 leading-7 text-[#5F5047]">{t.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {messages.length > 0 && (
          <section id="messages" className="mt-12 scroll-mt-24">
            <h2 className="font-serif text-3xl">Messages & errors</h2>
            <p className="mt-1 text-sm text-[#82766E]">What a message in the app means and how to fix it.</p>
            <div className="mt-5 overflow-x-auto bg-white">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#35231E] text-left text-xs uppercase tracking-wider text-[#5F5047]">
                    <th scope="col" className="px-5 py-3">Message</th>
                    <th scope="col" className="px-5 py-3">What to do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE7DD]">
                  {messages.map(([m, fix]) => (
                    <tr key={m} className="align-top">
                      <td className="px-5 py-3 font-semibold">{m}</td>
                      <td className="px-5 py-3 text-[#5F5047]">{fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {q && sections.length === 0 && messages.length === 0 && (
          <p className="mt-12 text-[#82766E]">
            Nothing matches “{query.trim()}”. Try a different word, or{" "}
            <button type="button" onClick={() => setQuery("")} className="font-semibold text-[#70263E] underline">
              show all help
            </button>
            .
          </p>
        )}

        <p className="mt-14 border-t border-[#E7DED3] pt-6 text-sm text-[#82766E]">
          Still stuck? Staff and customers can contact the salon; admins can check the{" "}
          <Link to="/admin/audit-logs" className="text-[#70263E] underline">Audit trail</Link> to see recent changes.
        </p>
      </div>
    </main>
  );
}
