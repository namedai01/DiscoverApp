import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { renderWithProviders } from "@/test/render";
import { FollowButton } from "./FollowButton";

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("FollowButton", () => {
  it("sends one request on a double click and stays disabled until it settles", async () => {
    const d = deferred();
    const follow = vi.fn().mockReturnValue(d.promise);
    const onChange = vi.fn();
    renderWithProviders(
      <FollowButton userId="u2" isFollowing={false} onChange={onChange} />,
      { api: { follow } },
    );
    const button = screen.getByRole("button", { name: "Follow" });

    await userEvent.dblClick(button);

    expect(follow).toHaveBeenCalledTimes(1);
    expect(follow).toHaveBeenCalledWith("u2");
    expect(button).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();

    d.resolve();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
  });

  it("unfollows when already following", async () => {
    const unfollow = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    renderWithProviders(
      <FollowButton userId="u2" isFollowing onChange={onChange} />,
      { api: { unfollow } },
    );

    await userEvent.click(screen.getByRole("button", { name: "Unfollow" }));

    expect(unfollow).toHaveBeenCalledWith("u2");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });

  it("shows an error and re-enables on failure", async () => {
    const follow = vi
      .fn()
      .mockRejectedValue(new ApiError(0, "network", "Can't reach the server."));
    const onChange = vi.fn();
    renderWithProviders(
      <FollowButton userId="u2" isFollowing={false} onChange={onChange} />,
      { api: { follow } },
    );

    await userEvent.click(screen.getByRole("button", { name: "Follow" }));

    expect(
      await screen.findByText("Couldn't update follow. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();

    follow.mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
