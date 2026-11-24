import { useId } from "react";
import { Check, ChevronRight, CircleHelp, Sparkles, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export function Trend({ values, previous, green = false }: { values: number[]; previous?: number[]; green?: boolean }) {
  const id = useId();
  const full = previous !== undefined;
  const height = full ? 160 : 30;
  const maximum = Math.max(1, ...values, ...(previous ?? []));
  const points = (series: number[]) => (series.length === 1 ? [series[0], series[0]] : series).map((value, index, all) =>
    [index * 600 / (all.length - 1), height - 5 - (height - 12) * value / maximum]);
  const path = (series: number[]) => points(series).map(([x, y], index, all) => {
    if (!index) return `M ${x} ${y}`;
    const [px, py] = all[index - 1];
    const mid = (px + x) / 2;
    return `C ${mid} ${py} ${mid} ${y} ${x} ${y}`;
  }).join(" ");
  return <svg className={full ? "bk-revenue-chart" : "bk-sparkline"} viewBox={`0 0 600 ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#70263e" stopOpacity=".18" /><stop offset="100%" stopColor="#70263e" stopOpacity="0" /></linearGradient></defs>
    {full && [8, 45, 82, 119, 156].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e6dfda" />)}
    {full && !!values.length && <path d={path(values) + ` L 600 ${height} L 0 ${height} Z`} fill={`url(#${id})`} />}
    {previous && <path d={path(previous)} stroke="#d8a6b7" strokeWidth="2" strokeDasharray="5 6" fill="none" vectorEffect="non-scaling-stroke" />}
    <path d={path(values)} stroke={green ? "#29765b" : "#70263e"} strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function MetricCard({ label, value, series, detail, icon: Icon, green }: {
  label: string; value: string; series: number[]; detail: string; icon: LucideIcon; green?: boolean;
}) {
  return <article className="bk-card bk-metric">
    <header><span className="bk-tile"><Icon size={17} /></span><span className="bk-metric-help" title={detail} aria-label={detail}><CircleHelp size={16} /></span></header>
    <p>{label}</p><strong>{value}</strong><Trend values={series} green={green} />
  </article>;
}

type Step = { label: string; done: boolean; href: string };
export function LaunchChecklist({ studio, steps, onDismiss }: { studio: string; steps: Step[]; onDismiss: () => void }) {
  const complete = steps.filter((step) => step.done).length;
  const percent = Math.round(complete / steps.length * 100);
  return <section className="bk-checklist">
    <button className="bk-close" type="button" aria-label="Dismiss launch checklist" onClick={onDismiss}><X size={17} /></button>
    <div className="bk-checklist-intro"><span className="bk-tile"><Sparkles size={21} /></span><div><p className="bk-eyebrow">Your launch checklist</p><h2>Make {studio} ready for bookings.</h2><p>Complete a few final steps before sharing your page with customers.</p></div></div>
    <div className="bk-progress"><div><span>{complete} of {steps.length} complete</span><strong>{percent}%</strong></div><progress value={complete} max={steps.length} aria-label="Launch checklist progress" /></div>
    <ul>{steps.map(({ label, done, href }) => <li key={label}><Link to={href} className={done ? "bk-step-complete" : ""}><i>{done ? <Check size={13} /> : <ChevronRight size={13} />}</i>{label}</Link></li>)}</ul>
  </section>;
}
