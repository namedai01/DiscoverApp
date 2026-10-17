import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ACCENTS } from "@/lib/accent";
import { AccentPicker } from "./AccentPicker";

describe("AccentPicker", () => {
  it("offers one radio per accent and checks the stored one", () => {
    localStorage.setItem("memopin.accent", "Green");
    render(<AccentPicker />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(
      Object.keys(ACCENTS),
    );
    for (const name of Object.keys(ACCENTS)) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Green" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Yellow" })).not.toBeChecked();
  });

  it("defaults to Yellow", () => {
    render(<AccentPicker />);
    expect(screen.getByRole("radio", { name: "Yellow" })).toBeChecked();
  });

  it("applies and remembers the chosen accent", async () => {
    const setProperty = vi.spyOn(document.documentElement.style, "setProperty");
    render(<AccentPicker />);
    await userEvent.click(screen.getByRole("radio", { name: "Blue" }));
    expect(setProperty).toHaveBeenCalledWith("--accent", ACCENTS.Blue);
    expect(localStorage.getItem("memopin.accent")).toBe("Blue");
    expect(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
    setProperty.mockRestore();
  });
});
