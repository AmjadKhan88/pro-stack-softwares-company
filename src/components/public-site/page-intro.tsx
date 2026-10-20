export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-border border-b">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
        {eyebrow ? (
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">{description}</p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}
