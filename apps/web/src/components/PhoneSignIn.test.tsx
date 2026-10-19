import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PhoneAuth } from "@/lib/auth/types";
import { aUser } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { PhoneSignIn } from "./PhoneSignIn";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function phoneAuth(overrides: Partial<PhoneAuth> = {}): PhoneAuth {
  return {
    sendCode: vi.fn().mockResolvedValue(undefined),
    confirmCode: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    ...overrides,
  };
}

async function requestCode() {
  await userEvent.type(screen.getByLabelText("Phone number"), "+84 900 000 001");
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
}

beforeEach(() => replace.mockReset());

describe("PhoneSignIn", () => {
  it("sends the normalised number with a recaptcha container, then asks for the code", async () => {
    const auth = phoneAuth();
    renderWithProviders(<PhoneSignIn phoneAuth={auth} next="/" />);
    await requestCode();
    expect(auth.sendCode).toHaveBeenCalledWith(
      "+84900000001",
      expect.any(HTMLElement),
    );
    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  });

  it("explains a number without a country code and sends nothing", async () => {
    const auth = phoneAuth();
    renderWithProviders(<PhoneSignIn phoneAuth={auth} next="/" />);
    await userEvent.type(screen.getByLabelText("Phone number"), "0900000001");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(
      screen.getByText("Include the country code, e.g. +84 900 000 001."),
    ).toBeInTheDocument();
    expect(auth.sendCode).not.toHaveBeenCalled();
  });

  it("disables Send code while sending, so a double click sends once", async () => {
    let finish!: () => void;
    const sendCode = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    renderWithProviders(
      <PhoneSignIn phoneAuth={phoneAuth({ sendCode })} next="/" />,
    );
    await userEvent.type(
      screen.getByLabelText("Phone number"),
      "+84 900 000 001",
    );
    const button = screen.getByRole("button", { name: "Send code" });
    await userEvent.dblClick(button);
    expect(button).toBeDisabled();
    expect(sendCode).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByLabelText("Verification code");
  });

  it("shows a send failure and lets the user retry", async () => {
    const sendCode = vi
      .fn()
      .mockRejectedValueOnce({ code: "auth/too-many-requests" });
    renderWithProviders(
      <PhoneSignIn phoneAuth={phoneAuth({ sendCode })} next="/" />,
    );
    await requestCode();
    expect(
      await screen.findByText(
        "Too many attempts. Wait a few minutes and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
  });

  it("keeps the code input after a wrong code", async () => {
    const confirmCode = vi
      .fn()
      .mockRejectedValue({ code: "auth/invalid-verification-code" });
    const getMe = vi.fn();
    renderWithProviders(
      <PhoneSignIn phoneAuth={phoneAuth({ confirmCode })} next="/" />,
      { api: { getMe } },
    );
    await requestCode();
    await userEvent.type(await screen.findByLabelText("Verification code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("That code is incorrect.")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toHaveValue("123456");
    expect(getMe).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("confirms the code, creates the profile, then redirects", async () => {
    const auth = phoneAuth();
    const getMe = vi.fn().mockResolvedValue(aUser());
    renderWithProviders(<PhoneSignIn phoneAuth={auth} next="/u/abc" />, {
      api: { getMe },
    });
    await requestCode();
    await userEvent.type(await screen.findByLabelText("Verification code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/u/abc"));
    expect(auth.confirmCode).toHaveBeenCalledWith("123456");
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("goes back to the number step and resets the verifier", async () => {
    const auth = phoneAuth();
    renderWithProviders(<PhoneSignIn phoneAuth={auth} next="/" />);
    await requestCode();
    await userEvent.click(
      await screen.findByRole("button", { name: "Use a different number" }),
    );
    expect(auth.reset).toHaveBeenCalled();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
  });
});
