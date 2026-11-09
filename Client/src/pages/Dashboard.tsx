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

        {/* Continuous booking form */}
        <section id="book-appointment" className="mt-16 scroll-mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#70263E]">
            New appointment
          </p>

          <h2
            style={serifStyle}
            className="mt-5 text-5xl leading-none text-[#35231E] md:text-6xl"
          >
            Make time for a fresh start.
          </h2>

          <p className="mt-5 max-w-xl text-lg text-[#82766E]">
            Choose your service, preferred barber, day, and available time.
          </p>

          <form
            onSubmit={handleBooking}
            className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]"
          >
            <div className="border border-[#DDD5CC] bg-[#FCFAF6] p-6 md:p-10">
              {/* Step 1 */}
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#70263E]">
                01 / Choose your service
              </p>

              {catalogueLoading && (
                <p className="mt-8 text-[#82766E]">Loading services…</p>
              )}

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {services.map((service) => {
                  const isSelected =
                    selectedService?.service_id === service.service_id;

                  return (
                    <button
                      key={service.service_id}
                      type="button"
                      onClick={() => {
                        setSelectedService(service);
                        setSelectedTime("");
                      }}
                      className={`border p-6 text-left transition ${
                        isSelected
                          ? "border-l-8 border-[#70263E] bg-[#F3E2E4]"
                          : "border-[#DDD5CC] bg-white hover:border-[#70263E]"
                      }`}
                    >
                      <p className="text-sm text-[#82766E]">Service</p>

                      <h3 className="mt-3 text-2xl font-semibold text-[#35231E]">
                        {service.service_name}
                      </h3>

                      <p className="mt-3 text-sm text-[#82766E]">
                        {service.duration_minutes} min · {kes(service.price)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Step 2 */}
              <div className="mt-12 border-t border-[#DDD5CC] pt-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#70263E]">
                  02 / Choose your barber
                </p>

                {!selectedService && (
                  <p className="mt-4 text-[#82766E]">
                    Choose a service first.
                  </p>
                )}

                {selectedService && (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {barbers.map((barber) => {
                      const isSelected =
                        selectedBarber?.staff_id === barber.staff_id;

                      return (
                        <button
                          key={barber.staff_id}
                          type="button"
                          onClick={() => {
                            setSelectedBarber(barber);
                            setSelectedTime("");
                          }}
                          className={`border p-5 text-left transition ${
                            isSelected
                              ? "border-l-8 border-[#70263E] bg-[#F3E2E4]"
                              : "border-[#DDD5CC] bg-white hover:border-[#70263E]"
                          }`}
                        >
                          <p className="font-semibold text-[#35231E]">
                            {barber.full_name}
                          </p>

                          <p className="mt-2 text-sm capitalize text-[#82766E]">
                            {barber.staff_type}
                            {barber.specialty ? ` · ${barber.specialty}` : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div className="mt-12 border-t border-[#DDD5CC] pt-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#70263E]">
                  03 / Choose your date and time
                </p>

                {!selectedBarber && selectedService && (
                  <p className="mt-4 text-[#82766E]">
                    Choose your preferred barber first.
                  </p>
                )}

                {selectedBarber && (
                  <>
                    <label className="mt-6 block text-sm font-semibold text-[#35231E]">
                      Appointment date
                    </label>

                    <input
                      type="date"
                      value={bookingDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => setBookingDate(event.target.value)}
                      className="mt-3 border border-[#DDD5CC] bg-white px-4 py-3 text-[#35231E] outline-none focus:border-[#70263E]"
                    />

                    <p className="mt-8 text-sm font-semibold text-[#35231E]">
                      Available times
                    </p>

                    {slotsLoading && (
                      <p className="mt-4 text-[#82766E]">
                        Checking available times…
                      </p>
                    )}

                    {!slotsLoading && availableSlots.length === 0 && (
                      <p className="mt-4 text-[#82766E]">
                        No times are available on this date. Please choose
                        another day.
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`border px-4 py-3 text-sm font-semibold transition ${
                            selectedTime === slot
                              ? "border-[#70263E] bg-[#F3E2E4] text-[#70263E]"
                              : "border-[#DDD5CC] bg-white text-[#35231E] hover:border-[#70263E]"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Live summary */}
            <aside className="h-fit border-t-4 border-[#70263E] bg-white p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#70263E]">
                Your appointment
              </p>

              {selectedService ? (
                <>
                  <h3 style={serifStyle} className="mt-8 text-4xl text-[#35231E]">
                    {selectedService.service_name}
                  </h3>

                  <p className="mt-4 text-[#82766E]">
                    {selectedBarber
                      ? `with ${selectedBarber.full_name}`
                      : "Choose your preferred barber"}
                  </p>

                  <div className="mt-8 space-y-4 border-t border-[#DDD5CC] pt-6 text-sm">
                    <div className="flex justify-between gap-5">
                      <span className="text-[#82766E]">Date</span>
                      <span className="text-right text-[#35231E]">
                        {selectedBarber ? formatDate(bookingDate) : "—"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-5">
                      <span className="text-[#82766E]">Time</span>
                      <span className="text-[#35231E]">
                        {selectedTime || "—"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-5">
                      <span className="text-[#82766E]">Duration</span>
                      <span className="text-[#35231E]">
                        {selectedService.duration_minutes} min
                      </span>
                    </div>

                    <div className="flex justify-between gap-5 border-t border-[#DDD5CC] pt-4 font-semibold">
                      <span className="text-[#82766E]">Total</span>
                      <span className="text-[#35231E]">
                        {kes(selectedService.price)}
                      </span>
                    </div>
                  </div>

                  {bookingError && (
                    <p className="mt-6 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {bookingError}
                    </p>
                  )}

                  {bookingSuccess && (
                    <p className="mt-6 border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      {bookingSuccess}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      bookingLoading ||
                      !selectedService ||
                      !selectedBarber ||
                      !selectedTime
                    }
                    className="mt-8 w-full bg-[#70263E] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#5C1E32] disabled:cursor-not-allowed disabled:bg-[#B9A796]"
                  >
                    {bookingLoading
                      ? "Confirming appointment…"
                      : "Confirm appointment"}
                  </button>
                </>
              ) : (
                <p className="mt-8 text-[#82766E]">
                  Select a service to begin your booking.
                </p>
              )}
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