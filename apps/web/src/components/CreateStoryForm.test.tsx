import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { GeoError, getCurrentPosition } from "@/lib/geo";
import { getUploader, prepareUpload } from "@/lib/upload";
import { aStory } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { CreateStoryForm } from "./CreateStoryForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/geo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/geo")>()),
  getCurrentPosition: vi.fn(),
}));
vi.mock("@/lib/upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/upload")>()),
  prepareUpload: vi.fn(),
  getUploader: vi.fn(),
}));

const signedIn = { status: "signedIn" as const, user: { uid: "u1", phone: null } };
const photo = () => new File(["x"], "photo.png", { type: "image/png" });
const UPLOADED = "https://firebasestorage.googleapis.com/v0/b/b/o/uploads%2Fu1%2Fa.jpg?alt=media";
const DENIED =
  "Location access is blocked. Your story is attached to the nearest place, so allow location for this site in your browser settings and try again.";
const NO_PLACES = "There are no places yet to attach your story to.";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const upload = vi.fn();

function setup(createStory = vi.fn().mockResolvedValue(aStory({ location: { id: "l1", venueName: "Hồ Gươm" } }))) {
  renderWithProviders(<CreateStoryForm />, {
    api: { createStory },
    auth: signedIn,
  });
  return { createStory };
}

async function fill(title = "Hồ Gươm sunset") {
  await userEvent.upload(screen.getByLabelText("Photo"), photo());
  await userEvent.type(screen.getByLabelText("Title"), title);
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Post story" }));

beforeEach(() => {
  push.mockReset();
  upload.mockReset().mockResolvedValue(UPLOADED);
  vi.mocked(getCurrentPosition)
    .mockReset()
    .mockResolvedValue({ lat: 21.03, lng: 105.85 });
  vi.mocked(prepareUpload).mockReset().mockResolvedValue(new Blob(["j"]));
  vi.mocked(getUploader).mockReset().mockResolvedValue(upload);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("CreateStoryForm", () => {
  it("prepares, locates, uploads and posts, then opens the place", async () => {
    const prepared = deferred<Blob>();
    vi.mocked(prepareUpload).mockReturnValue(prepared.promise);
    const position = deferred<{ lat: number; lng: number }>();
    const uploaded = deferred<string>();
    const posted = deferred<ReturnType<typeof aStory>>();
    vi.mocked(getCurrentPosition).mockReturnValue(position.promise);
    upload.mockReturnValue(uploaded.promise);
    const { createStory } = setup(vi.fn().mockReturnValue(posted.promise));
    await fill();
    await submit();

    expect(await screen.findByRole("status")).toHaveTextContent("Preparing photo…");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    prepared.resolve(new Blob(["j"]));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Finding your location…"),
    );
    expect(upload).not.toHaveBeenCalled();
    position.resolve({ lat: 21.03, lng: 105.85 });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Uploading photo…"),
    );
    uploaded.resolve(UPLOADED);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Posting…"),
    );
    posted.resolve(aStory({ location: { id: "l1", venueName: "Hồ Gươm" } }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/places/l1?posted=1"));
    expect(upload).toHaveBeenCalledWith("u1", expect.any(Blob));
    expect(createStory).toHaveBeenCalledWith({
      title: "Hồ Gươm sunset",
      type: "",
      description: "",
      imageUrl: UPLOADED,
      lat: 21.03,
      lng: 105.85,
    });
  });

  it("trims the title before posting", async () => {
    const { createStory } = setup();
    await fill("  Hồ Gươm  ");
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(createStory).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Hồ Gươm" }),
    );
  });

  it("shows a photo preview and revokes it when the photo changes", async () => {
    setup();
    await userEvent.upload(screen.getByLabelText("Photo"), photo());
    expect(await screen.findByAltText("Selected photo")).toHaveAttribute(
      "src",
      "blob:preview",
    );
    await userEvent.upload(screen.getByLabelText("Photo"), photo());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("rejects a non-image at selection", async () => {
    setup();
    await userEvent.upload(
      screen.getByLabelText("Photo"),
      new File(["x"], "a.txt", { type: "text/plain" }),
      { applyAccept: false },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose an image file.");
  });

  it("keeps the form and uploads nothing when location is denied", async () => {
    vi.mocked(getCurrentPosition).mockRejectedValue(new GeoError("denied"));
    const { createStory } = setup();
    await fill();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(DENIED);
    expect(prepareUpload).toHaveBeenCalledTimes(1);
    expect(getUploader).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(createStory).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveValue("Hồ Gươm sunset");
    expect(screen.getByRole("button", { name: "Post story" })).toBeEnabled();
  });

  it("explains a photo that cannot be processed, without posting", async () => {
    const { UploadError } = await import("@/lib/upload");
    vi.mocked(prepareUpload).mockRejectedValue(new UploadError("This photo format isn't supported. Choose a JPEG or PNG."));
    const { createStory } = setup();
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This photo format isn't supported. Choose a JPEG or PNG.",
    );
    // Decoding comes before locating, so a bad photo never asks for location.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(createStory).not.toHaveBeenCalled();
  });

  it("does not prepare the photo again when retrying after a denied location", async () => {
    vi.mocked(getCurrentPosition).mockRejectedValueOnce(new GeoError("denied"));
    setup();
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(DENIED);

    await submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(prepareUpload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("reuses the uploaded photo when posting again after a 422", async () => {
    const createStory = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(422, "unprocessable", "no locations"))
      .mockResolvedValue(aStory({ location: { id: "l1", venueName: "Hồ Gươm" } }));
    setup(createStory);
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(NO_PLACES);

    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/places/l1?posted=1"));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(createStory).toHaveBeenCalledTimes(2);
    expect(createStory.mock.calls[1]?.[0]).toMatchObject({ imageUrl: UPLOADED });
  });

  it("uploads again when a different photo is chosen", async () => {
    const createStory = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(422, "unprocessable", "no locations"))
      .mockResolvedValue(aStory());
    setup(createStory);
    await fill();
    await submit();
    await screen.findByRole("alert");
    await userEvent.upload(screen.getByLabelText("Photo"), photo());
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("shows the server's message for a validation error", async () => {
    setup(
      vi.fn().mockRejectedValue(new ApiError(400, "bad_request", "imageUrl must be a storage URL")),
    );
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "imageUrl must be a storage URL",
    );
  });

  it("shows the network message when the API is unreachable", async () => {
    setup(
      vi.fn().mockRejectedValue(new ApiError(0, "network", "Can't reach the server.")),
    );
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server.");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic message when the upload itself fails", async () => {
    upload.mockRejectedValue(new Error("storage/unauthorized"));
    const { createStory } = setup();
    await fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't upload the photo. Try again.",
    );
    expect(createStory).not.toHaveBeenCalled();
  });

  describe("validation", () => {
    it("asks for a photo", async () => {
      setup();
      await userEvent.type(screen.getByLabelText("Title"), "x");
      await submit();
      expect(await screen.findByRole("alert")).toHaveTextContent("Choose a photo.");
      expect(getCurrentPosition).not.toHaveBeenCalled();
    });

    it.each([
      ["", "Add a title."],
      ["   ", "Add a title."],
      ["a".repeat(101), "Title must be 1 to 100 characters."],
    ])("title %j -> %s", async (title, message) => {
      setup();
      await userEvent.upload(screen.getByLabelText("Photo"), photo());
      if (title) await userEvent.type(screen.getByLabelText("Title"), title);
      await submit();
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(getCurrentPosition).not.toHaveBeenCalled();
    });

    it("counts code points, not UTF-16 units", async () => {
      const { createStory } = setup();
      await userEvent.upload(screen.getByLabelText("Photo"), photo());
      // 100 emoji are 200 UTF-16 units but exactly 100 code points.
      await userEvent.type(screen.getByLabelText("Title"), "😀".repeat(100));
      await submit();
      await waitFor(() => expect(createStory).toHaveBeenCalled());
    });

    it("limits type to 50", async () => {
      setup();
      await userEvent.upload(screen.getByLabelText("Photo"), photo());
      await userEvent.type(screen.getByLabelText("Title"), "t");
      await userEvent.type(screen.getByLabelText("Type"), "a".repeat(51));
      await submit();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Type must be at most 50 characters.",
      );
      expect(getCurrentPosition).not.toHaveBeenCalled();
    });

    it("limits description to 2000", async () => {
      setup();
      await userEvent.upload(screen.getByLabelText("Photo"), photo());
      await userEvent.type(screen.getByLabelText("Title"), "t");
      // paste: typing 2001 characters one by one is slow.
      await userEvent.click(screen.getByLabelText("Description"));
      await userEvent.paste("a".repeat(2001));
      await submit();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Description must be at most 2000 characters.",
      );
      expect(getCurrentPosition).not.toHaveBeenCalled();
    });
  });

  it("posts once on a double click and disables the button while busy", async () => {
    const position = deferred<{ lat: number; lng: number }>();
    vi.mocked(getCurrentPosition).mockReturnValue(position.promise);
    const { createStory } = setup();
    await fill();
    await userEvent.dblClick(screen.getByRole("button", { name: "Post story" }));
    expect(screen.getByRole("button", { name: "Post story" })).toBeDisabled();
    position.resolve({ lat: 21.03, lng: 105.85 });
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(createStory).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
