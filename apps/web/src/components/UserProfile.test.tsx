import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { UserWithFollow } from "@/lib/api/types";
import { aUser, cursorPage } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { UserProfile } from "./UserProfile";

const asUser = (overrides: Partial<UserWithFollow> = {}): UserWithFollow => ({
  ...aUser({ id: "u2", displayName: "An", followerCount: 1 }),
  isFollowing: false,
  ...overrides,
});

const signedIn = { status: "signedIn" as const, user: { uid: "u1", phone: null } };

describe("UserProfile", () => {
  it("shows 'This is you' with a link to /me instead of a Follow button", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValue(asUser({ id: "u1", displayName: "Dai" }));
    const listUserStories = vi.fn().mockResolvedValue(cursorPage([]));
    renderWithProviders(<UserProfile id="u1" />, {
      api: { getUser, listUserStories },
      auth: signedIn,
    });

    expect(await screen.findByText("This is you")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute(
      "href",
      "/me",
    );
    expect(screen.queryByRole("button", { name: /follow/i })).toBeNull();
  });

  it("says when the user does not exist", async () => {
    const getUser = vi
      .fn()
      .mockRejectedValue(new ApiError(404, "not_found", "user not found"));
    renderWithProviders(<UserProfile id="nope" />, {
      api: { getUser },
      auth: signedIn,
    });

    expect(await screen.findByText("This user doesn't exist.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers a retry on other errors", async () => {
    const getUser = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, "network", "Can't reach the server."))
      .mockResolvedValue(asUser());
    const listUserStories = vi.fn().mockResolvedValue(cursorPage([]));
    renderWithProviders(<UserProfile id="u2" />, {
      api: { getUser, listUserStories },
      auth: signedIn,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "An", level: 1 }),
    ).toBeInTheDocument();
  });

  it("refetches the profile and the timeline after following", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce(asUser())
      .mockResolvedValue(asUser({ isFollowing: true, followerCount: 2 }));
    const listUserStories = vi.fn().mockResolvedValue(cursorPage([]));
    const follow = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<UserProfile id="u2" />, {
      api: { getUser, listUserStories, follow },
      auth: signedIn,
    });
    expect(await screen.findByText("1 follower")).toBeInTheDocument();
    await waitFor(() => expect(listUserStories).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Follow" }));

    expect(follow).toHaveBeenCalledWith("u2");
    expect(await screen.findByText("2 followers")).toBeInTheDocument();
    expect(getUser).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument();
    await waitFor(() => expect(listUserStories).toHaveBeenCalledTimes(2));
  });

  it("keeps the profile on screen when the background refresh fails", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce(asUser())
      .mockRejectedValue(new ApiError(0, "network", "Can't reach the server."));
    const listUserStories = vi.fn().mockResolvedValue(cursorPage([]));
    const follow = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<UserProfile id="u2" />, {
      api: { getUser, listUserStories, follow },
      auth: signedIn,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Follow" }));

    expect(await screen.findByRole("button", { name: "Unfollow" })).toBeInTheDocument();
    await waitFor(() => expect(getUser).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "An", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Can't reach the server.")).toBeNull();
  });
});
