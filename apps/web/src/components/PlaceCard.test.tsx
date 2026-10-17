import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { aLocation } from "@/test/fixtures";
import { PlaceCard } from "./PlaceCard";

describe("PlaceCard", () => {
  it.each([
    [3, "3 stories"],
    [1, "1 story"],
    [0, "No stories yet"],
  ])("shows the story count %i as %s", (storyCount, text) => {
    render(<PlaceCard location={aLocation({ storyCount })} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("links to the place and shows its area", () => {
    render(
      <PlaceCard
        location={aLocation({ id: "l1", venueLocation: "Hoàn Kiếm" })}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/places/l1");
    expect(screen.getByText("Hoàn Kiếm")).toBeInTheDocument();
  });
});
