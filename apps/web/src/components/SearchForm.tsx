// A plain GET form: works without JavaScript.
export function SearchForm({
  action,
  defaultValue,
  placeholder,
}: {
  action: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <form action={action} method="get" role="search" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent px-4 py-2 font-medium text-neutral-900"
      >
        Search
      </button>
    </form>
  );
}
