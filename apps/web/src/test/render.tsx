import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import type { Api } from "@/lib/api/client";
import { ApiProvider } from "@/lib/api/context";

// A method the test did not stub fails loudly instead of hitting the network.
function stubbedApi(partial: Partial<Api>): Api {
  return new Proxy(partial, {
    get(target, key) {
      if (key in target) return target[key as keyof Api];
      if (typeof key === "symbol" || key === "then") return undefined;
      return () =>
        Promise.reject(new Error(`api.${key} was called but not stubbed`));
    },
  }) as Api;
}

type Options = Omit<RenderOptions, "wrapper"> & { api?: Partial<Api> };

// Grows in later tasks (auth, toasts); for now it provides the API.
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { api, ...rest } = options;
  const apiValue = stubbedApi(api ?? {});
  function Wrapper({ children }: { children: ReactNode }) {
    return <ApiProvider api={apiValue}>{children}</ApiProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}
