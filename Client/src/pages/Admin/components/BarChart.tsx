export function BarChart({ title, items }: { title: string; items: { label: string; value: number; formatted: string }[] }) {
  if (!items.length) return null;
  const maximum = Math.max(1, ...items.map(({ value }) => value));
  return (
    <section className="admin-panel admin-chart" aria-label={title}>
      <h2>{title}</h2>
      <ul>{items.map(({ label, value, formatted }) => (
        <li key={label}><span>{label}</span><div className="admin-chart-track" aria-hidden="true"><div style={{ width: `${value / maximum * 100}%` }} /></div><strong>{formatted}</strong></li>
      ))}</ul>
    </section>
  );
}
