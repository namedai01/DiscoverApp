import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { aStory, cursorPage } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { UserTimeline } from "./UserTimeline";

describe("UserTimeline", () => {
  it("explains that following unlocks the stories on 403", async () => {
    const listUserStories = vi
      .fn()
      .mockRejectedValue(new ApiError(403, "forbidden", "follow to see"));
    renderWithProviders(
      <UserTimeline userId="u2" ownerName="An" refreshKey={0} />,
      { api: { listUserStories } },
    );

    expect(
      await screen.findByText("Follow An to see their stories."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an empty state", async () => {
    const listUserStories = vi.fn().mockResolvedValue(cursorPage([]));
    renderWithProviders(
      <UserTimeline userId="u2" ownerName="An" refreshKey={0} />,
      { api: { listUserStories } },
    );

    expect(await screen.findByText("No stories yet")).toBeInTheDocument();
    expect(listUserStories).toHaveBeenCalledWith("u2", {
      cursor: null,
      limit: 12,
    });
  });

  it("lists stories and refetches when refreshKey changes", async () => {
    const listUserStories = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(403, "forbidden", "follow to see"))
      .mockResolvedValue(cursorPage([aStory({ id: "s1", title: "Pho trip" })]));
    const { rerender } = renderWithProviders(
      <UserTimeline userId="u2" ownerName="An" refreshKey={0} />,
      { api: { listUserStories } },
    );
    await screen.findByText("Follow An to see their stories.");

    rerender(<UserTimeline userId="u2" ownerName="An" refreshKey={1} />);

    expect(await screen.findByText("Pho trip")).toBeInTheDocument();
    expect(screen.queryByText("Follow An to see their stories.")).toBeNull();
  });

  it("surfaces other errors with a retry", async () => {
    const listUserStories = vi
      .fn()
      .mockRejectedValue(new ApiError(0, "network", "Can't reach the server."));
    renderWithProviders(
      <UserTimeline userId="u2" ownerName="An" refreshKey={0} />,
      { api: { listUserStories } },
    );

    expect(await screen.findByText("Can't reach the server.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
