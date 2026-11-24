type AdminSectionProps = { title: string; description: string };

/** Honest placeholder for navigation items whose data operations are not supplied. */
export default function AdminSection({ title, description }: AdminSectionProps) {
  return <section className="max-w-3xl py-6"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#70263E]">Admin workspace</p><h1 className="mt-4 font-serif text-5xl text-[#34251F]">{title}</h1><div className="mt-8 border-l-4 border-[#70263E] bg-white p-6 shadow-sm"><p className="text-base leading-7 text-[#665b55]">{description}</p><p className="mt-4 text-sm text-[#82766E]">This page intentionally does not create, alter, or display invented records.</p></div></section>;
}
