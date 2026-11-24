import { useOutletContext } from "react-router-dom";
import type { WorkspaceContext } from "./AdminLayout";
import { AdminTable } from "./components/AdminUI";
import { useEffect, useState, type FormEvent } from "react";
import { api, kes } from "../../lib/api";

type Mode = "appointments" | "services";

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
  services: [
    "Services & pricing",
    "Maintain the catalogue customers will book in Kenyan shillings.",
  ],
};

export default function AdminOperations({ mode }: { mode: Mode }) {
  const { openBooking, revision } = useOutletContext<WorkspaceContext>();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);

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

      if (mode === "services") {
        const response = await api<{ services: Service[] }>("/admin/services");
        setServices(response.services);
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
  }, [mode, revision]);

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
    <section className="bk-operations">
      <header className="bk-page-heading">
        <div><h1>{mode === "services" ? "Services" : title}</h1><p>{description}</p></div>
        {mode === "appointments" && <button className="admin-primary" type="button" onClick={() => openBooking()}>+ New appointment</button>}
        {mode === "services" && <a className="admin-primary" href="#add-service">+ Add service</a>}
      </header>
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


          {mode === "services" && (
            <ServiceList rows={services} submit={submitService} save={save} />
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Keep only the rows that match the search text and the chosen status
  const q = search.trim().toLowerCase();
  const visibleRows = rows.filter(
    (a) =>
      (statusFilter === "all" || a.status === statusFilter) &&
      (!q ||
        [a.customer?.full_name, a.service?.service_name, a.staff?.full_name].some(
          (v) => v?.toLowerCase().includes(q)
        ))
  );

  return (
    <div className="overflow-x-auto bg-[#FFFCF8] p-5 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client, service or staff"
          className="w-full max-w-xs border border-[#DDD2C6] bg-white px-3 py-2 text-sm"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#DDD2C6] bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked in</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>

        <p className="text-sm text-[#82766E]">
          {visibleRows.length} of {rows.length} bookings · values shown in KSh
        </p>
      </div>

      <AdminTable className="min-w-full text-left text-sm">
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
          {visibleRows.map((appointment) => (
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
      </AdminTable>

      {rows.length === 0 && (
        <p className="py-8 text-[#82766E]">No appointments have been made yet.</p>
      )}
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
  const [serviceQuery, setServiceQuery] = useState("");
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
        <input className="bk-field" placeholder="Search services…" aria-label="Search services" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} />

        {localError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {localError}
          </p>
        )}

        <div className="mt-5 divide-y divide-[#e7ded3]">
          {rows.filter((service) => service.service_name.toLowerCase().includes(serviceQuery.trim().toLowerCase())).map((service) => (
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

      <form id="add-service"
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
