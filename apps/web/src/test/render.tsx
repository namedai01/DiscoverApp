import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import type { Api } from "@/lib/api/client";
import { ApiProvider } from "@/lib/api/context";
import { AuthContext, type AuthState } from "@/lib/auth/context";

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

type Options = Omit<RenderOptions, "wrapper"> & {
  api?: Partial<Api>;
  auth?: Partial<AuthState>;
};

// Signed out unless a test says otherwise.
function authState(partial: Partial<AuthState>): AuthState {
  return {
    status: "signedOut",
    user: null,
    client: null,
    getToken: async () => null,
    signOut: async () => {},
    notice: null,
    ...partial,
  };
}

// Grows in later tasks (toasts); for now it provides auth and the API.
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { api, auth, ...rest } = options;
  const apiValue = stubbedApi(api ?? {});
  const authValue = authState(auth ?? {});
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={authValue}>
        <ApiProvider api={apiValue}>{children}</ApiProvider>
      </AuthContext.Provider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}
