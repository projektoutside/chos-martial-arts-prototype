import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function renderLoggedInApp(path = "/", role: "staff" | "student" = "staff") {
  window.localStorage.setItem("chos.session.v1", JSON.stringify({ email: "team@chos.prototype", remembered: true, createdAt: "2026-05-10T00:00:00.000Z" }));
  window.localStorage.setItem("chos.accountRoles.v1", JSON.stringify([{ email: "team@chos.prototype", role }]));

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

  it("keeps only the portrait visibility toggle on the login screen", () => {
    renderLoggedOutApp("/");

    expect(screen.getByRole("button", { name: "Hide portrait background" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose portrait background" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use Perfect1.png portrait background" })).not.toBeInTheDocument();
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

describe("app fullscreen behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  it("requests fullscreen on the first app interaction when supported", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
  });

  it("does not request fullscreen again while already fullscreen", () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });

    renderLoggedOutApp("/");
    fireEvent.pointerDown(document);

    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("asks new guest users whether they are staff or a student", async () => {
    renderLoggedOutApp("/");

    fireEvent.click(screen.getByRole("button", { name: "Sign in as Guest" }));

    expect(await screen.findByRole("dialog", { name: "Account type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cho's Staff" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Student / Family" })).toBeInTheDocument();
  });
});

describe("post-login operations app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
    stubMatchMedia();
  });

  it("opens a manager dashboard matching the reference layout sections", () => {
    renderLoggedInApp("/");

    expect(screen.getByRole("heading", { name: "Welcome back, Manager!" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Awakening Dojo" })).not.toBeInTheDocument();

    const sidebar = screen.getByLabelText("Manager navigation");
    ["Dashboard", "Students", "Classes", "Scheduling", "Events", "Merchandise", "Messages", "Reports", "Settings"].forEach((label) => {
      expect(within(sidebar).getByText(label)).toBeInTheDocument();
    });
    const sidebarLabels = within(sidebar).getAllByRole("link").map((link) => link.textContent?.trim());
    expect(sidebarLabels.slice(0, 3)).toEqual(["Dashboard", "Messages", "Students"]);

    const actionCards = screen.getByLabelText("Manager quick actions");
    const liveCalendar = screen.getByLabelText("Live studio calendar");
    expect(liveCalendar.compareDocumentPosition(actionCards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    ["Create New Student", "Edit Student", "Delete Student", "Edit Scheduling"].forEach((label) => {
      expect(within(actionCards).getByRole("heading", { name: label })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Student Management & Communication" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Student" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reminder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Follow Up" })).toBeInTheDocument();
    expect(liveCalendar).toBeInTheDocument();
    expect(within(liveCalendar).getByRole("link", { name: "Manage Schedule" })).toBeInTheDocument();
    expect(within(liveCalendar).getByLabelText("Selected date events")).toBeInTheDocument();
    const calendarGrid = within(liveCalendar).getByRole("grid", { name: /Cho's studio calendar/i });
    expect(calendarGrid).toHaveClass("manager-calendar-grid--month");
    expect(calendarGrid.querySelectorAll(".manager-calendar-day")).toHaveLength(42);
    const calendarViewControls = within(liveCalendar).getByRole("group", { name: "Calendar view" });
    expect(within(calendarViewControls).getByRole("button", { name: "Month" })).toHaveAttribute("aria-pressed", "true");
    const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    expect(within(liveCalendar).getByRole("button", { name: new RegExp(`Select ${todayLabel}, today`) })).toHaveClass("is-glowing-today", "is-transparent-today");
    const selectedCalendarDate = within(liveCalendar).getByRole("button", { name: /Select Monday, May 18/i });
    fireEvent.click(selectedCalendarDate);
    expect(selectedCalendarDate).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(calendarViewControls).getByRole("button", { name: "Week" }));
    expect(within(calendarViewControls).getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    expect(calendarGrid).toHaveClass("manager-calendar-grid--week");
    expect(calendarGrid.querySelectorAll(".manager-calendar-day")).toHaveLength(7);
    expect(within(liveCalendar).getByRole("button", { name: "Previous week" })).toBeInTheDocument();
    expect(within(liveCalendar).getByRole("button", { name: "Next week" })).toBeInTheDocument();
    expect(within(calendarGrid).getByRole("button", { name: /Select Monday, May 18/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Next week" }));
    expect(within(calendarGrid).getByRole("button", { name: /Select Monday, May 25/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Previous week" }));
    expect(within(calendarGrid).getByRole("button", { name: /Select Monday, May 18/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(calendarViewControls).getByRole("button", { name: "Day" }));
    expect(calendarGrid).toHaveClass("manager-calendar-grid--day");
    expect(calendarGrid.querySelectorAll(".manager-calendar-day")).toHaveLength(1);
    expect(within(liveCalendar).getByRole("button", { name: "Previous day" })).toBeInTheDocument();
    expect(within(liveCalendar).getByRole("button", { name: "Next day" })).toBeInTheDocument();
    expect(within(calendarGrid).getByRole("button", { name: /Select Monday, May 18/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Next day" }));
    expect(within(calendarGrid).getByRole("button", { name: /Select Tuesday, May 19/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Previous day" }));
    expect(within(calendarGrid).getByRole("button", { name: /Select Monday, May 18/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(calendarViewControls).getByRole("button", { name: "Month" }));
    expect(calendarGrid).toHaveClass("manager-calendar-grid--month");
    expect(calendarGrid.querySelectorAll(".manager-calendar-day")).toHaveLength(42);
    expect(within(liveCalendar).getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(within(liveCalendar).getByRole("button", { name: "Next month" })).toBeInTheDocument();
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Next month" }));
    expect(within(calendarGrid).getByRole("button", { name: /Select Thursday, June 18/i })).toHaveClass("is-pulsing-selected");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: "Previous month" }));
    expect(within(calendarGrid).getByRole("button", { name: /Select Monday, May 18/i })).toHaveClass("is-pulsing-selected");
    const selectedDatePanel = within(liveCalendar).getByLabelText("Selected date events");
    expect(within(selectedDatePanel).getByRole("heading", { name: /Monday, May 18/i })).toBeInTheDocument();
    expect(within(selectedDatePanel).getByText("Youth Beginners")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Merchandise" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quick Stats" })).toBeInTheDocument();
  });

  it("keeps the manager dashboard visual frame even when a saved account is student mode", () => {
    renderLoggedInApp("/", "student");

    expect(screen.getByRole("heading", { name: "Welcome back, Manager!" })).toBeInTheDocument();
    expect(screen.getByLabelText("Manager navigation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cho's Operations home")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cho's Operations" })).not.toBeInTheDocument();
  });

  it("lets staff add a new student and creates a welcome text log", () => {
    renderLoggedInApp("/students");

    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });

    ["Student Information", "Parent/Guardian Information", "Emergency Contact Information", "Enrollment Details"].forEach((heading) => {
      expect(within(dialog).getByRole("heading", { name: heading })).toBeInTheDocument();
    });

    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Ava Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Date of Birth"), { target: { value: "2016-08-12" } });
    fireEvent.change(within(dialog).getByLabelText("Gender"), { target: { value: "Female" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "ava@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Name"), { target: { value: "Jamie Cho" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0199" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Email Address"), { target: { value: "jamie@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Contact Name"), { target: { value: "Taylor Kim" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Relationship"), { target: { value: "Aunt" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Phone Number"), { target: { value: "(262) 555-0120" } });
    fireEvent.change(within(dialog).getByLabelText("Emergency Email Address"), { target: { value: "taylor@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Enrollment Date"), { target: { value: "2026-05-14" } });
    fireEvent.change(within(dialog).getByLabelText("Program"), { target: { value: "Youth Foundations" } });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "Active" } });
    fireEvent.change(within(dialog).getByLabelText("Belt rank"), { target: { value: "White" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(screen.getByText("Ava Cho")).toBeInTheDocument();
    expect(screen.getAllByText("White").length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();
    expect(screen.getByText(/Welcome Ava to Cho's/i)).toBeInTheDocument();
    expect(screen.getByText(/facebook.com\/chosmenomoneefalls/i)).toBeInTheDocument();
  });

  it("keeps prototype state usable when localStorage writes fail", () => {
    renderLoggedInApp("/students");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded.", "QuotaExceededError");
    });

    try {
      fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
      const dialog = screen.getByRole("dialog", { name: "Create New Student" });
      fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Nora Kim" } });
      fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "nora@example.com" } });
      fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0177" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

      expect(screen.getByText("Nora Kim")).toBeInTheDocument();
      expect(screen.getByText(/Welcome Nora to Cho's/i)).toBeInTheDocument();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("shows a sortable student directory instead of opening the student editor by default", () => {
    renderLoggedInApp("/students");

    expect(screen.getByLabelText("Manager navigation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();
    const studentsHeader = screen.getByRole("heading", { name: "Students" }).closest(".operations-page-head");
    expect(studentsHeader).not.toBeNull();
    expect(within(studentsHeader as HTMLElement).getByRole("button", { name: "Create New Student" })).toHaveClass("student-header-add");
    expect(screen.getByRole("heading", { name: "Student Directory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create New Student" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create New Student" })).not.toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Student directory" });
    expect(table.closest(".student-directory-panel")).toHaveClass("student-directory-panel--compact");
    ["Name", "Age", "Gender", "Belt", "Tenure", "Classes"].forEach((label) => {
      expect(within(table).getByRole("button", { name: label })).toBeInTheDocument();
    });
    expect(within(table).getAllByRole("separator")).toHaveLength(5);
    expect(within(table).getByText("mason@example.com")).toHaveClass("student-directory-email");
    expect(within(table).getByRole("separator", { name: "Resize Name column" })).toHaveClass("student-column-resizer--polished");
    const nameColumn = within(table).getByTestId("student-column-name");
    expect(nameColumn).toHaveStyle({ width: "260px" });
    fireEvent.mouseDown(within(table).getByRole("separator", { name: "Resize Name column" }), { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 160 });
    fireEvent.mouseUp(window);
    expect(nameColumn).toHaveStyle({ width: "320px" });

    const names = () => within(table).getAllByTestId("student-table-name").map((item) => item.textContent);
    expect(names()).toEqual(["Mason Lee", "Mina Cho"]);

    fireEvent.click(within(table).getByRole("button", { name: "Classes" }));
    expect(names()).toEqual(["Mason Lee", "Mina Cho"]);

    fireEvent.click(within(table).getByRole("button", { name: "Classes" }));
    expect(names()).toEqual(["Mina Cho", "Mason Lee"]);

    fireEvent.click(within(table).getByRole("button", { name: /Edit Mina Cho/i }));

    expect(screen.getByRole("dialog", { name: "Edit Mina Cho" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit Mina Cho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Student" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toHaveValue("Mina Cho");
    expect(screen.getByLabelText("Belt rank")).toHaveValue("Green");

    fireEvent.change(screen.getByLabelText("Belt rank"), { target: { value: "Blue" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Student Changes" }));

    expect(screen.getByText("Blue")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit Mina Cho" })).not.toBeInTheDocument();
  });

  it("lets managers create a new student from the restored students page", () => {
    renderLoggedInApp("/students", "student");

    expect(screen.getByLabelText("Manager navigation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Student Directory" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Student Check-In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create New Student" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create New Student" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Student" });
    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Leo Park" } });
    fireEvent.change(within(dialog).getByLabelText("Student Email"), { target: { value: "leo@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Parent/Guardian Phone Number"), { target: { value: "(262) 555-0188" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Student" }));

    expect(screen.getByText("Leo Park")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("lets managers delete a selected student from the restored students page", () => {
    renderLoggedInApp("/students");

    expect(screen.getByText("Mina Cho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit Mina Cho/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Student" }));

    expect(screen.queryByText("Mina Cho")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit Mina Cho" })).not.toBeInTheDocument();
  });

  it("lets staff click the red sidebar edge line to cycle expanded, compact, and hidden navigation", () => {
    renderLoggedInApp("/students");

    const workspace = screen.getByLabelText("Manager workspace");
    const sidebarDivider = screen.getByRole("button", { name: "Toggle manager sidebar" });

    expect(screen.queryByRole("switch", { name: "Manager sidebar size" })).not.toBeInTheDocument();
    expect(sidebarDivider).toHaveClass("manager-sidebar-edge-toggle");
    expect(sidebarDivider).toHaveAttribute("aria-pressed", "false");
    expect(workspace).not.toHaveClass("manager-dashboard--compact");
    expect(workspace).not.toHaveClass("manager-dashboard--hidden");
    expect(screen.getByLabelText("Manager navigation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();

    fireEvent.click(sidebarDivider);

    expect(sidebarDivider).toHaveAttribute("aria-pressed", "mixed");
    expect(workspace).toHaveClass("manager-dashboard--compact");
    expect(workspace).not.toHaveClass("manager-dashboard--hidden");
    expect(screen.getByLabelText("Manager navigation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Operations navigation")).not.toBeInTheDocument();

    fireEvent.click(sidebarDivider);

    expect(sidebarDivider).toHaveAttribute("aria-pressed", "true");
    expect(workspace).toHaveClass("manager-dashboard--hidden");
    expect(workspace).not.toHaveClass("manager-dashboard--compact");
    expect(screen.getByLabelText("Manager navigation")).toBeInTheDocument();

    fireEvent.click(sidebarDivider);

    expect(sidebarDivider).toHaveAttribute("aria-pressed", "false");
    expect(workspace).not.toHaveClass("manager-dashboard--compact");
    expect(workspace).not.toHaveClass("manager-dashboard--hidden");
  });

  it("lets staff create schedule items and studio events", () => {
    renderLoggedInApp("/schedule");

    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Youth Testing Prep" } });
    fireEvent.change(screen.getByLabelText("Schedule date"), { target: { value: "2026-05-22" } });
    fireEvent.change(screen.getByLabelText("Schedule time"), { target: { value: "5:30 PM" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Youth Testing Prep")).toBeInTheDocument();
    expect(screen.getByText("2026-05-22 at 5:30 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Events/i }));
    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Black Belt Testing" } });
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("Event time"), { target: { value: "6:00 PM" } });
    fireEvent.change(screen.getByLabelText("Event details"), { target: { value: "Testing date for eligible students." } });
    fireEvent.click(screen.getByRole("button", { name: "Add Event" }));

    expect(screen.getByText("Black Belt Testing")).toBeInTheDocument();
    expect(screen.getByText(/Testing date for eligible students/i)).toBeInTheDocument();
  });

  it("lets staff make a schedule item recurring so it repeats on the dashboard calendar", () => {
    renderLoggedInApp("/schedule");

    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Friday Demo Class" } });
    fireEvent.change(screen.getByLabelText("Schedule date"), { target: { value: "2026-05-15" } });
    fireEvent.change(screen.getByLabelText("Schedule time"), { target: { value: "6:15 PM" } });
    fireEvent.click(screen.getByLabelText("Recurring"));
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: /Select Friday, May 29/i }));
    const selectedDatePanel = within(liveCalendar).getByLabelText("Selected date events");
    expect(within(selectedDatePanel).getByText("Friday Demo Class")).toBeInTheDocument();
    expect(within(selectedDatePanel).getByText(/6:15 PM · Class · recurring/i)).toBeInTheDocument();
  });

  it("lets staff set a custom title color for schedule items and calendar entries", () => {
    renderLoggedInApp("/schedule");

    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Blue Team Class" } });
    fireEvent.change(screen.getByLabelText("Schedule date"), { target: { value: "2026-05-29" } });
    fireEvent.change(screen.getByLabelText("Schedule time"), { target: { value: "7:00 PM" } });
    fireEvent.change(screen.getByLabelText("Title color"), { target: { value: "#7dd3fc" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Blue Team Class")).toHaveStyle({ color: "#7dd3fc" });

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    const liveCalendar = screen.getByLabelText("Live studio calendar");
    fireEvent.click(within(liveCalendar).getByRole("button", { name: /Select Friday, May 29/i }));
    const selectedDatePanel = within(liveCalendar).getByLabelText("Selected date events");

    expect(within(selectedDatePanel).getByText("Blue Team Class")).toHaveStyle({ color: "#7dd3fc" });
  });

  it("lets staff create a custom schedule type and reuse it from the dropdown", () => {
    renderLoggedInApp("/schedule");

    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Demo Team Practice" } });
    fireEvent.change(screen.getByLabelText("Schedule date"), { target: { value: "2026-05-24" } });
    fireEvent.change(screen.getByLabelText("Schedule time"), { target: { value: "4:15 PM" } });
    fireEvent.change(screen.getByLabelText("Schedule type"), { target: { value: "custom" } });
    const customTypeDialog = screen.getByRole("dialog", { name: "Create schedule type" });
    expect(within(customTypeDialog).getByText("Name the new schedule type.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Custom schedule type")).not.toBeInTheDocument();

    fireEvent.change(within(customTypeDialog).getByLabelText("New schedule type name"), { target: { value: "Demo Team" } });
    fireEvent.click(within(customTypeDialog).getByRole("button", { name: "Submit" }));

    const scheduleType = screen.getByLabelText("Schedule type");
    expect(scheduleType).toHaveValue("Demo Team");
    expect(within(scheduleType).getByRole("option", { name: "Demo Team" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Schedule Event" }));

    expect(screen.getByText("Demo Team Practice")).toBeInTheDocument();
    expect(screen.getAllByText("Demo Team").length).toBeGreaterThan(0);

    fireEvent.change(scheduleType, { target: { value: "Demo Team" } });
    expect(scheduleType).toHaveValue("Demo Team");
  });

  it("lets managers create, edit, and remove recurring classes", () => {
    renderLoggedInApp("/classes");

    expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Class" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Youth Sparring" } });
    fireEvent.click(screen.getByLabelText("Monday"));
    fireEvent.click(screen.getByLabelText("Wednesday"));
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "17:15" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("Class notes"), { target: { value: "Pads, footwork, and controlled sparring." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Youth Sparring")).toBeInTheDocument();
    expect(screen.getByText("Monday, Wednesday")).toBeInTheDocument();
    expect(screen.getByText("5:15 PM - 6:00 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Youth Sparring/i }));
    expect(screen.getByRole("heading", { name: "Edit Youth Sparring" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Advanced Sparring" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Class Changes" }));

    expect(screen.getByText("Advanced Sparring")).toBeInTheDocument();
    expect(screen.getByText("5:15 PM - 6:30 PM")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Advanced Sparring/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Class" }));

    expect(screen.queryByText("Advanced Sparring")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Class" })).toBeInTheDocument();
  });

  it("adds recurring classes from the Classes tab into the dashboard calendar", () => {
    renderLoggedInApp("/classes");

    const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Tiny Tigers" } });
    fireEvent.click(screen.getByLabelText(todayWeekday));
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "16:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "16:45" } });
    expect(screen.getByLabelText("Recurring")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Create Class" }));

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    const selectedDatePanel = within(screen.getByLabelText("Live studio calendar")).getByLabelText("Selected date events");
    expect(within(selectedDatePanel).getByText("Tiny Tigers")).toBeInTheDocument();
    expect(within(selectedDatePanel).getByText(/4:00 PM - 4:45 PM/)).toBeInTheDocument();
  });

  it("lets managers choose class title color and disable class calendar recurrence", () => {
    renderLoggedInApp("/classes");

    const todayWeekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "Drop In Clinic" } });
    fireEvent.click(screen.getByLabelText(todayWeekday));
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "15:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "15:45" } });
    fireEvent.change(screen.getByLabelText("Title color"), { target: { value: "#f9a8d4" } });
    fireEvent.click(screen.getByLabelText("Recurring"));
    fireEvent.click(screen.getByRole("button", { name: "Create Class" }));

    expect(screen.getByText("Drop In Clinic")).toHaveStyle({ color: "#f9a8d4" });
    expect(screen.getByText("Not recurring on calendar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    const selectedDatePanel = within(screen.getByLabelText("Live studio calendar")).getByLabelText("Selected date events");
    expect(within(selectedDatePanel).queryByText("Drop In Clinic")).not.toBeInTheDocument();
  });

  it("lets students check in and see rank progress", () => {
    renderLoggedInApp("/check-ins", "student");

    expect(screen.getByRole("heading", { name: "Student Check-In" })).toBeInTheDocument();
    expect(screen.getByText(/Current rank/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check In Today" }));

    expect(screen.getByText(/Checked in today/i)).toBeInTheDocument();
    expect(screen.getByText(/Classes attended/i)).toBeInTheDocument();
  });

  it("queues missed-class follow-up texts for students who missed three classes", () => {
    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Send Missed-Class Follow-Ups" }));

    expect(screen.getByText(/missed you in class/i)).toBeInTheDocument();
    expect(screen.getAllByText(/missed 3 classes/i).length).toBeGreaterThan(0);
  });

  it("sends a marketing blast for discounts and monthly specials", () => {
    renderLoggedInApp("/messages");

    fireEvent.change(screen.getByLabelText("Marketing message"), { target: { value: "May special: 10% off gloves this month." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Marketing Blast" }));

    expect(screen.getAllByText(/May special: 10% off gloves this month/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Marketing blast/i).length).toBeGreaterThan(0);
  });

  it("lets managers message users directly by clicking a name", () => {
    renderLoggedInApp("/messages");

    expect(screen.getByRole("heading", { name: "Direct Messenger" })).toBeInTheDocument();
    const peopleList = screen.getByLabelText("Message people");
    expect(peopleList.querySelector(".messenger-contact > span")).not.toBeInTheDocument();
    fireEvent.click(within(peopleList).getByRole("button", { name: /Open conversation with Mina Cho/i }));

    expect(screen.getByRole("heading", { name: "Mina Cho" })).toBeInTheDocument();
    const conversation = screen.getByLabelText("Conversation with Mina Cho");
    expect(conversation.querySelector(".messenger-avatar")).not.toBeInTheDocument();
    expect(within(conversation).getByText("Green belt")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Message Mina Cho"), { target: { value: "Hi Mina, please bring your sparring gloves tonight." } });
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    expect(within(conversation).getByText("Hi Mina, please bring your sparring gloves tonight.")).toBeInTheDocument();
    expect(within(conversation).getAllByText("Cho's Manager").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Message Mina Cho")).toHaveValue("");
  });

  it("lets managers find users by staff, students, and parents before messaging", () => {
    renderLoggedInApp("/messages");

    fireEvent.click(screen.getByRole("button", { name: "Find User" }));
    const finder = screen.getByRole("dialog", { name: "Find User" });

    expect(within(finder).getByRole("button", { name: "Staff" })).toBeInTheDocument();
    expect(within(finder).getByRole("button", { name: "Students" })).toBeInTheDocument();
    expect(within(finder).getByRole("button", { name: "Parents" })).toBeInTheDocument();

    fireEvent.click(within(finder).getByRole("button", { name: "Parents" }));
    fireEvent.change(within(finder).getByLabelText("Search users"), { target: { value: "Daniel" } });
    fireEvent.click(within(finder).getByRole("button", { name: /Open conversation with Daniel Cho/i }));

    expect(screen.queryByRole("dialog", { name: "Find User" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daniel Cho" })).toBeInTheDocument();
    expect(screen.getByLabelText("Conversation with Daniel Cho")).toBeInTheDocument();
    expect(screen.getByLabelText("Message Daniel Cho")).toBeInTheDocument();
  });

  it("lets staff add, edit, upload an image, and delete merchandise", async () => {
    renderLoggedInApp("/merchandise");

    expect(screen.queryByRole("dialog", { name: "Add New Merchandise" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add New Merchandise" }));
    const addDialog = screen.getByRole("dialog", { name: "Add New Merchandise" });

    fireEvent.change(within(addDialog).getByLabelText("Product name"), { target: { value: "Red Sparring Gloves" } });
    fireEvent.change(within(addDialog).getByLabelText("Category"), { target: { value: "Gloves" } });
    fireEvent.change(within(addDialog).getByLabelText("Price"), { target: { value: "49" } });
    fireEvent.change(within(addDialog).getByLabelText("Stock"), { target: { value: "8" } });
    fireEvent.change(within(addDialog).getByLabelText("Description"), { target: { value: "Competition gloves for sparring days." } });
    fireEvent.change(within(addDialog).getByLabelText("Product image"), {
      target: { files: [new File(["glove-image"], "gloves.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(within(addDialog).getByAltText("Uploaded merchandise preview")).toHaveAttribute("src", expect.stringContaining("data:image/png")));
    fireEvent.click(within(addDialog).getByRole("button", { name: "Create Merchandise" }));

    expect(screen.getByText("Red Sparring Gloves")).toBeInTheDocument();
    expect(screen.getByText("$49.00")).toBeInTheDocument();
    expect(screen.getByText("8 in stock")).toBeInTheDocument();
    expect(screen.getByAltText("Red Sparring Gloves")).toHaveAttribute("src", expect.stringContaining("data:image/png"));

    fireEvent.click(screen.getByRole("button", { name: "Edit Red Sparring Gloves" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit Red Sparring Gloves" });
    fireEvent.change(within(editDialog).getByLabelText("Stock"), { target: { value: "12" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save Merchandise Changes" }));

    expect(screen.getByText("12 in stock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Red Sparring Gloves" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Merchandise" }));

    expect(screen.queryByText("Red Sparring Gloves")).not.toBeInTheDocument();
  });
});
