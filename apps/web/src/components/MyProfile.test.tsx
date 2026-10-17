import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { UploadError, getUploader, prepareUpload } from "@/lib/upload";
import { aUser, cursorPage } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { MyProfile } from "./MyProfile";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/upload")>()),
  prepareUpload: vi.fn(),
  getUploader: vi.fn(),
}));

const me = aUser({ id: "u1", displayName: "Dai", followerCount: 3 });
const signedIn = { status: "signedIn" as const, user: { uid: "u1", phone: null } };
const photo = () => new File(["x"], "photo.png", { type: "image/png" });

function setup(overrides: Record<string, unknown> = {}) {
  const getMe = vi.fn().mockResolvedValue(me);
  const updateMe = vi.fn().mockImplementation(async (patch) => ({ ...me, ...patch }));
  const listUserStories = vi.fn().mockResolvedValue(cursorPage([]));
  const signOut = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<MyProfile />, {
    api: { getMe, updateMe, listUserStories, ...overrides },
    auth: { ...signedIn, signOut },
  });
  return { getMe, updateMe, listUserStories, signOut };
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(prepareUpload).mockReset();
  vi.mocked(getUploader).mockReset();
});

describe("MyProfile", () => {
  it("shows the profile, follower count and my stories", async () => {
    const { listUserStories } = setup();
    expect(await screen.findByRole("heading", { name: "Dai" })).toBeInTheDocument();
    expect(screen.getByText("3 followers")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My stories" })).toBeInTheDocument();
    await waitFor(() =>
      expect(listUserStories).toHaveBeenCalledWith("u1", expect.anything()),
    );
  });

  it("offers a retry when the profile fails to load", async () => {
    const getMe = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, "network", "Can't reach the server."))
      .mockResolvedValue(me);
    setup({ getMe });
    expect(await screen.findByText("Can't reach the server.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Dai" })).toBeInTheDocument();
  });

  describe("rename", () => {
    it("saves the trimmed name once even on a double click", async () => {
      const { updateMe } = setup();
      await userEvent.click(await screen.findByRole("button", { name: "Edit name" }));
      const input = screen.getByLabelText("Display name");
      await userEvent.clear(input);
      await userEvent.type(input, "  An  ");
      await userEvent.dblClick(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("heading", { name: "An" })).toBeInTheDocument();
      expect(updateMe).toHaveBeenCalledTimes(1);
      expect(updateMe).toHaveBeenCalledWith({ displayName: "An" });
    });

    it("rejects a name over 50 code points", async () => {
      const { updateMe } = setup();
      await userEvent.click(await screen.findByRole("button", { name: "Edit name" }));
      const input = screen.getByLabelText("Display name");
      await userEvent.clear(input);
      // Emoji are 2 UTF-16 units but one code point: 51 of them is too long.
      await userEvent.click(input);
      await userEvent.paste("😀".repeat(51));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(
        screen.getByText("Display name must be 1 to 50 characters."),
      ).toBeInTheDocument();
      expect(updateMe).not.toHaveBeenCalled();
    });

    it("rejects a blank name", async () => {
      const { updateMe } = setup();
      await userEvent.click(await screen.findByRole("button", { name: "Edit name" }));
      const input = screen.getByLabelText("Display name");
      await userEvent.clear(input);
      await userEvent.type(input, "   ");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(
        screen.getByText("Display name must be 1 to 50 characters."),
      ).toBeInTheDocument();
      expect(updateMe).not.toHaveBeenCalled();
    });

    it("keeps the editor open and explains when the save fails", async () => {
      const updateMe = vi
        .fn()
        .mockRejectedValue(new ApiError(0, "network", "Can't reach the server."));
      setup({ updateMe });
      await userEvent.click(await screen.findByRole("button", { name: "Edit name" }));
      await userEvent.type(screen.getByLabelText("Display name"), "x");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Can't reach the server.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("cancels without saving", async () => {
      const { updateMe } = setup();
      await userEvent.click(await screen.findByRole("button", { name: "Edit name" }));
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("heading", { name: "Dai" })).toBeInTheDocument();
      expect(updateMe).not.toHaveBeenCalled();
    });
  });

  describe("avatar", () => {
    it("prepares, uploads, then saves the photo url", async () => {
      const blob = new Blob(["jpeg"], { type: "image/jpeg" });
      const uploader = vi.fn().mockResolvedValue("https://storage.example/p.jpg");
      vi.mocked(prepareUpload).mockResolvedValue(blob);
      vi.mocked(getUploader).mockResolvedValue(uploader);
      const { updateMe } = setup();

      await screen.findByRole("heading", { name: "Dai" });
      await userEvent.upload(screen.getByLabelText("Change photo"), photo());

      await waitFor(() =>
        expect(updateMe).toHaveBeenCalledWith({
          photoUrl: "https://storage.example/p.jpg",
        }),
      );
      expect(uploader).toHaveBeenCalledWith("u1", blob);
      expect(updateMe).toHaveBeenCalledTimes(1);
    });

    it("does not save when the upload fails", async () => {
      vi.mocked(prepareUpload).mockResolvedValue(new Blob(["x"]));
      vi.mocked(getUploader).mockResolvedValue(
        vi.fn().mockRejectedValue(new Error("storage/unauthorized")),
      );
      const { updateMe } = setup();

      await screen.findByRole("heading", { name: "Dai" });
      await userEvent.upload(screen.getByLabelText("Change photo"), photo());

      expect(
        await screen.findByText("Couldn't upload the photo. Try again."),
      ).toBeInTheDocument();
      expect(updateMe).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Change photo")).toBeEnabled();
    });

    it("shows the message of an UploadError", async () => {
      vi.mocked(prepareUpload).mockRejectedValue(
        new UploadError("That photo is too large to upload."),
      );
      const { updateMe } = setup();

      await screen.findByRole("heading", { name: "Dai" });
      await userEvent.upload(screen.getByLabelText("Change photo"), photo());

      expect(
        await screen.findByText("That photo is too large to upload."),
      ).toBeInTheDocument();
      expect(getUploader).not.toHaveBeenCalled();
      expect(updateMe).not.toHaveBeenCalled();
    });

    it("blocks a second choice while an upload is running", async () => {
      let finish!: (url: string) => void;
      const uploader = vi.fn(
        () => new Promise<string>((resolve) => (finish = resolve)),
      );
      vi.mocked(prepareUpload).mockResolvedValue(new Blob(["x"]));
      vi.mocked(getUploader).mockResolvedValue(uploader);
      setup();

      await screen.findByRole("heading", { name: "Dai" });
      await userEvent.upload(screen.getByLabelText("Change photo"), photo());
      await waitFor(() => expect(uploader).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText("Change photo")).toBeDisabled();
      finish("https://storage.example/p.jpg");
      await waitFor(() => expect(screen.getByLabelText("Change photo")).toBeEnabled());
    });
  });

  it("signs out, then goes to the home page", async () => {
    const { signOut } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
      push.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
