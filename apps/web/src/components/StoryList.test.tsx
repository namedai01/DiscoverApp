import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aStory } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { StoryList } from "./StoryList";

const s1 = aStory({ id: "s1", title: "First story", description: "Desc one" });
const s2 = aStory({ id: "s2", title: "Second story" });

describe("StoryList", () => {
  it("pages with Load more until there is no cursor", async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [s2], next: null });
    renderWithProviders(
      <StoryList
        fetcher={fetcher}
        listKey="k"
        initial={{ items: [s1], next: "c1" }}
        empty="Nothing"
      />,
    );
    expect(screen.getByText("First story")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(fetcher).toHaveBeenCalledWith("c1");
    expect(await screen.findByText("Second story")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows the empty state", () => {
    renderWithProviders(
      <StoryList
        fetcher={vi.fn()}
        listKey="k"
        initial={{ items: [], next: null }}
        empty="No stories here yet."
      />,
    );
    expect(screen.getByText("No stories here yet.")).toBeInTheDocument();
  });

  it("fetches the first page when not seeded", async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [s1], next: null });
    renderWithProviders(
      <StoryList fetcher={fetcher} listKey="k" empty="Nothing" />,
    );
    expect(await screen.findByText("First story")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(null);
  });

  it("shows a retry when loading fails", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ items: [s1], next: null });
    renderWithProviders(
      <StoryList fetcher={fetcher} listKey="k" empty="Nothing" />,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(await screen.findByText("First story")).toBeInTheDocument();
  });

  it("opens a story in a dialog and closes it with Escape", async () => {
    renderWithProviders(
      <StoryList
        fetcher={vi.fn()}
        listKey="k"
        initial={{ items: [s1], next: null }}
        empty="Nothing"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /First story/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Desc one")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /Linh/ }),
    ).toHaveAttribute("href", "/u/user-1");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the dialog on a backdrop click", async () => {
    renderWithProviders(
      <StoryList
        fetcher={vi.fn()}
        listKey="k"
        initial={{ items: [s1], next: null }}
        empty="Nothing"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /First story/ }));
    await userEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
