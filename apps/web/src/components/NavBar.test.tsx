import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { NavBar } from "./NavBar";

vi.mock("next/navigation", () => ({ usePathname: () => "/people" }));

describe("NavBar", () => {
  it("marks the active route", () => {
    renderWithProviders(<NavBar />, {
      auth: { status: "signedIn", user: { uid: "u1", phone: null } },
    });
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Explore" })).not.toHaveAttribute(
      "aria-current",
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/people", "/map", "/post", "/me"]);
  });

  it("offers Sign in in place of Me when signed out", () => {
    renderWithProviders(<NavBar />, { auth: { status: "signedOut" } });
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/people", "/map", "/post", "/signin"]);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Me" })).not.toBeInTheDocument();
  });

  it("keeps Me while the session is loading", () => {
    renderWithProviders(<NavBar />, { auth: { status: "loading" } });
    expect(screen.getByRole("link", { name: "Me" })).toHaveAttribute(
      "href",
      "/me",
    );
  });
});
