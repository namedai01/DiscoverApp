import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aUser } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { PeopleList } from "./PeopleList";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

const an = aUser({ id: "u-an", displayName: "An", followerCount: 1 });
const binh = aUser({ id: "u-binh", displayName: "Bình", followerCount: 5 });

describe("PeopleList", () => {
  beforeEach(() => {
    replace.mockReset();
    search = "";
  });

  it("lists people with follower counts, linking to their profiles", async () => {
    const listUsers = vi.fn().mockResolvedValue({ items: [an, binh] });
    renderWithProviders(<PeopleList />, { api: { listUsers } });

    const first = await screen.findByRole("link", { name: /^An · 1 follower$/ });
    expect(first).toHaveAttribute("href", "/u/u-an");
    expect(
      screen.getByRole("link", { name: /^Bình · 5 followers$/ }),
    ).toHaveAttribute("href", "/u/u-binh");
    expect(listUsers).toHaveBeenCalledWith({ q: "", limit: 20, offset: 0 });
  });

  it("searches and keeps ?q= in the address bar", async () => {
    const listUsers = vi.fn().mockResolvedValue({ items: [an] });
    renderWithProviders(<PeopleList />, { api: { listUsers } });
    await screen.findByText(/^An/);

    await userEvent.type(screen.getByRole("searchbox"), " an {Enter}");

    expect(listUsers).toHaveBeenLastCalledWith({ q: "an", limit: 20, offset: 0 });
    expect(replace).toHaveBeenCalledWith("/people?q=an");
  });

  it("starts from the ?q= in the address bar", async () => {
    search = "q=linh";
    const listUsers = vi.fn().mockResolvedValue({ items: [] });
    renderWithProviders(<PeopleList />, { api: { listUsers } });

    expect(await screen.findByText("No people found.")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("linh");
    expect(listUsers).toHaveBeenCalledWith({ q: "linh", limit: 20, offset: 0 });
  });

  it("loads the next page by offset when a page is full", async () => {
    const full = Array.from({ length: 20 }, (_, i) =>
      aUser({ id: `u${i}`, displayName: `P${i}` }),
    );
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ items: full })
      .mockResolvedValueOnce({ items: [an] });
    renderWithProviders(<PeopleList />, { api: { listUsers } });

    await userEvent.click(await screen.findByRole("button", { name: "Load more" }));

    expect(listUsers).toHaveBeenLastCalledWith({ q: "", limit: 20, offset: 20 });
    expect(await screen.findByText(/^An/)).toBeInTheDocument();
  });
});
