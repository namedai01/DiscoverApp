import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { RequireAuth } from "./RequireAuth";

vi.mock("next/navigation", () => ({ usePathname: () => "/u/u2" }));

describe("RequireAuth", () => {
  it("asks a signed-out visitor to sign in and remembers where they were", () => {
    renderWithProviders(
      <RequireAuth reason="see profiles">
        <p>secret</p>
      </RequireAuth>,
      { auth: { status: "signedOut" } },
    );
    expect(screen.getByText("Sign in to see profiles")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin?next=%2Fu%2Fu2",
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("shows the session-expired notice when there is one", () => {
    renderWithProviders(
      <RequireAuth reason="see profiles">
        <p>secret</p>
      </RequireAuth>,
      {
        auth: {
          status: "signedOut",
          notice: "Your session expired. Sign in again.",
        },
      },
    );
    expect(
      screen.getByText("Your session expired. Sign in again."),
    ).toBeInTheDocument();
  });

  it("shows a status while the session is loading", () => {
    renderWithProviders(
      <RequireAuth reason="see profiles">
        <p>secret</p>
      </RequireAuth>,
      { auth: { status: "loading" } },
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders the children when signed in", () => {
    renderWithProviders(
      <RequireAuth reason="see profiles">
        <p>secret</p>
      </RequireAuth>,
      { auth: { status: "signedIn", user: { uid: "u1", phone: null } } },
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
