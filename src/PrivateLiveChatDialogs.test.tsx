import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreatePrivateRoomDialog, ManagePrivateRoomDialog } from "./PrivateLiveChatDialogs";

const invitees = [
  { id: "student-1", displayName: "Talia Brooks", role: "student" as const },
  { id: "guardian-1", displayName: "Morgan Brooks", role: "guardian" as const }
];

describe("private live chat dialogs", () => {
  it("searches active accounts and requires a name and invitee", async () => {
    const onCreate = vi.fn(async () => undefined);
    render(<CreatePrivateRoomDialog open invitees={invitees} isLoadingInvitees={false} error="" onClose={vi.fn()} onCreate={onCreate} />);

    const create = screen.getByRole("button", { name: "Create Room" });
    expect(create).toBeDisabled();
    expect(screen.getByRole("radiogroup", { name: "Tab color" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();
    fireEvent.change(screen.getByRole("textbox", { name: "Room name" }), { target: { value: "Leadership" } });
    fireEvent.click(screen.getByRole("radio", { name: "Emerald" }));
    expect(screen.getByTestId("room-tab-color-preview")).toHaveStyle("--live-chat-room-tab-color: #2ea66f");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), { target: { value: "Talia" } });
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.queryByText("Morgan Brooks")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Invite Talia Brooks" }));
    fireEvent.click(create);
    expect(onCreate).toHaveBeenCalledWith({ name: "Leadership", memberIds: ["student-1"], tabColor: "#2ea66f" });
  });

  it("shows creator management and member leave as separate permissions", () => {
    const room = { id: "room-1", name: "Leadership", tabColor: "#2f80c9" as const, creatorId: "creator-1", createdAt: "now", updatedAt: "now", members: [
      { profileId: "creator-1", displayName: "Coach", role: "staff" as const, joinedAt: "now" },
      { profileId: "student-1", displayName: "Talia Brooks", role: "student" as const, joinedAt: "now" }
    ] };
    const { rerender } = render(<ManagePrivateRoomDialog open room={room} currentProfileId="creator-1" invitees={invitees} error="" onClose={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Room" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave Room" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ocean" })).toBeChecked();

    rerender(<ManagePrivateRoomDialog open room={room} currentProfileId="student-1" invitees={invitees} error="" onClose={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Leave Room" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Tab color" })).not.toBeInTheDocument();
  });

  it("lets the creator change a persisted tab color", () => {
    const onUpdate = vi.fn(async () => undefined);
    const room = { id: "room-1", name: "Leadership", tabColor: "#2f80c9" as const, creatorId: "creator-1", createdAt: "now", updatedAt: "now", members: [
      { profileId: "creator-1", displayName: "Coach", role: "staff" as const, joinedAt: "now" },
      { profileId: "student-1", displayName: "Talia Brooks", role: "student" as const, joinedAt: "now" }
    ] };
    render(<ManagePrivateRoomDialog open room={room} currentProfileId="creator-1" invitees={invitees} error="" onClose={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} onLeave={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Crimson" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onUpdate).toHaveBeenCalledWith({ name: "Leadership", memberIds: ["student-1"], tabColor: "#c94b62" });
  });
});
