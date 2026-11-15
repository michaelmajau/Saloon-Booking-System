import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api, kes } from "../lib/api";

type Service = {
  service_id: string;
  service_name: string;
  price: number;
  duration_minutes: number;
};

type Barber = {
  staff_id: string;
  full_name: string;
  staff_type: string;
  specialty: string | null;
};

type Appointment = {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  staff: {
    full_name: string;
  } | null;
  service: {
    service_name: string;
    duration_minutes: number;
  } | null;
};

type CustomerDashboard = {
  appointments: Appointment[];
  upcoming: Appointment | null;
  metrics: {
    visitsThisYear: number;
    favouriteService: {
      name: string;
      count: number;
    } | null;
  };
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [fullName, setFullName] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [dashboard, setDashboard] = useState<CustomerDashboard | null>(null);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [bookingDate, setBookingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);

  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  const [pageError, setPageError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  const navigate = useNavigate();

  const serifStyle = {
    fontFamily: '"DM Serif Display", serif',
    fontWeight: 400,
    fontStyle: "normal",
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("en-KE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));

  const handleSignout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }

    navigate("/sign-in", { replace: true });
  };

  const loadDashboard = async () => {
    try {
      const response = await api<CustomerDashboard>("/customer/dashboard");
      setDashboard(response);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load your appointments."
      );
    }
  };

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (!error && data.user?.email_confirmed_at) {
        setAuthenticated(true);
        setFullName(data.user.user_metadata?.full_name || "Customer");
      }

      setLoading(false);
    };

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadCatalogue = async () => {
      try {
        const [servicesResponse, barbersResponse] = await Promise.all([
          api<{ services: Service[] }>("/services"),
          api<{ barbers: Barber[] }>("/barbers"),
        ]);

        setServices(servicesResponse.services);
        setBarbers(barbersResponse.barbers);
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Unable to load salon services and barbers."
        );
      } finally {
        setCatalogueLoading(false);
      }
    };

    void loadCatalogue();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void loadDashboard();
  }, [authenticated]);

  useEffect(() => {
    if (!selectedService || !selectedBarber || !bookingDate) {
      setAvailableSlots([]);
      setSelectedTime("");
      return;
    }

    const loadAvailableSlots = async () => {
      setSlotsLoading(true);
      setBookingError("");
      setSelectedTime("");

      try {
        const response = await api<{ slots: string[] }>(
          `/customer/availability?staffId=${encodeURIComponent(
            selectedBarber.staff_id
          )}&serviceId=${encodeURIComponent(
            selectedService.service_id
          )}&date=${encodeURIComponent(bookingDate)}`
        );

        setAvailableSlots(response.slots);
      } catch (error) {
        setBookingError(
          error instanceof Error
            ? error.message
            : "Unable to load available times."
        );
      } finally {
        setSlotsLoading(false);
      }
    };

    void loadAvailableSlots();
  }, [selectedService, selectedBarber, bookingDate]);

  const handleBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedService || !selectedBarber || !bookingDate || !selectedTime) {
      setBookingError(
        "Please select a service, barber, date, and available time."
      );
      return;
    }

    setBookingLoading(true);
    setBookingError("");
    setBookingSuccess("");

    try {
      await api("/customer/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceId: selectedService.service_id,
          staffId: selectedBarber.staff_id,
          appointmentDate: bookingDate,
          startTime: selectedTime,
        }),
      });

      setBookingSuccess("Your appointment has been confirmed.");
      setSelectedTime("");
      setAvailableSlots([]);

      await loadDashboard();
    } catch (error) {
      setBookingError(
        error instanceof Error
          ? error.message
          : "Unable to create your appointment."
      );
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F1]">
        <p className="text-[#82766E]">Loading your account…</p>
      </main>
    );
  }

  if (!authenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-5 py-10 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        {/* Account banner */}
        <section className="relative overflow-hidden bg-[#35231E] px-6 py-8 md:px-10 md:py-10">
          <div className="pointer-events-none absolute -right-24 -top-40 h-[420px] w-[420px] rounded-full border border-[#795044]/50" />
          <div className="pointer-events-none absolute -right-10 -top-28 h-[330px] w-[330px] rounded-full border border-[#795044]/40" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#F2E9DB] text-sm font-bold text-[#35231E]">
                  {fullName.charAt(0).toUpperCase()}
                </div>

                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#E6D6B8]">
                  My account
                </p>
              </div>

              <h1
                style={serifStyle}
                className="mt-6 max-w-3xl text-4xl leading-tight text-[#FFFDF8] sm:text-5xl lg:text-4xl"
              >
                Good morning, {fullName}.
              </h1>

              <p className="mt-4 text-base text-[#E6D6B8]">
                Your appointments and visit history, all in one place.
              </p>
            </div>

            <div className="flex shrink-0 gap-3 lg:pb-1">
              <a
                href="#book-appointment"
                className="bg-[#FFFDF8] px-5 py-3 text-sm font-medium text-[#35231E] transition hover:bg-[#EFE5D7]"
              >
                Book a chair
              </a>

              <button
                type="button"
                onClick={handleSignout}
                className="border border-[#806157] px-5 py-3 text-sm font-semibold text-[#FFFDF8] transition hover:border-[#FFFDF8] hover:bg-[#4A2E27]"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        {pageError && (
          <p className="mt-5 border border-red-200 bg-red-50 p-4 text-red-700">
            {pageError}
          </p>
        )}

        {/* Summary cards */}
        <section className="mt-5 grid gap-5 md:grid-cols-3">
          <article className="border-t-4 border-[#B89B77] bg-white p-8">
            <p className="text-sm text-[#82766E]">Next appointment</p>

            <h2 style={serifStyle} className="mt-6 text-3xl text-[#35231E]">
              {dashboard?.upcoming
                ? `${formatDate(dashboard.upcoming.appointment_date)} · ${dashboard.upcoming.start_time.slice(0, 5)}`
                : "No booking yet"}
            </h2>

            <p className="mt-5 text-sm text-[#82766E]">
              {dashboard?.upcoming
                ? `${dashboard.upcoming.service?.service_name ?? "Service"} with ${
                    dashboard.upcoming.staff?.full_name ?? "Salon team"
                  }`
                : "Your next appointment will appear here."}
            </p>
          </article>

          <article className="border-t-4 border-[#35231E] bg-[#EEE5D7] p-8">
            <p className="text-sm text-[#82766E]">Visits this year</p>

            <h2 style={serifStyle} className="mt-6 text-4xl text-[#35231E]">
              {dashboard?.metrics.visitsThisYear ?? 0}
            </h2>

            <p className="mt-5 text-sm text-[#82766E]">
              Thank you for being a regular.
            </p>
          </article>

          <article className="border-t-4 border-[#70263E] bg-white p-8">
            <p className="text-sm text-[#82766E]">Favourite service</p>

            <h2 style={serifStyle} className="mt-6 text-3xl text-[#35231E]">
              {dashboard?.metrics.favouriteService?.name ?? "Not yet chosen"}
            </h2>

            <p className="mt-5 text-sm text-[#82766E]">
              {dashboard?.metrics.favouriteService
                ? `Booked ${dashboard.metrics.favouriteService.count} times`
                : "Book a service to discover your favourite."}
            </p>
          </article>
        </section>

        {/* Next visit */}
        <section className="mt-14 border-l-4 border-[#B89B77] bg-white p-8 md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#70263E]">
            Upcoming
          </p>

          {dashboard?.upcoming ? (
            <div className="mt-5 flex flex-col gap-6 border-t border-[#DDD5CC] pt-7 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 style={serifStyle} className="text-4xl text-[#35231E]">
                  {dashboard.upcoming.service?.service_name ?? "Appointment"}
                </h2>

                <p className="mt-3 text-[#82766E]">
                  {formatDate(dashboard.upcoming.appointment_date)} ·{" "}
                  {dashboard.upcoming.start_time.slice(0, 5)} ·{" "}
                  {dashboard.upcoming.staff?.full_name ?? "Salon team"} ·{" "}
                  {dashboard.upcoming.service?.duration_minutes ?? "—"} min
                </p>
              </div>

              <span className="w-fit rounded-full bg-[#EEE5D7] px-4 py-2 text-sm font-semibold text-[#70263E]">
                {dashboard.upcoming.status.replace("_", " ")}
              </span>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-6 border-t border-[#DDD5CC] pt-7 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 style={serifStyle} className="text-4xl text-[#35231E]">
                  Your next visit
                </h2>

                <p className="mt-3 text-[#82766E]">
                  You do not have an upcoming appointment.
                </p>
              </div>

              <a
                href="#book-appointment"
                className="w-fit bg-[#70263E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5C1E32]"
              >
                Book an appointment
              </a>
            </div>
          )}
        </section>

        {/* Guided three-step booking experience */}
        <section id="book-appointment" className="mt-16 scroll-mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#70263E]">New appointment</p>
          <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 style={serifStyle} className="text-5xl leading-tight text-[#35231E] md:text-6xl">Your next visit, beautifully simple.</h2>
            <p className="max-w-sm text-lg text-[#82766E]">Choose your service, your professional, and a time that suits you.</p>
          </div>

          <div className="mt-9 grid border border-[#DDD5CC] bg-[#FCFAF6] md:grid-cols-3" aria-label="Booking progress">
            {([
              [1, "Choose a service"],
              [2, "Choose your professional"],
              [3, "Date, time & details"],
            ] as const).map(([step, label]) => (
              <button
                key={step}
                type="button"
                disabled={(step === 2 && !selectedService) || (step === 3 && (!selectedService || !selectedBarber))}
                onClick={() => setBookingStep(step)}
                aria-current={bookingStep === step ? "step" : undefined}
                className={`flex items-center gap-4 border-b-4 px-6 py-5 text-left transition md:border-r md:last:border-r-0 ${bookingStep === step ? "border-b-[#70263E] bg-white text-[#35231E]" : "border-b-transparent text-[#82766E] hover:bg-white/70"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm ${bookingStep === step ? "border-[#70263E] bg-[#70263E] text-white" : "border-[#D7CABC]"}`}>0{step}</span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleBooking} className="mt-6 grid gap-7 border border-[#DDD5CC] bg-[#FCFAF6] p-5 md:p-9 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-10">
            <div className="flex min-h-[430px] flex-col">
              {bookingStep === 1 && (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#35231E]">Select a service</p>
                  <p className="mt-3 text-[#82766E]">Choose the treatment that feels right for this visit.</p>
                  {catalogueLoading && <p className="mt-8 text-[#82766E]">Loading services…</p>}
                  {!catalogueLoading && services.length === 0 && <p className="mt-8 text-[#82766E]">No services are available right now.</p>}
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {services.map((service) => {
                      const active = selectedService?.service_id === service.service_id;
                      return (
                        <button key={service.service_id} type="button" aria-pressed={active}
                          onClick={() => {
                            if (selectedService?.service_id !== service.service_id) {
                              setSelectedBarber(null);
                              setSelectedTime("");
                            }
                            setSelectedService(service);
                            setBookingError("");
                            setBookingSuccess("");
                          }}
                          className={`min-h-[165px] border p-6 text-left transition ${active ? "border-l-[6px] border-[#70263E] bg-[#F3E4E5]" : "border-[#DDD5CC] bg-white hover:border-[#70263E]"}`}>
                          <h3 className="text-xl font-semibold text-[#35231E]">{service.service_name}</h3>
                          <p className="mt-6 text-sm text-[#82766E]">{service.duration_minutes} min · {kes(service.price)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {bookingStep === 2 && (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#35231E]">Choose your professional</p>
                  <p className="mt-3 text-[#82766E]">Select the barber or stylist you'd like to see.</p>
                  {barbers.length === 0 && <p className="mt-8 text-[#82766E]">No professionals are available right now.</p>}
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {barbers.map((barber) => {
                      const active = selectedBarber?.staff_id === barber.staff_id;
                      return (
                        <button key={barber.staff_id} type="button" aria-pressed={active}
                          onClick={() => { setSelectedBarber(barber); setSelectedTime(""); setBookingError(""); }}
                          className={`flex items-center gap-4 border p-6 text-left transition ${active ? "border-l-[6px] border-[#70263E] bg-[#F3E4E5]" : "border-[#DDD5CC] bg-white hover:border-[#70263E]"}`}>
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#35231E] text-sm font-semibold text-white">{barber.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                          <span><span className="block font-semibold text-[#35231E]">{barber.full_name}</span><span className="mt-1 block text-sm capitalize text-[#82766E]">{barber.staff_type}{barber.specialty ? ` · ${barber.specialty}` : ""}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {bookingStep === 3 && (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#35231E]">Date, time & details</p>
                  <p className="mt-3 text-[#82766E]">Choose an available time for your appointment.</p>
                  <label htmlFor="booking-date" className="mt-8 block text-sm font-semibold text-[#35231E]">Appointment date</label>
                  <input id="booking-date" type="date" value={bookingDate}
                    min={new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}
                    onChange={(event) => { setBookingDate(event.target.value); setSelectedTime(""); }}
                    className="mt-3 w-full max-w-sm border border-[#DDD5CC] bg-white px-4 py-3 text-[#35231E] outline-none focus:border-[#70263E]" />
                  <p className="mt-8 text-sm font-semibold text-[#35231E]">Available times</p>
                  {slotsLoading && <p className="mt-4 text-[#82766E]">Checking available times…</p>}
                  {!slotsLoading && availableSlots.length === 0 && <p className="mt-4 text-[#82766E]">No available times for this date. Please choose another day.</p>}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {!slotsLoading && availableSlots.map((slot) => (
                      <button key={slot} type="button" onClick={() => setSelectedTime(slot)} aria-pressed={selectedTime === slot}
                        className={`border px-4 py-3 text-sm font-semibold transition ${selectedTime === slot ? "border-[#70263E] bg-[#F3E4E5] text-[#70263E]" : "border-[#DDD5CC] bg-white text-[#35231E] hover:border-[#70263E]"}`}>{slot.slice(0, 5)}</button>
                    ))}
                  </div>
                </div>
              )}

              {bookingError && <p role="alert" className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{bookingError}</p>}
              {bookingSuccess && <p role="status" className="mt-6 border border-green-200 bg-green-50 p-4 text-sm text-green-700">{bookingSuccess}</p>}

              <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#DDD5CC] pt-7">
                {bookingStep > 1 ? (
                  <button type="button" onClick={() => setBookingStep((bookingStep - 1) as 1 | 2)} className="border border-[#D7CABC] px-6 py-3 font-semibold text-[#35231E] hover:bg-white">← Back</button>
                ) : <span />}
                {bookingStep < 3 ? (
                  <button type="button" disabled={bookingStep === 1 ? !selectedService : !selectedBarber}
                    onClick={() => setBookingStep((bookingStep + 1) as 2 | 3)}
                    className="bg-[#70263E] px-8 py-4 font-semibold text-white transition hover:bg-[#5C1E32] disabled:cursor-not-allowed disabled:opacity-40">Continue →</button>
                ) : (
                  <button type="submit" disabled={bookingLoading || !selectedService || !selectedBarber || !selectedTime}
                    className="bg-[#70263E] px-8 py-4 font-semibold text-white transition hover:bg-[#5C1E32] disabled:cursor-not-allowed disabled:opacity-40">{bookingLoading ? "Confirming…" : "Confirm appointment →"}</button>
                )}
              </div>
            </div>

            <aside className="h-fit border-t-[6px] border-[#70263E] bg-white p-6 shadow-[0_16px_50px_rgba(53,35,30,0.07)] md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#70263E]">Your appointment</p>
              <h3 style={serifStyle} className="mt-8 text-4xl leading-tight text-[#35231E]">{selectedService?.service_name ?? "Your next visit"}</h3>
              <p className="mt-4 text-sm leading-6 text-[#82766E]">{selectedService ? "A little time set aside just for you." : "Select a service to begin your booking."}</p>
              <div className="mt-8 flex items-center gap-4 bg-[#F3ECE3] p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#35231E] text-xs font-bold text-white">{selectedBarber ? selectedBarber.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("") : "?"}</span>
                <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider text-[#82766E]">With</p><p className="truncate text-sm font-semibold text-[#35231E]">{selectedBarber?.full_name ?? "Choose a professional"}</p></div>
                {selectedBarber && <button type="button" onClick={() => setBookingStep(2)} className="text-xs font-semibold text-[#70263E] hover:underline">Change</button>}
              </div>
              <div className="mt-8 space-y-5 border-t border-[#DDD5CC] pt-6 text-sm">
                <div className="flex justify-between gap-4"><span className="text-[#82766E]">Date</span><span className="text-right text-[#35231E]">{selectedBarber ? formatDate(bookingDate) : "—"}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#82766E]">Time</span><span className="text-[#35231E]">{selectedTime ? selectedTime.slice(0, 5) : "—"}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#82766E]">Duration</span><span className="text-[#35231E]">{selectedService ? `${selectedService.duration_minutes} min` : "—"}</span></div>
                <div className="flex justify-between gap-4 border-t border-[#DDD5CC] pt-5 font-semibold"><span className="text-[#82766E]">Total</span><span className="text-[#35231E]">{selectedService ? kes(selectedService.price) : "—"}</span></div>
              </div>
              <p className="mt-8 text-center text-xs text-[#82766E]">No payment is taken until your visit.</p>
            </aside>
          </form>
        </section>

        {/* Previous bookings */}
        <section className="mt-16 border-t-4 border-[#70263E] bg-white p-8 md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#70263E]">
            Visit history
          </p>

          <h2 style={serifStyle} className="mt-4 text-4xl text-[#35231E]">
            Previous bookings
          </h2>

          <div className="mt-8 divide-y divide-[#DDD5CC] border-t border-[#DDD5CC]">
            {dashboard?.appointments
              .filter((appointment) => appointment.status === "completed")
              .map((appointment) => (
                <article
                  key={appointment.appointment_id}
                  className="grid gap-3 py-5 md:grid-cols-[150px_1fr_1fr_auto]"
                >
                  <p className="text-sm text-[#82766E]">
                    {formatDate(appointment.appointment_date)}
                  </p>

                  <p className="font-semibold text-[#35231E]">
                    {appointment.service?.service_name ?? "Service"}
                  </p>

                  <p className="text-[#82766E]">
                    {appointment.staff?.full_name ?? "Salon team"}
                  </p>

                  <p className="font-semibold text-[#35231E]">
                    {kes(appointment.total_amount)}
                  </p>
                </article>
              ))}

            {!dashboard?.appointments.some(
              (appointment) => appointment.status === "completed"
            ) && (
              <p className="py-8 text-[#82766E]">
                Your completed appointments will appear here.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default Dashboard;