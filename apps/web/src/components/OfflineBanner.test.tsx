import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { OfflineBanner } from "./OfflineBanner";

afterEach(() => {
  vi.restoreAllMocks();
});

const TEXT = "You're offline. Some content may be out of date.";

describe("OfflineBanner", () => {
  it("shows while offline and hides when back online", () => {
    renderWithProviders(<OfflineBanner />);
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(TEXT)).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });
});

describe("OfflineBanner initial state", () => {
  it("shows when the page loads while offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByText(TEXT)).toBeInTheDocument();
  });
});
