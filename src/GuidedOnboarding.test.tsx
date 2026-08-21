import "@testing-library/jest-dom/vitest";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import { GuidedOnboardingProvider } from "./GuidedOnboarding";
import { guidedOnboardingProgressStorageKey } from "./onboardingProgress";
import { TestingUpdateHistoryDialog } from "./TestingUpdateHistoryDialog";

function TutorialHarness({ email, onRequired, onUnrelated }: { email: string; onRequired: () => void; onUnrelated: () => void }) {
  const location = useLocation();
  return (
    <GuidedOnboardingProvider accountRole="staff" sessionEmail={email} enabled>
      <output data-testid="current-path">{location.pathname}</output>
      <button
        type="button"
        onClick={onRequired}
        data-guided-onboarding-id="staff.test-feature.v1"
        data-guided-onboarding-title="Test Feature"
        data-guided-onboarding-instruction="Opens the required test feature."
        data-guided-onboarding-priority="1"
      >
        Required feature
      </button>
      <button type="button" onClick={onUnrelated}>Unrelated action</button>
    </GuidedOnboardingProvider>
  );
}

function renderHarness(email: string, onRequired = vi.fn(), onUnrelated = vi.fn()) {
  return {
    onRequired,
    onUnrelated,
    ...render(
      <MemoryRouter initialEntries={["/live-chat"]}>
        <TutorialHarness email={email} onRequired={onRequired} onUnrelated={onUnrelated} />
      </MemoryRouter>
    )
  };
}

function AppUpdatesTutorialHarness({ email }: { email: string }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <GuidedOnboardingProvider accountRole="staff" sessionEmail={email} enabled>
      <section role="dialog" aria-modal="true" aria-label="Profile Settings">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          data-guided-onboarding-id="shared.profile-settings.app-updates.v1"
          data-guided-onboarding-title="App Updates"
          data-guided-onboarding-instruction="Opens every testing update so you can review past changes whenever you want."
          data-guided-onboarding-priority="700"
        >
          View App Updates
        </button>
        <button
          type="button"
          data-guided-onboarding-id="staff.profile-settings.close.v1"
          data-guided-onboarding-title="Profile Settings Panel"
          data-guided-onboarding-instruction="Close Profile Settings to continue."
          data-guided-onboarding-priority="701"
        >
          Close Profile Settings
        </button>
      </section>
      {historyOpen && <TestingUpdateHistoryDialog onClose={() => setHistoryOpen(false)} />}
    </GuidedOnboardingProvider>
  );
}

describe("GuidedOnboardingProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts once after login, blocks unrelated actions, and records the required target before it acts", async () => {
    const email = "manager123@chos.prototype";
    const onRequired = vi.fn(() => {
      const progress = JSON.parse(window.localStorage.getItem(guidedOnboardingProgressStorageKey(email)) ?? "{}") as { seenFeatureIds?: string[] };
      expect(progress.seenFeatureIds).toContain("staff.test-feature.v1");
    });
    const onUnrelated = vi.fn();
    renderHarness(email, onRequired, onUnrelated);

    await waitFor(() => expect(screen.getByTestId("current-path")).toHaveTextContent("/profile"));
    expect(await screen.findByRole("heading", { name: "Test Feature" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unrelated action" }));
    expect(onUnrelated).not.toHaveBeenCalled();

    const unrelatedKey = createEvent.keyDown(screen.getByRole("button", { name: "Unrelated action" }), { key: "Enter" });
    fireEvent(screen.getByRole("button", { name: "Unrelated action" }), unrelatedKey);
    expect(unrelatedKey.defaultPrevented).toBe(true);

    const backgroundScroll = createEvent.wheel(document.body, { deltaY: 100 });
    fireEvent(document.body, backgroundScroll);
    expect(backgroundScroll.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Required feature" }));
    expect(onRequired).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("guided-onboarding-layer")).not.toBeInTheDocument());
  });

  it("never repeats the same feature for the same user after remounting", async () => {
    const email = "returning.staff";
    const first = renderHarness(email);
    fireEvent.click(await screen.findByRole("button", { name: "Required feature" }));
    await waitFor(() => expect(screen.queryByTestId("guided-onboarding-layer")).not.toBeInTheDocument());
    first.unmount();

    renderHarness(email);
    await waitFor(() => expect(screen.getByTestId("current-path")).toHaveTextContent("/live-chat"));
    expect(screen.queryByTestId("guided-onboarding-layer")).not.toBeInTheDocument();
  });

  it("keeps progress separate for each user", async () => {
    const first = renderHarness("first.staff");
    fireEvent.click(await screen.findByRole("button", { name: "Required feature" }));
    first.unmount();

    renderHarness("second.staff");
    expect(await screen.findByRole("heading", { name: "Test Feature" })).toBeInTheDocument();
  });

  it("guides App updates into its safe close action while keeping Profile Settings open", async () => {
    const email = "updates.staff";
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <AppUpdatesTutorialHarness email={email} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("guided-onboarding-layer")).toHaveAttribute(
        "data-guided-onboarding-active-id",
        "shared.profile-settings.app-updates.v1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "View App Updates" }));

    expect(await screen.findByRole("dialog", { name: "App updates" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("guided-onboarding-layer")).toHaveAttribute(
        "data-guided-onboarding-active-id",
        "shared.profile-settings.app-updates.close.v1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Close app updates" }));

    expect(screen.queryByRole("dialog", { name: "App updates" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Profile Settings" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(guidedOnboardingProgressStorageKey(email)) ?? "{}")).toMatchObject({
      seenFeatureIds: expect.arrayContaining([
        "shared.profile-settings.app-updates.v1",
        "shared.profile-settings.app-updates.close.v1"
      ])
    });
  });
});
