import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { NavBar } from "./NavBar";

vi.mock("next/navigation", () => ({ usePathname: () => "/people" }));

describe("NavBar", () => {
  it("marks the active route", () => {
    renderWithProviders(<NavBar />);
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
});
