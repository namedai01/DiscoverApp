import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeAuthClient } from "@/lib/auth/types";
import { aUser } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { FakeSignIn } from "./FakeSignIn";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function fakeClient(): FakeAuthClient {
  return {
    subscribe: vi.fn(() => () => {}),
    getToken: vi.fn(async () => null),
    signOut: vi.fn(async () => {}),
    signIn: vi.fn(),
  };
}

beforeEach(() => replace.mockReset());

describe("FakeSignIn", () => {
  it("rejects an invalid uid without signing in", async () => {
    const client = fakeClient();
    const getMe = vi.fn();
    renderWithProviders(<FakeSignIn client={client} next="/me" />, {
      api: { getMe },
    });
    await userEvent.type(screen.getByLabelText("User id"), "u 1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      screen.getByText("Use 1–64 letters, digits, - or _."),
    ).toBeInTheDocument();
    expect(client.signIn).not.toHaveBeenCalled();
    expect(getMe).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs in, creates the profile, then redirects to a safe next", async () => {
    const client = fakeClient();
    const getMe = vi.fn().mockResolvedValue(aUser({ id: "u1" }));
    renderWithProviders(<FakeSignIn client={client} next="/u/abc?x=1" />, {
      api: { getMe },
    });
    await userEvent.type(screen.getByLabelText("User id"), "u1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/u/abc?x=1"));
    expect(client.signIn).toHaveBeenCalledWith("u1");
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(getMe.mock.invocationCallOrder[0]).toBeLessThan(
      replace.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("never redirects off-site", async () => {
    const getMe = vi.fn().mockResolvedValue(aUser());
    renderWithProviders(<FakeSignIn client={fakeClient()} next="//evil.com" />, {
      api: { getMe },
    });
    await userEvent.type(screen.getByLabelText("User id"), "u1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
