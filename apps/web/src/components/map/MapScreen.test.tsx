import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { directionsUrl } from "@/lib/format";
import { aLocation } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { MapScreen } from "./MapScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const viewProps = vi.hoisted(() => ({ last: null as unknown }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function MapViewStub(props: {
      locations: { id: string }[];
      selected: { id: string } | null;
      onMarkerClick: (id: string) => void;
    }) {
      viewProps.last = props;
      return (
        <div data-testid="map-view">
          {props.locations.length} markers, selected {props.selected?.id ?? "none"}
          <button type="button" onClick={() => props.onMarkerClick("loc-rong")}>
            marker
          </button>
        </div>
      );
    },
}));

const rong = aLocation({
  id: "loc-rong",
  venueName: "Cầu Rồng",
  lat: 16.06,
  lng: 108.22,
});
const lake = aLocation({ id: "loc-lake", venueName: "West Lake" });

describe("MapScreen", () => {
  beforeEach(() => {
    push.mockReset();
    viewProps.last = null;
  });

  it("selecting a place passes it to the map and offers directions and details", async () => {
    const listLocations = vi.fn().mockResolvedValue({ items: [rong, lake] });
    renderWithProviders(<MapScreen />, { api: { listLocations } });

    await screen.findByText(/2 markers, selected none/);
    expect(screen.queryByRole("link", { name: "Directions" })).toBeNull();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Place" }),
      "Cầu Rồng",
    );

    expect(screen.getByText(/selected loc-rong/)).toBeInTheDocument();
    expect((viewProps.last as { selected: unknown }).selected).toEqual(rong);
    const directions = screen.getByRole("link", { name: "Directions" });
    expect(directions).toHaveAttribute("href", directionsUrl(16.06, 108.22));
    expect(directions).toHaveAttribute("target", "_blank");
    expect(directions).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute(
      "href",
      "/places/loc-rong",
    );
  });

  it("sorts the options by name after the placeholder", async () => {
    const listLocations = vi.fn().mockResolvedValue({ items: [lake, rong] });
    renderWithProviders(<MapScreen />, { api: { listLocations } });
    await screen.findByText(/2 markers/);

    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Choose a place", "Cầu Rồng", "West Lake"]);
  });

  it("preselects initialPlaceId", async () => {
    const listLocations = vi.fn().mockResolvedValue({ items: [rong, lake] });
    renderWithProviders(<MapScreen initialPlaceId="loc-rong" />, {
      api: { listLocations },
    });

    expect(await screen.findByText(/selected loc-rong/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Place" })).toHaveValue(
      "loc-rong",
    );
  });

  it("opens the place when a marker is clicked", async () => {
    const listLocations = vi.fn().mockResolvedValue({ items: [rong] });
    renderWithProviders(<MapScreen />, { api: { listLocations } });

    await userEvent.click(await screen.findByRole("button", { name: "marker" }));

    expect(push).toHaveBeenCalledWith("/places/loc-rong");
  });

  it("shows an error with retry when places fail to load", async () => {
    const listLocations = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, "network", "offline"))
      .mockResolvedValueOnce({ items: [rong] });
    renderWithProviders(<MapScreen />, { api: { listLocations } });

    expect(
      await screen.findByText("Couldn't load places. Try again."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(/1 markers/)).toBeInTheDocument();
    expect(listLocations).toHaveBeenCalledTimes(2);
  });
});
