"use client";

import { useState } from "react";
import { ACCENTS, applyAccent, loadAccent, type AccentName } from "@/lib/accent";

const NAMES = Object.keys(ACCENTS) as AccentName[];

export function AccentPicker() {
  // Only rendered behind RequireAuth, i.e. after mount, so reading the
  // stored accent here cannot cause a hydration mismatch.
  const [current, setCurrent] = useState<AccentName>(loadAccent);

  return (
    <fieldset className="space-y-2">
      <legend className="text-lg font-semibold">Accent color</legend>
      <div className="flex flex-wrap gap-3">
        {NAMES.map((name) => (
          <label key={name} className="cursor-pointer">
            <input
              type="radio"
              name="accent"
              value={name}
              checked={current === name}
              onChange={() => {
                applyAccent(name);
                setCurrent(name);
              }}
              className="peer sr-only"
            />
            <span
              className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 peer-checked:border-neutral-900 peer-checked:ring-2 peer-checked:ring-neutral-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: ACCENTS[name] }}
              />
              {name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
