import Link from "next/link";

export interface FilterSelect {
  name: string;
  label: string;
  value?: string;
  allLabel: string;
  options: { value: string; label: string }[];
}

const control =
  "border-border bg-surface focus-visible:ring-accent/25 h-10 rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none";

/** A plain GET form: works without JavaScript, and the filters live in the address bar. */
export function SearchBar({
  basePath,
  q,
  placeholder,
  selects = [],
  hasFilters,
}: {
  basePath: string;
  q?: string;
  placeholder: string;
  selects?: FilterSelect[];
  hasFilters: boolean;
}) {
  return (
    <form method="get" action={basePath} role="search" className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="list-search" className="mb-1.5 block text-[13px] font-medium">
          Search
        </label>
        <input
          id="list-search"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          maxLength={100}
          placeholder={placeholder}
          className={`${control} w-full`}
        />
      </div>
      {selects.map((select) => (
        <div key={select.name}>
          <label htmlFor={`list-${select.name}`} className="mb-1.5 block text-[13px] font-medium">
            {select.label}
          </label>
          <select
            id={`list-${select.name}`}
            name={select.name}
            defaultValue={select.value ?? ""}
            className={control}
          >
            <option value="">{select.allLabel}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="submit"
        className="bg-primary text-primary-foreground focus-visible:ring-accent/25 h-10 rounded-lg px-4 text-sm font-medium focus-visible:ring-4 focus-visible:outline-none"
      >
        Search
      </button>
      {hasFilters ? (
        <Link href={basePath} className="text-accent h-10 content-center text-sm font-medium hover:underline">
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}
