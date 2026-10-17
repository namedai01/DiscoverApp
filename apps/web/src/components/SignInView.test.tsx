import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirebaseAuthClient } from "@/lib/auth/types";
import { renderWithProviders } from "@/test/render";
import { SignInView } from "./SignInView";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => replace.mockReset());

describe("SignInView", () => {
  it("redirects a visitor who is already signed in", async () => {
    renderWithProviders(<SignInView next="/u/u2" />, {
      auth: { status: "signedIn", user: { uid: "u1", phone: null } },
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/u/u2"));
  });

  it("shows nothing but a status while the session loads", () => {
    renderWithProviders(<SignInView next="/" />, {
      auth: { status: "loading" },
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("explains missing Firebase config instead of showing the form", () => {
    renderWithProviders(<SignInView next="/" />, {
      auth: { status: "signedOut", client: null },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Firebase web config is missing NEXT_PUBLIC_FIREBASE_API_KEY/,
    );
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
  });

  it("shows the phone form for a Firebase client, with the session notice", () => {
    const client: FirebaseAuthClient = {
      subscribe: () => () => {},
      getToken: async () => null,
      signOut: async () => {},
      phone: { sendCode: vi.fn(), confirmCode: vi.fn(), reset: vi.fn() },
    };
    renderWithProviders(<SignInView next="/" />, {
      auth: {
        status: "signedOut",
        client,
        notice: "Your session expired. Sign in again.",
      },
    });
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(
      screen.getByText("Your session expired. Sign in again."),
    ).toBeInTheDocument();
  });
});
