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
    fireEvent.change(screen.getByRole("textbox", { name: "Room name" }), { target: { value: "Leadership" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search people" }), { target: { value: "Talia" } });
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.queryByText("Morgan Brooks")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Invite Talia Brooks" }));
    fireEvent.click(create);
    expect(onCreate).toHaveBeenCalledWith({ name: "Leadership", memberIds: ["student-1"] });
  });

  it("shows creator management and member leave as separate permissions", () => {
    const room = { id: "room-1", name: "Leadership", creatorId: "creator-1", createdAt: "now", updatedAt: "now", members: [
      { profileId: "creator-1", displayName: "Coach", role: "staff" as const, joinedAt: "now" },
      { profileId: "student-1", displayName: "Talia Brooks", role: "student" as const, joinedAt: "now" }
    ] };
    const { rerender } = render(<ManagePrivateRoomDialog open room={room} currentProfileId="creator-1" invitees={invitees} error="" onClose={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Room" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave Room" })).not.toBeInTheDocument();

    rerender(<ManagePrivateRoomDialog open room={room} currentProfileId="student-1" invitees={invitees} error="" onClose={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Leave Room" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
  });
});
