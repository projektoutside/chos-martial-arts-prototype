import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { AppStateProvider } from "./state";

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

function renderLoggedInApp(path = "/") {
  window.localStorage.setItem("chos.session.v1", JSON.stringify({ email: "student@example.com", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" }));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

function renderLoggedOutApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>
  );
}

describe("login landing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  it("renders the centered portrait blend image on the login screen", () => {
    const { container } = renderLoggedOutApp("/");

    const portrait = container.querySelector(".login-portrait-stage img");
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
    expect(portrait).toHaveAttribute("src", "/Perfect1.png");
    expect(portrait?.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the portrait available on the reduced-motion login screen", () => {
    stubMatchMedia(true);
    const { container } = renderLoggedOutApp("/");

    expect(container.querySelector(".auth-logo")).toHaveClass("is-settled");
    expect(container.querySelector(".login-portrait-stage img")).toHaveAttribute("src", "/Perfect1.png");
  });

  it("toggles the portrait blend image on and off from the login screen", () => {
    const { container } = renderLoggedOutApp("/");

    expect(container.querySelector(".login-portrait-stage img")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide portrait background" }));
    expect(container.querySelector(".login-portrait-stage img")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show portrait background" }));
    expect(container.querySelector(".login-portrait-stage img")).toBeInTheDocument();
  });

  it("keeps the portrait toggle above the launch handoff overlay", () => {
    const { container } = renderLoggedOutApp("/");

    expect(screen.getByRole("button", { name: "Hide portrait background" })).toBeInTheDocument();
    expect(container.querySelector(".launch-loader")).toBeInTheDocument();
    expect(container.querySelector(".login-portrait-toggle")).toHaveClass("is-above-launch");
  });
});

describe("logged-in app dashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
  });

  it("shows a student-first home with six large student choices and secondary grown-up actions", () => {
    renderLoggedInApp("/");

    expect(screen.queryByRole("link", { name: "Cho's Martial Arts home" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cho's menu" })).toHaveAttribute("href", "/more");
    const header = screen.getByRole("banner");
    const topHeaderRow = header.firstElementChild as HTMLElement;
    expect(topHeaderRow).toHaveClass("header-inner");
    expect(topHeaderRow.querySelector(".header-logo-row")).not.toBeInTheDocument();
    expect(within(topHeaderRow).getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    expect(within(topHeaderRow).getByRole("link", { name: "Cho's menu" })).toHaveAttribute("href", "/more");
    expect(topHeaderRow.querySelector(".chos-menu-link img")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Cho's menu" })).toHaveAttribute("href", "/more");
    const headerActions = header.querySelector(".header-actions") as HTMLElement;
    expect(within(headerActions).queryByRole("link", { name: "Cho's menu" })).not.toBeInTheDocument();
    expect(within(headerActions).getByRole("button", { name: "Search site" })).toBeInTheDocument();
    expect(within(header).queryByText("Cho's Menu")).not.toBeInTheDocument();
    expect(within(header).queryByText("Everything else")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Student Home" })).toBeInTheDocument();
    expect(screen.getByLabelText("Today at Cho's")).toBeInTheDocument();

    const studentActions = screen.getByLabelText("Student actions");
    expect(within(studentActions).getAllByRole("link")).toHaveLength(6);
    expect(within(studentActions).getByRole("link", { name: /Today/i })).toHaveAttribute("href", "/");
    expect(within(studentActions).getByRole("link", { name: /Classes/i })).toHaveAttribute("href", "/classes");
    expect(within(studentActions).getByRole("link", { name: /My Progress/i })).toHaveAttribute("href", "/my-account?topic=progress");
    expect(within(studentActions).getByRole("link", { name: /Practice/i })).toHaveAttribute("href", "/programs?section=practice");
    expect(within(studentActions).getByRole("link", { name: /Programs/i })).toHaveAttribute("href", "/programs");
    expect(within(studentActions).getByRole("link", { name: /Ask for Help/i })).toHaveAttribute("href", "/contact-us");

    const parentActions = screen.getByLabelText("Parent and account actions");
    expect(within(parentActions).getAllByRole("link")).toHaveLength(4);
    expect(within(parentActions).getByRole("link", { name: /Bookings/i })).toHaveAttribute("href", "/my-account?topic=bookings");
    expect(within(parentActions).getByRole("link", { name: /Profile/i })).toHaveAttribute("href", "/my-account?topic=profile");
    expect(screen.queryByRole("heading", { name: "Train Like a Fighter, Live Like a Champion" })).not.toBeInTheDocument();
  });

  it("opens a Cho's menu for non-student materials from the logo button", () => {
    renderLoggedInApp("/more");

    expect(screen.getByRole("heading", { name: "Cho's Menu" })).toBeInTheDocument();
    const menu = screen.getByLabelText("Cho's non-student links");
    expect(within(menu).getByRole("link", { name: /Shop/i })).toHaveAttribute("href", "/shop");
    expect(within(menu).getByRole("link", { name: /Bookings/i })).toHaveAttribute("href", "/my-account?topic=bookings");
    expect(within(menu).getByRole("link", { name: /Orders/i })).toHaveAttribute("href", "/my-account?topic=orders");
    expect(within(menu).getByRole("link", { name: /Profile/i })).toHaveAttribute("href", "/my-account?topic=profile");
    expect(within(menu).getByRole("link", { name: /Private Lessons/i })).toHaveAttribute("href", "/private-lessons");
    expect(within(menu).getByRole("link", { name: /About Cho's/i })).toHaveAttribute("href", "/about-us");
    expect(within(menu).getByRole("link", { name: /Contact/i })).toHaveAttribute("href", "/contact-us");
    expect(screen.queryByLabelText("Student actions")).not.toBeInTheDocument();
  });

  it("keeps navigation controls on the launcher so users can move forward after going back", () => {
    renderLoggedInApp("/");

    const controls = screen.getByLabelText("App page navigation");
    expect(within(controls).getByRole("button", { name: "Go back" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Go forward" })).toBeInTheDocument();
  });

  it("shows back, home, and forward controls on pages opened from launcher icons", () => {
    renderLoggedInApp("/classes");

    const controls = screen.getByLabelText("App page navigation");
    expect(within(controls).getByRole("button", { name: "Go back" })).toBeInTheDocument();
    expect(within(controls).getByRole("link", { name: "Student Home" })).toHaveAttribute("href", "/");
    expect(within(controls).getByRole("button", { name: "Go forward" })).toBeInTheDocument();
  });

  it("uses compact logged-in pages and keeps marketing copy behind details", () => {
    renderLoggedInApp("/programs");

    expect(screen.getByRole("heading", { name: "Programs" })).toBeInTheDocument();
    expect(screen.getByText("Pick the training path you want to learn about.")).toBeInTheDocument();
    expect(screen.queryByText(/transformative experience/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /More Details/i }).length).toBeGreaterThan(0);
  });

  it("shows the compact support strip instead of the large site footer after login", () => {
    renderLoggedInApp("/classes");

    expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "Student help" })).toBeInTheDocument();
    expect(screen.queryByText("Site Links")).not.toBeInTheDocument();
  });
});

describe("focused account topics", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
  });

  it("shows only the orders topic when requested", () => {
    renderLoggedInApp("/my-account?topic=orders");

    expect(screen.getByRole("heading", { name: "Saved Orders" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Belt Progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("shows only the bookings topic when requested", () => {
    renderLoggedInApp("/my-account?topic=bookings");

    expect(screen.getByRole("heading", { name: "Saved Bookings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Belt Progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("shows only the profile topic when requested", () => {
    renderLoggedInApp("/my-account?topic=profile");

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Belt Progression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Saved Orders" })).not.toBeInTheDocument();
  });

  it("keeps student progress focused on the progress tools", () => {
    renderLoggedInApp("/my-account?topic=progress");

    expect(screen.getByRole("heading", { name: "Belt Progression" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Saved Orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Profile" })).not.toBeInTheDocument();
  });
});
