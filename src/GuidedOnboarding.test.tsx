import "@testing-library/jest-dom/vitest";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import { GuidedOnboardingProvider } from "./GuidedOnboarding";
import { guidedOnboardingProgressStorageKey } from "./onboardingProgress";

function TutorialHarness({ email, onRequired, onUnrelated }: { email: string; onRequired: () => void; onUnrelated: () => void }) {
  const location = useLocation();
  return (
    <GuidedOnboardingProvider accountRole="staff" sessionEmail={email} enabled>
      <output data-testid="current-path">{location.pathname}</output>
      <button
        type="button"
        onClick={onRequired}
        data-guided-onboarding-id="staff.testFeature.v1"
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

describe("GuidedOnboardingProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts once after login, blocks unrelated actions, and records the required target before it acts", async () => {
    const email = "manager123@chos.prototype";
    const onRequired = vi.fn(() => {
      const progress = JSON.parse(window.localStorage.getItem(guidedOnboardingProgressStorageKey(email)) ?? "{}") as { seenFeatureIds?: string[] };
      expect(progress.seenFeatureIds).toContain("staff.testfeature.v1");
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
});
