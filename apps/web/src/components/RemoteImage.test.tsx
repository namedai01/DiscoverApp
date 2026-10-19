import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RemoteImage } from "./RemoteImage";

describe("RemoteImage", () => {
  it("renders a placeholder when there is no src", () => {
    render(<RemoteImage src="" alt="Lake" />);
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Lake" })).toBeNull();
  });

  it("renders the image when src is set", () => {
    render(<RemoteImage src="https://img/x.jpg" alt="Lake" />);
    expect(screen.getByRole("img", { name: "Lake" })).toHaveAttribute(
      "src",
      "https://img/x.jpg",
    );
    expect(screen.queryByTestId("image-placeholder")).toBeNull();
  });

  it("swaps to the placeholder when the image fails to load", () => {
    render(<RemoteImage src="https://img/broken.jpg" alt="Lake" />);
    fireEvent.error(screen.getByRole("img", { name: "Lake" }));
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Lake" })).toBeNull();
  });

  it("retries when src changes after a failure", () => {
    const { rerender } = render(<RemoteImage src="https://img/a.jpg" alt="Lake" />);
    fireEvent.error(screen.getByRole("img", { name: "Lake" }));
    rerender(<RemoteImage src="https://img/b.jpg" alt="Lake" />);
    expect(screen.getByRole("img", { name: "Lake" })).toHaveAttribute(
      "src",
      "https://img/b.jpg",
    );
  });
});
