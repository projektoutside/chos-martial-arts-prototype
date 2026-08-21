import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstLoginWelcomeDialog } from "./FirstLoginWelcomeDialog";

const managerProfile = {
  username: "manager1",
  displayName: "Manager",
  role: "staff" as const,
  status: "active" as const,
  isOwner: true,
  welcomeSeenAt: null
};

describe("FirstLoginWelcomeDialog", () => {
  it("welcomes the signed-in profile and requires the primary acknowledgement", () => {
    const onAcknowledge = vi.fn();
    render(<FirstLoginWelcomeDialog profile={managerProfile} pending={false} error="" onAcknowledge={onAcknowledge} />);

    expect(screen.getByRole("dialog", { name: "Welcome to Cho's Martial Arts" })).toBeTruthy();
    expect(screen.getByText(/Welcome, Manager/)).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Welcome to Cho's Martial Arts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter Cho's App" }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate submission and presents a retryable save error", () => {
    const onAcknowledge = vi.fn();
    const { rerender } = render(<FirstLoginWelcomeDialog profile={managerProfile} pending error="" onAcknowledge={onAcknowledge} />);
    expect((screen.getByRole("button", { name: "Saving welcome" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(<FirstLoginWelcomeDialog profile={managerProfile} pending={false} error="Could not save your welcome progress." onAcknowledge={onAcknowledge} />);
    expect(screen.getByRole("alert").textContent).toContain("Could not save your welcome progress.");
    expect((screen.getByRole("button", { name: "Try Again" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
