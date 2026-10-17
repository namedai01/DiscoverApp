import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aLocation } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { PlaceGrid } from "./PlaceGrid";

describe("PlaceGrid", () => {
  it("loads the next offset page for the current query", async () => {
    const items = Array.from({ length: 24 }, (_, i) =>
      aLocation({ id: `l${i}`, venueName: `Place ${i}` }),
    );
    const listLocations = vi
      .fn()
      .mockResolvedValue({ items: [aLocation({ id: "more", venueName: "Extra" })] });
    renderWithProviders(
      <PlaceGrid
        initial={{ items, next: "24" }}
        query="hồ"
        pageSize={24}
      />,
      { api: { listLocations } },
    );

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(listLocations).toHaveBeenCalledWith({
      q: "hồ",
      limit: 24,
      offset: 24,
    });
    expect(await screen.findByText("Extra")).toBeInTheDocument();
    // a short page ends the list
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("has no Load more for a short first page", () => {
    renderWithProviders(
      <PlaceGrid
        initial={{ items: [aLocation()], next: null }}
        query=""
        pageSize={24}
      />,
    );
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
