import { useEffect, useState, type FormEvent } from "react";
import { api, kes } from "../../lib/api";

type Mode = "appointments" | "team" | "services" | "settings";

type Appointment = {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer: { full_name: string } | null;
  staff: { full_name: string } | null;
  service: { service_name: string } | null;
};

type Staff = {
  staff_id: string;
  staff_type: string;
  specialty: string | null;
  is_active: boolean;
  profile: { full_name: string; email: string } | null;
};

type Service = {
  service_id: string;
  service_name: string;
  price: number;
  duration_minutes: number;
};

type SaveAction = (
  path: string,
  body: unknown,
  message: string,
  method?: string
) => Promise<boolean>;

const titles: Record<Mode, [string, string]> = {
  appointments: [
    "Appointments",
    "Review every booking and update its service state.",
  ],
  team: ["Team", "Invite, activate and manage your Bookify team."],
  services: [
    "Services & pricing",
    "Maintain the catalogue customers will book in Kenyan shillings.",
  ],
  settings: [
    "Salon settings",
    "Keep your operational details accurate. Currency is fixed to KES.",
  ],
};

export default function AdminOperations({ mode }: { mode: Mode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [team, setTeam] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      if (mode === "appointments") {
        const response = await api<{ appointments: Appointment[] }>(
          "/admin/appointments"
        );
        setAppointments(response.appointments);
      }

      if (mode === "team") {
        const response = await api<{ staff: Staff[] }>("/admin/team");
        setTeam(response.staff);
      }

      if (mode === "services") {
        const response = await api<{ services: Service[] }>("/admin/services");
        setServices(response.services);
      }

      if (mode === "settings") {
        const response = await api<{ settings: Record<string, string> | null }>(
          "/admin/settings"
        );
        setSettings(response.settings);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load this page"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [mode]);

  const save: SaveAction = async (
    path,
    body,
    message,
    method = "PATCH"
  ) => {
    try {
      setError("");
      setNotice("");

      await api(path, {
        method,
        body: JSON.stringify(body),
      });

      setNotice(message);
      await load();
      return true;
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save changes"
      );
      return false;
    }
  };

  const submitStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const success = await save(
      "/admin/staff",
      {
        fullName: form.get("fullName"),
        email: form.get("email"),
        staffType: form.get("staffType"),
        specialty: form.get("specialty"),
      },
      "Invitation sent.",
      "POST"
    );

    if (success) event.currentTarget.reset();
  };

  const submitService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const success = await save(
      "/admin/services",
      {
        serviceName: form.get("serviceName"),
        price: Number(form.get("price")),
        durationMinutes: Number(form.get("durationMinutes")),
      },
      "Service added.",
      "POST"
    );

    if (success) event.currentTarget.reset();
  };

  const [title, description] = titles[mode];

  return (
    <section className="mx-auto max-w-[1400px]">
      <p className="text-xs font-semibold uppercase tracking-[.24em] text-[#70263E]">
        Bookify · Admin workspace
      </p>

      <h1 className="mt-4 font-serif text-5xl text-[#34251F]">{title}</h1>

      <p className="mt-4 text-[#82766E]">{description}</p>

      {error && (
        <p
          role="alert"
          className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p className="mt-6 border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-[#82766E]">Loading…</p>
      ) : (
        <div className="mt-8">
          {mode === "appointments" && (
            <AppointmentList rows={appointments} save={save} />
          )}

          {mode === "team" && (
            <TeamList rows={team} submit={submitStaff} save={save} />
          )}

          {mode === "services" && (
            <ServiceList rows={services} submit={submitService} save={save} />
          )}

          {mode === "settings" && (
            <SettingsForm data={settings} save={save} />
          )}
        </div>
      )}
    </section>
  );
}

function AppointmentList({
  rows,
  save,
}: {
  rows: Appointment[];
  save: SaveAction;
}) {
  return (
    <div className="overflow-x-auto bg-[#FFFCF8] p-5 sm:p-8">
      <p className="mb-5 text-sm text-[#82766E]">
        {rows.length} bookings · values shown in KSh
      </p>

      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[#e7ded3] text-xs uppercase tracking-wider text-[#82766E]">
          <tr>
            <th className="pb-3">Time & client</th>
            <th className="pb-3">Service</th>
            <th className="pb-3">Staff</th>
            <th className="pb-3">Amount</th>
            <th className="pb-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((appointment) => (
            <tr
              key={appointment.appointment_id}
              className="border-b border-[#eee7df]"
            >
              <td className="py-4">
                <b>{appointment.start_time.slice(0, 5)}</b>
                <br />
                {appointment.customer?.full_name ?? "Client"}
              </td>

              <td>{appointment.service?.service_name ?? "Service"}</td>
              <td>{appointment.staff?.full_name ?? "Staff"}</td>
              <td>{kes(appointment.total_amount)}</td>

              <td>
                <select
                  value={appointment.status}
                  onChange={(event) =>
                    void save(
                      `/admin/appointments/${appointment.appointment_id}`,
                      { status: event.target.value },
                      "Appointment updated."
                    )
                  }
                  className="border border-[#d7cabc] bg-white p-2"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked in</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No-show</option>
                </select>

                <select
                  value={appointment.payment_status}
                  onChange={(event) =>
                    void save(
                      `/admin/appointments/${appointment.appointment_id}`,
                      { paymentStatus: event.target.value },
                      "Payment updated."
                    )
                  }
                  className="mt-2 block border border-[#d7cabc] bg-white p-2"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="py-8 text-[#82766E]">No appointments have been made yet.</p>
      )}
    </div>
  );
}

function TeamList({
  rows,
  submit,
  save,
}: {
  rows: Staff[];
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  save: SaveAction;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="bg-[#FFFCF8] p-5 sm:p-8">
        <h2 className="font-serif text-3xl">Current team</h2>

        <div className="mt-5 divide-y divide-[#e7ded3]">
          {rows.map((staff) => (
            <article
              key={staff.staff_id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div>
                <b>{staff.profile?.full_name ?? "Staff member"}</b>
                <p className="mt-1 text-sm text-[#82766E]">
                  {staff.staff_type} · {staff.specialty || "General services"} ·{" "}
                  {staff.profile?.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void save(
                    `/admin/staff/${staff.staff_id}`,
                    { isActive: !staff.is_active },
                    `Staff member ${
                      staff.is_active ? "deactivated" : "activated"
                    }.`
                  )
                }
                className={
                  staff.is_active
                    ? "border border-[#70263E] px-3 py-2 text-xs font-bold text-[#70263E]"
                    : "bg-[#70263E] px-3 py-2 text-xs font-bold text-white"
                }
              >
                {staff.is_active ? "Deactivate" : "Activate"}
              </button>
            </article>
          ))}
        </div>

        {rows.length === 0 && (
          <p className="mt-5 text-[#82766E]">No staff have been invited.</p>
        )}
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="bg-[#34251F] p-6 text-white"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[#e6b6c6]">
          New team member
        </p>

        <h2 className="mt-3 font-serif text-3xl">Send invitation</h2>

        <div className="mt-5 space-y-3">
          <input
            required
            name="fullName"
            placeholder="Full name"
            className="w-full bg-white p-3 text-[#34251F]"
          />

          <input
            required
            name="email"
            type="email"
            placeholder="Email address"
            className="w-full bg-white p-3 text-[#34251F]"
          />

          <select name="staffType" className="w-full bg-white p-3 text-[#34251F]">
            <option value="barber">Barber</option>
            <option value="stylist">Stylist</option>
          </select>

          <input
            name="specialty"
            placeholder="Specialty (optional)"
            className="w-full bg-white p-3 text-[#34251F]"
          />
        </div>

        <button className="mt-5 w-full bg-[#EEE3D3] p-3 text-sm font-bold text-[#34251F]">
          Send invitation
        </button>
      </form>
    </div>
  );
}

function ServiceList({
  rows,
  submit,
  save,
}: {
  rows: Service[];
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  save: SaveAction;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const [form, setForm] = useState({
    serviceName: "",
    price: "",
    durationMinutes: "",
  });

  const startEdit = (service: Service) => {
    setEditingId(service.service_id);
    setLocalError("");

    setForm({
      serviceName: service.service_name,
      price: String(service.price),
      durationMinutes: String(service.duration_minutes),
    });
  };

  const updateService = async (serviceId: string) => {
    const price = Number(form.price);
    const durationMinutes = Number(form.durationMinutes);

    if (
      !form.serviceName.trim() ||
      form.price.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 5
    ) {
      setLocalError("Enter a valid name, price and duration.");
      return;
    }

    setBusy(true);
    setLocalError("");

    const success = await save(
      `/admin/services/${serviceId}`,
      {
        serviceName: form.serviceName.trim(),
        price,
        durationMinutes,
      },
      "Service updated successfully."
    );

    if (success) setEditingId(null);
    setBusy(false);
  };

  const deleteService = async (service: Service) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${service.service_name}"?`
      )
    ) {
      return;
    }

    setBusy(true);
    setLocalError("");

    await save(
      `/admin/services/${service.service_id}`,
      {},
      "Service deleted successfully.",
      "DELETE"
    );

    setBusy(false);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="bg-[#FFFCF8] p-5 sm:p-8">
        <h2 className="font-serif text-3xl">Published services</h2>

        {localError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {localError}
          </p>
        )}

        <div className="mt-5 divide-y divide-[#e7ded3]">
          {rows.map((service) => (
            <article key={service.service_id} className="py-5">
              {editingId === service.service_id ? (
                <div className="space-y-3">
                  <input
                    value={form.serviceName}
                    onChange={(event) =>
                      setForm({ ...form, serviceName: event.target.value })
                    }
                    className="w-full border border-[#d7cabc] p-3"
                    placeholder="Service name"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(event) =>
                        setForm({ ...form, price: event.target.value })
                      }
                      className="w-full border border-[#d7cabc] p-3"
                      placeholder="Price in KSh"
                    />

                    <input
                      type="number"
                      min="5"
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          durationMinutes: event.target.value,
                        })
                      }
                      className="w-full border border-[#d7cabc] p-3"
                      placeholder="Duration in minutes"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateService(service.service_id)}
                      className="bg-[#70263E] px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Save changes
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                      className="border border-[#B9A796] px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <b>{service.service_name}</b>
                    <p className="mt-1 text-sm text-[#82766E]">
                      {service.duration_minutes} minutes · {kes(service.price)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(service)}
                      className="border border-[#B9A796] px-3 py-2 text-xs"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteService(service)}
                      className="border border-red-300 px-3 py-2 text-xs text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        {rows.length === 0 && (
          <p className="mt-5 text-[#82766E]">No services available.</p>
        )}
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="bg-[#34251F] p-6 text-white"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-[#e6b6c6]">
          Catalogue
        </p>

        <h2 className="mt-3 font-serif text-3xl">Add service</h2>

        <div className="mt-5 space-y-3">
          <input
            required
            name="serviceName"
            placeholder="Service name"
            className="w-full bg-white p-3 text-[#34251F]"
          />

          <input
            required
            min="0"
            name="price"
            type="number"
            placeholder="Price in KSh"
            className="w-full bg-white p-3 text-[#34251F]"
          />

          <input
            required
            min="5"
            name="durationMinutes"
            type="number"
            placeholder="Duration in minutes"
            className="w-full bg-white p-3 text-[#34251F]"
          />
        </div>

        <button className="mt-5 w-full bg-[#EEE3D3] p-3 text-sm font-bold text-[#34251F]">
          Add service
        </button>
      </form>
    </div>
  );
}

function SettingsForm({
  data,
  save,
}: {
  data: Record<string, string> | null;
  save: SaveAction;
}) {
  if (!data) {
    return (
      <p className="bg-white p-6 text-[#82766E]">
        Run <code>Server/database/schema.sql</code> in Supabase to initialize
        Bookify settings.
      </p>
    );
  }

  const submitSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    await save(
      "/admin/settings",
      {
        salonName: form.get("salonName"),
        location: form.get("location"),
        phone: form.get("phone"),
        email: form.get("email"),
        openingTime: form.get("openingTime"),
        closingTime: form.get("closingTime"),
      },
      "Settings saved."
    );
  };

  return (
    <form
      onSubmit={(event) => void submitSettings(event)}
      className="max-w-2xl bg-[#FFFCF8] p-6 sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["salonName", "Salon name", data.salon_name],
          ["location", "Location", data.location],
          ["phone", "Phone", data.phone ?? ""],
          ["email", "Email", data.email ?? ""],
          ["openingTime", "Opening time", data.opening_time],
          ["closingTime", "Closing time", data.closing_time],
        ].map(([name, label, value]) => (
          <label key={name} className="text-sm font-semibold">
            {label}

            <input
              name={name}
              defaultValue={value}
              type={
                name.includes("Time")
                  ? "time"
                  : name === "email"
                    ? "email"
                    : "text"
              }
              className="mt-2 block w-full border border-[#d7cabc] bg-white p-3 font-normal"
            />
          </label>
        ))}
      </div>

      <p className="mt-5 text-sm text-[#82766E]">
        Currency: <b>Kenyan shilling (KES)</b>
      </p>

      <button className="mt-6 bg-[#70263E] px-5 py-3 text-sm font-bold text-white">
        Save settings
      </button>
    </form>
  );
}