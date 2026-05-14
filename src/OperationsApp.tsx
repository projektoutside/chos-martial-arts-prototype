import {
  Award,
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Globe,
  Grid2X2,
  LifeBuoy,
  Mail,
  MessageCircle,
  MessagesSquare,
  Package,
  Phone,
  Plus,
  Settings,
  Shirt,
  ShoppingCart,
  Search,
  Target,
  Trash2,
  User,
  UserCircle,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent as ReactChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router";
import { useAppState } from "./state";
import type { ClassWeekday, DirectMessage, MerchandiseItem, MessageLog, ScheduledClass, StudioClass, StudentRecord, StudioEvent } from "./types";
import { formatMoney } from "./utils";

const beltOptions = ["White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Red", "Black"];
const weekdayOptions: { value: ClassWeekday; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" }
];
const defaultScheduleTypeOptions = [
  { value: "class", label: "Class" },
  { value: "private-lesson", label: "Private lesson" },
  { value: "testing-prep", label: "Testing prep" }
];

const managerNavItems = [
  { path: "/", label: "Dashboard", icon: Grid2X2 },
  { path: "/messages", label: "Messages", icon: MessageCircle },
  { path: "/students", label: "Students", icon: User },
  { path: "/classes", label: "Classes", icon: Award },
  { path: "/schedule", label: "Scheduling", icon: CalendarDays },
  { path: "/events", label: "Events", icon: CalendarCheck },
  { path: "/merchandise", label: "Merchandise", icon: Shirt },
  { path: "/", label: "Reports", icon: BarChart3 },
  { path: "/", label: "Settings", icon: Settings }
];

const managerQuickActions = [
  {
    title: "Create New Student",
    text: "Add a new student to the database.",
    button: "Create",
    path: "/students",
    icon: UserPlus
  },
  {
    title: "Edit Student",
    text: "Update student information.",
    button: "Edit",
    path: "/students",
    icon: Edit3
  },
  {
    title: "Delete Student",
    text: "Remove a student from the database.",
    button: "Delete",
    path: "/students",
    icon: Trash2
  },
  {
    title: "Edit Scheduling",
    text: "Manage class schedules, holidays, and events.",
    button: "Manage",
    path: "/schedule",
    icon: CalendarDays
  }
];

const managerEvents = [
  { title: "Testing Day", date: "Saturday, June 15, 2024", time: "9:00 AM - 12:00 PM", tone: "uniform" },
  { title: "Movie Night", date: "Friday, June 28, 2024", time: "6:00 PM - 9:00 PM", tone: "movie" },
  { title: "Summer Camp", date: "July 8 - July 12, 2024", time: "9:00 AM - 3:00 PM", tone: "camp" },
  { title: "Independence Day", date: "Thursday, July 4, 2024", time: "All Day (School Closed)", tone: "flag" }
];

const managerMerchandise = [
  { name: "Karate Uniform", price: "$49.99", tone: "uniform" },
  { name: "Sparring Gloves", price: "$29.99", tone: "gloves" },
  { name: "Shin Guards", price: "$24.99", tone: "guards" },
  { name: "Head Gear", price: "$39.99", tone: "headgear" },
  { name: "Martial Arts Bag", price: "$34.99", tone: "bag" },
  { name: "Mouth Guard", price: "$9.99", tone: "mouthguard" }
];

type ManagerSidebarMode = "expanded" | "compact" | "hidden";

const managerSidebarStorageKey = "chos.managerSidebar.mode.v1";
const legacyManagerSidebarStorageKey = "chos.managerSidebar.v1";
const managerSidebarModeOrder: ManagerSidebarMode[] = ["expanded", "compact", "hidden"];

interface ManagerSidebarContextValue {
  mode: ManagerSidebarMode;
  compact: boolean;
  hidden: boolean;
  toggleSidebarMode: () => void;
}

const ManagerSidebarContext = createContext<ManagerSidebarContextValue | null>(null);

function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

function readManagerSidebarPreference() {
  if (typeof window === "undefined") return "expanded";
  try {
    const storedMode = window.localStorage.getItem(managerSidebarStorageKey);
    if (storedMode === "expanded" || storedMode === "compact" || storedMode === "hidden") return storedMode;
    return window.localStorage.getItem(legacyManagerSidebarStorageKey) === "compact" ? "compact" : "expanded";
  } catch {
    return "expanded";
  }
}

function ManagerSidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ManagerSidebarMode>(readManagerSidebarPreference);
  const toggleSidebarMode = useCallback(() => {
    setMode((current) => {
      const currentIndex = managerSidebarModeOrder.indexOf(current);
      const next = managerSidebarModeOrder[(currentIndex + 1) % managerSidebarModeOrder.length];
      try {
        window.localStorage.setItem(managerSidebarStorageKey, next);
      } catch {
        // Local storage can be unavailable in private browser contexts.
      }
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({
      mode,
      compact: mode === "compact",
      hidden: mode === "hidden",
      toggleSidebarMode
    }),
    [mode, toggleSidebarMode]
  );

  return <ManagerSidebarContext.Provider value={value}>{children}</ManagerSidebarContext.Provider>;
}

function useManagerSidebar() {
  return useContext(ManagerSidebarContext) ?? { mode: "expanded", compact: false, hidden: false, toggleSidebarMode: () => undefined };
}

function fullName(student: StudentRecord) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function formatClockTime(time: string) {
  const [hours = "0", minutes = "00"] = time.split(":");
  const date = new Date(2026, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatClassTimeRange(studioClass: Pick<StudioClass, "startTime" | "endTime">) {
  return `${formatClockTime(studioClass.startTime)} - ${formatClockTime(studioClass.endTime)}`;
}

function formatClassDays(daysOfWeek: ClassWeekday[]) {
  return daysOfWeek
    .map((day) => weekdayOptions.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ");
}

function scheduleTypeLabel(type: string) {
  return defaultScheduleTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function messageKindLabel(kind: MessageLog["kind"]) {
  if (kind === "follow-up") return "Missed-class follow-up";
  if (kind === "marketing") return "Marketing blast";
  if (kind === "welcome") return "Welcome text";
  return "Class reminder";
}

function ManagerSidebar() {
  const { mode, compact, hidden, toggleSidebarMode } = useManagerSidebar();

  return (
    <aside className={`manager-sidebar ${compact ? "is-compact" : ""}${hidden ? " is-hidden" : ""}`}>
      <Link className="manager-logo" to="/" aria-label="Cho's manager dashboard home">
        <img src={publicAsset("682e95109aa21_chos-logo.png")} alt="Cho's Martial Arts" />
      </Link>

      <button
        className="manager-sidebar-edge-toggle"
        type="button"
        aria-label="Toggle manager sidebar"
        aria-pressed={mode === "hidden" ? "true" : mode === "compact" ? "mixed" : "false"}
        title={`Sidebar is ${mode}. Click to switch view.`}
        onClick={toggleSidebarMode}
      ></button>

      <nav className="manager-nav" aria-label="Manager navigation">
        {managerNavItems.map((item) => {
          const Icon = item.icon;
          if (item.path === "/" && item.label !== "Dashboard") {
            return (
              <Link className="manager-nav-link" key={`${item.label}-${item.path}`} to={item.path} title={item.label}>
                <Icon size={23} />
                <span>{item.label}</span>
              </Link>
            );
          }

          return (
            <NavLink key={`${item.label}-${item.path}`} to={item.path} end={item.path === "/"} title={item.label}>
              <Icon size={23} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="manager-sidebar-lower">
        <p className="manager-motto">
          <span>Building <strong>confidence.</strong></span>
          <span>Strengthening <strong>minds.</strong></span>
          <span>Transforming <strong>lives.</strong></span>
        </p>
        <img className="manager-fighter" src={publicAsset("Perfect1.png")} alt="" aria-hidden="true" />
        <Link className="manager-help" to="/messages">
          <LifeBuoy size={34} />
          <span>
            <strong>Need Help?</strong>
            <small>Contact Support</small>
          </span>
        </Link>
      </div>
    </aside>
  );
}

function OperationsShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAppState();
  const location = useLocation();

  return (
    <ManagerSidebarProvider>
      <StaffOperationsShell sessionEmail={session?.email} logout={logout} path={location.pathname}>
        {children}
      </StaffOperationsShell>
    </ManagerSidebarProvider>
  );
}

function StaffOperationsShell({
  children,
  sessionEmail,
  logout,
  path
}: {
  children: ReactNode;
  sessionEmail?: string;
  logout: () => void;
  path: string;
}) {
  const { compact, hidden } = useManagerSidebar();
  const dashboardClassName = `manager-dashboard${compact ? " manager-dashboard--compact" : ""}${hidden ? " manager-dashboard--hidden" : ""}`;

  if (path === "/") {
    return <div className="manager-shell">{children}</div>;
  }

  return (
    <div className="manager-shell">
      <section className={`${dashboardClassName} manager-subpage-shell`} aria-label="Manager workspace">
        <ManagerSidebar />
        <main className="manager-main manager-subpage-main">
          <header className="manager-subpage-topbar">
            <span>{sessionEmail ?? "team@chos.prototype"}</span>
            <button type="button" onClick={logout}>Log out</button>
          </header>
          {children}
        </main>
      </section>
    </div>
  );
}

function OperationsPage({ title, text, action, children }: { title: string; text: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="operations-page">
      <div className="operations-page-head">
        <div>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <article className="operation-stat-card">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

type ManagerCalendarEntry = {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "class" | "event";
  meta: string;
  path: string;
  titleColor?: string;
};

type ManagerCalendarView = "day" | "week" | "month";

const managerCalendarViewOptions: { value: ManagerCalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" }
];

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function weekDaysForDate(date: Date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
}

function shiftCalendarMonth(date: Date, direction: number) {
  const dayOfMonth = date.getDate();
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + direction);
  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return next;
}

function shiftCalendarPeriod(date: Date, view: ManagerCalendarView, direction: number) {
  if (view === "month") return shiftCalendarMonth(date, direction);
  const next = new Date(date);
  next.setDate(date.getDate() + direction * (view === "week" ? 7 : 1));
  return next;
}

function formatWeekRange(weekDays: Date[]) {
  const [firstDay] = weekDays;
  const lastDay = weekDays[weekDays.length - 1];
  const sameMonth = firstDay.getMonth() === lastDay.getMonth() && firstDay.getFullYear() === lastDay.getFullYear();
  const firstLabel = firstDay.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const lastLabel = lastDay.toLocaleDateString("en-US", sameMonth ? { day: "numeric", year: "numeric" } : { month: "long", day: "numeric", year: "numeric" });
  return `${firstLabel} - ${lastLabel}`;
}

function compareCalendarEntries(a: ManagerCalendarEntry, b: ManagerCalendarEntry) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function scheduledClassCalendarEntries(item: ScheduledClass, calendarDays: Date[]): ManagerCalendarEntry[] {
  const label = scheduleTypeLabel(item.type);
  const createEntry = (date: string, id = item.id, meta = label): ManagerCalendarEntry => ({
    id,
    title: item.title,
    date,
    time: item.time,
    kind: "class",
    meta,
    path: "/schedule",
    titleColor: item.titleColor
  });

  if (!item.recurring) {
    return [createEntry(item.date)];
  }

  const startDate = parseCalendarDate(item.date);
  const startDateKey = toDateKey(startDate);
  const startWeekday = startDate.getDay();
  return calendarDays
    .filter((day) => day.getDay() === startWeekday && toDateKey(day) >= startDateKey)
    .map((day) => {
      const dateKey = toDateKey(day);
      return createEntry(dateKey, `${item.id}-${dateKey}`, `${label} · recurring`);
    });
}

function useLiveCalendarDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

function ManagerLiveCalendar({ scheduledClasses, studioClasses, studioEvents }: { scheduledClasses: ScheduledClass[]; studioClasses: StudioClass[]; studioEvents: StudioEvent[] }) {
  const now = useLiveCalendarDate();
  const todayKey = toDateKey(now);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [calendarView, setCalendarView] = useState<ManagerCalendarView>("month");
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const currentYear = visibleMonthDate.getFullYear();
  const currentMonth = visibleMonthDate.getMonth();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const calendarDays = useMemo(() => {
    const gridStart = new Date(currentYear, currentMonth, 1 - monthStart.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [currentMonth, currentYear, monthStart]);
  const entries = useMemo<ManagerCalendarEntry[]>(
    () => [
      ...studioClasses.flatMap((studioClass) =>
        studioClass.recurring === false
          ? []
          : calendarDays
              .filter((day) => studioClass.daysOfWeek.includes(day.getDay() as ClassWeekday))
              .map((day) => ({
                id: `${studioClass.id}-${toDateKey(day)}`,
                title: studioClass.name,
                date: toDateKey(day),
                time: formatClassTimeRange(studioClass),
                kind: "class" as const,
                meta: "recurring class",
                path: "/classes",
                titleColor: studioClass.titleColor
              }))
      ),
      ...scheduledClasses.flatMap((item) => scheduledClassCalendarEntries(item, calendarDays)),
      ...studioEvents.map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        kind: "event" as const,
        meta: event.audience,
        path: "/events"
      }))
    ].sort(compareCalendarEntries),
    [calendarDays, scheduledClasses, studioClasses, studioEvents]
  );
  const entriesByDate = useMemo(
    () => entries.reduce<Record<string, ManagerCalendarEntry[]>>((groups, entry) => {
      groups[entry.date] = [...(groups[entry.date] ?? []), entry];
      return groups;
    }, {}),
    [entries]
  );
  const selectedEntries = entriesByDate[selectedDateKey] ?? [];
  const selectedDate = parseCalendarDate(selectedDateKey);
  const selectedWeekDays = useMemo(() => weekDaysForDate(selectedDate), [selectedDateKey]);
  const visibleCalendarDays = calendarView === "month" ? calendarDays : calendarView === "week" ? selectedWeekDays : [selectedDate];
  const visibleWeekdayLabels = calendarView === "day" ? [selectedDate.toLocaleDateString("en-US", { weekday: "short" })] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const calendarViewLabel =
    calendarView === "month"
      ? monthLabel
      : calendarView === "week"
        ? `Week of ${selectedWeekDays[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const periodLabel =
    calendarView === "month"
      ? monthLabel
      : calendarView === "week"
        ? formatWeekRange(selectedWeekDays)
        : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const selectCalendarDate = (date: Date) => {
    setSelectedDateKey(toDateKey(date));
    setVisibleMonthDate(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const shiftVisiblePeriod = (direction: number) => {
    selectCalendarDate(shiftCalendarPeriod(selectedDate, calendarView, direction));
  };

  useEffect(() => {
    const todayDate = parseCalendarDate(todayKey);
    setSelectedDateKey(todayKey);
    setVisibleMonthDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  }, [todayKey]);

  return (
    <section className="manager-calendar-panel" aria-label="Live studio calendar">
      <header className="manager-calendar-head">
        <div>
          <CalendarDays size={34} />
          <div>
            <h2>{monthLabel}</h2>
            <p>Live studio calendar · updates from today&apos;s date</p>
          </div>
        </div>
        <div className="manager-calendar-view-switch" role="group" aria-label="Calendar view">
          {managerCalendarViewOptions.map((option) => (
            <button
              aria-pressed={calendarView === option.value}
              key={option.value}
              onClick={() => setCalendarView(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <Link to="/schedule">Manage Schedule</Link>
      </header>
      <div className="manager-calendar-body">
        <div className="manager-calendar-period-nav" role="group" aria-label="Calendar period navigation">
          <button aria-label={`Previous ${calendarView}`} onClick={() => shiftVisiblePeriod(-1)} type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{periodLabel}</strong>
          <button aria-label={`Next ${calendarView}`} onClick={() => shiftVisiblePeriod(1)} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
        <div className={`manager-calendar-grid manager-calendar-grid--${calendarView}`} role="grid" aria-label={`${calendarViewLabel} Cho's studio calendar`}>
          {visibleWeekdayLabels.map((dayName) => (
            <span className="manager-calendar-weekday" key={dayName}>{dayName}</span>
          ))}
          {visibleCalendarDays.map((day) => {
            const dateKey = toDateKey(day);
            const dayEntries = entriesByDate[dateKey] ?? [];
            const isToday = dateKey === todayKey;
            const isOutsideMonth = day.getMonth() !== currentMonth;
            const isSelected = dateKey === selectedDateKey;
            return (
              <button
                type="button"
                className={`manager-calendar-day${isToday ? " is-today is-glowing-today is-transparent-today" : ""}${isOutsideMonth ? " is-muted" : ""}${isSelected ? " is-selected is-pulsing-selected" : ""}${dayEntries.length ? " has-items" : ""}`}
                key={dateKey}
                onClick={() => selectCalendarDate(day)}
                aria-pressed={isSelected}
                aria-label={`Select ${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}${dayEntries.length ? `, ${dayEntries.length} calendar item${dayEntries.length === 1 ? "" : "s"}` : ", no calendar items"}`}
              >
                <span>{day.getDate()}</span>
                <div>
                  {dayEntries.slice(0, 3).map((entry) => (
                    <span className={`manager-calendar-entry ${entry.kind}`} key={entry.id} style={entry.titleColor ? { color: entry.titleColor } : undefined}>
                      {entry.title}
                    </span>
                  ))}
                  {dayEntries.length > 3 && <small>+{dayEntries.length - 3} more</small>}
                </div>
              </button>
            );
          })}
        </div>
        <section className="manager-calendar-selected-panel" aria-label="Selected date events" aria-live="polite">
          <header>
            <div>
              <h3>{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
              <p>{selectedDateKey === todayKey ? "Today" : "Selected date"}</p>
            </div>
            <span>{selectedEntries.length} item{selectedEntries.length === 1 ? "" : "s"}</span>
          </header>
          {selectedEntries.length ? (
            <div>
              {selectedEntries.map((entry) => (
                <Link className="manager-calendar-selected-item" key={entry.id} to={entry.path}>
                  <span>{entry.kind}</span>
                  <div>
                    <strong style={entry.titleColor ? { color: entry.titleColor } : undefined}>{entry.title}</strong>
                    <small>{entry.time} · {entry.meta}</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p>No classes or events scheduled for this date.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function DashboardPage() {
  const {
    students,
    studioClasses,
    scheduledClasses,
    messageLogs,
    studioEvents,
    merchandiseItems,
    sendMissedClassFollowUps,
    showToast
  } = useAppState();
  const navigate = useNavigate();
  const { compact, hidden } = useManagerSidebar();
  const queueReminderText = () => {
    showToast("Reminder text workflow is ready in Messages.");
    navigate("/messages");
  };

  const queueFollowUps = () => {
    const count = sendMissedClassFollowUps();
    showToast(count ? `${count} missed-class follow-up text${count === 1 ? "" : "s"} queued.` : "No students currently need missed-class follow-up texts.");
  };

  const quickStats = [
    { label: "Active Students", value: Math.max(142, students.length), link: "View All", path: "/students", icon: Users },
    { label: "Classes This Week", value: Math.max(18, scheduledClasses.length + studioClasses.length), link: "View Classes", path: "/classes", icon: CalendarDays },
    { label: "Messages Sent", value: Math.max(27, messageLogs.length), link: "View Messages", path: "/messages", icon: MessagesSquare },
    { label: "Products Listed", value: Math.max(36, merchandiseItems.length), link: "View Products", path: "/merchandise", icon: ShoppingCart }
  ];

  return (
    <section className={`manager-dashboard${compact ? " manager-dashboard--compact" : ""}${hidden ? " manager-dashboard--hidden" : ""}`} aria-label="Manager dashboard">
      <ManagerSidebar />

      <main className="manager-main">
        <header className="manager-topbar">
          <div>
            <h1>Welcome back, Manager!</h1>
            <p>Here&apos;s an overview of Cho&apos;s Martial Arts.</p>
          </div>
          <div className="manager-top-actions" aria-label="Manager alerts and account">
            <button type="button" aria-label="Message notifications">
              <MessageCircle size={27} />
              <span>3</span>
            </button>
            <button type="button" aria-label="Reminder notifications">
              <Bell size={27} />
              <span>5</span>
            </button>
            <button className="manager-profile" type="button" aria-label="Manager profile">
              <UserCircle size={50} />
              <strong>Manager</strong>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <ManagerLiveCalendar scheduledClasses={scheduledClasses} studioClasses={studioClasses} studioEvents={studioEvents} />

        <section className="manager-action-grid" aria-label="Manager quick actions">
          {managerQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <article className="manager-action-card" key={action.title}>
                <span>
                  <Icon size={44} />
                </span>
                <h2>{action.title}</h2>
                <p>{action.text}</p>
                <Link to={action.path}>{action.button}</Link>
              </article>
            );
          })}
        </section>

        <section className="manager-communication">
          <div className="manager-panel-title">
            <Users size={31} />
            <h2>Student Management &amp; Communication</h2>
          </div>
          <div className="manager-communication-grid">
            <article>
              <div className="manager-round-icon database-icon">
                <span />
              </div>
              <div>
                <h3>Input New Students</h3>
                <p>Add new students into the database quickly and easily.</p>
                <button type="button" onClick={() => navigate("/students")}>Add Student</button>
              </div>
            </article>
            <article>
              <div className="manager-round-icon phone-icon">
                <Phone size={42} />
              </div>
              <div>
                <h3>Send Reminder Texts</h3>
                <p>Send class reminders, testing reminders, and important updates.</p>
                <button type="button" onClick={queueReminderText}>Send Reminder</button>
              </div>
            </article>
            <article>
              <div className="manager-round-icon chat-icon">
                <MessagesSquare size={42} />
              </div>
              <div>
                <h3>Follow Up Texts</h3>
                <p>Send follow up texts with welcoming messages, social media links, and website.</p>
                <button type="button" onClick={queueFollowUps}>Send Follow Up</button>
              </div>
            </article>
          </div>
          <div className="manager-welcome-strip">
            <div>
              <h3>Welcome Message Includes:</h3>
              <p><CheckCircle2 size={16} /> Welcome to Cho&apos;s Martial Arts!</p>
              <p><CheckCircle2 size={16} /> Class information &amp; what to expect</p>
            </div>
            <div>
              <p><CheckCircle2 size={16} /> Social Media Links</p>
              <div className="manager-socials" aria-label="Social media links">
                <span>f</span>
                <span>ig</span>
                <span>tk</span>
                <span>yt</span>
              </div>
            </div>
            <div>
              <p><Globe size={16} /> Website Link</p>
              <a href="https://www.chosmartialarts.com">www.chosmartialarts.com</a>
            </div>
          </div>
        </section>

        <div className="manager-lower-grid">
          <section className="manager-card-panel">
            <header>
              <div>
                <CalendarCheck size={28} />
                <h2>Events</h2>
              </div>
              <Link to="/events">View All</Link>
            </header>
            <div className="manager-event-list">
              {managerEvents.map((event) => (
                <article key={event.title}>
                  <span className={`manager-event-thumb ${event.tone}`} aria-hidden="true" />
                  <div>
                    <h3>{event.title}</h3>
                    <p>{event.date}</p>
                    <p>{event.time}</p>
                  </div>
                  <Link to="/events" aria-label={`Edit ${event.title}`}>
                    <CalendarCheck size={21} />
                  </Link>
                </article>
              ))}
            </div>
            <button type="button" onClick={() => navigate("/events")}>
              <Plus size={18} /> Add New Event
            </button>
          </section>

          <section className="manager-card-panel manager-merch-panel">
            <header>
              <div>
                <ShoppingCart size={29} />
                <h2>Merchandise</h2>
              </div>
              <Link to="/merchandise">View All</Link>
            </header>
            <p>Manage and showcase products we sell.</p>
            <div className="manager-product-grid">
              {managerMerchandise.map((item) => (
                <article key={item.name}>
                  <span className={`manager-product-thumb ${item.tone}`} aria-hidden="true" />
                  <h3>{item.name}</h3>
                  <strong>{item.price}</strong>
                </article>
              ))}
            </div>
            <button type="button" onClick={() => navigate("/merchandise")}>
              <Plus size={18} /> Add New Product
            </button>
          </section>
        </div>

        <section className="manager-quick-stats">
          <h2>Quick Stats</h2>
          <div>
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label}>
                  <Icon size={39} />
                  <div>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                    <Link to={stat.path}>{stat.link}</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <footer className="manager-footer">
          <span />
          <strong>Cho&apos;s Martial Arts</strong>
          <span />
          <small>Respect · Discipline · Focus · Confidence</small>
        </footer>
      </main>
    </section>
  );
}

const genderOptions = ["Not specified", "Female", "Male", "Nonbinary", "Prefer not to say"];
const statusOptions = ["Active", "Trial", "Paused", "Inactive"];
type StudentSortKey = "name" | "age" | "gender" | "belt" | "tenure" | "classes";
type StudentSortDirection = "asc" | "desc";

const studentSortColumns: { key: StudentSortKey; label: string; defaultWidth: number; minWidth: number }[] = [
  { key: "name", label: "Name", defaultWidth: 260, minWidth: 170 },
  { key: "age", label: "Age", defaultWidth: 80, minWidth: 64 },
  { key: "gender", label: "Gender", defaultWidth: 116, minWidth: 86 },
  { key: "belt", label: "Belt", defaultWidth: 116, minWidth: 88 },
  { key: "tenure", label: "Tenure", defaultWidth: 126, minWidth: 92 },
  { key: "classes", label: "Classes", defaultWidth: 230, minWidth: 150 }
];

function defaultStudentColumnWidths() {
  return studentSortColumns.reduce<Record<StudentSortKey, number>>((widths, column) => {
    widths[column.key] = column.defaultWidth;
    return widths;
  }, {} as Record<StudentSortKey, number>);
}

function makeBlankStudentForm() {
  return {
    fullName: "",
    dateOfBirth: "",
    gender: "Not specified",
    studentEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",
    enrollmentDate: new Date().toISOString().slice(0, 10),
    program: "Youth Foundations",
    status: "Active",
    beltRank: "White",
    notes: ""
  };
}

function studentToForm(student: StudentRecord) {
  return {
    fullName: fullName(student),
    dateOfBirth: student.dateOfBirth ?? "",
    gender: student.gender ?? "Not specified",
    studentEmail: student.email,
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? student.phone,
    guardianEmail: student.guardianEmail ?? "",
    emergencyContactName: student.emergencyContactName ?? "",
    emergencyContactRelationship: student.emergencyContactRelationship ?? "",
    emergencyContactPhone: student.emergencyContactPhone ?? "",
    emergencyContactEmail: student.emergencyContactEmail ?? "",
    enrollmentDate: student.enrollmentDate ?? student.joinedAt,
    program: student.program ?? "Youth Foundations",
    status: student.status ?? "Active",
    beltRank: student.beltRank,
    notes: student.notes ?? ""
  };
}

function beltOrder(rank: string) {
  const index = beltOptions.findIndex((option) => option.toLowerCase() === rank.toLowerCase());
  return index === -1 ? beltOptions.length : index;
}

function parseStudentDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function studentAge(student: StudentRecord) {
  const birthDate = parseStudentDate(student.dateOfBirth);
  if (!birthDate) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed = today.getMonth() > birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function formatStudentAge(student: StudentRecord) {
  return studentAge(student)?.toString() ?? "Not set";
}

function studentTenureDays(student: StudentRecord) {
  const enrollmentDate = parseStudentDate(student.enrollmentDate ?? student.joinedAt);
  if (!enrollmentDate) return undefined;
  const days = Math.max(0, Math.floor((Date.now() - enrollmentDate.getTime()) / 86400000));
  return days;
}

function formatStudentTenure(student: StudentRecord) {
  const days = studentTenureDays(student);
  if (days === undefined) return "Not set";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return `${months} mo`;
  }
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months ? `${years} yr ${months} mo` : `${years} yr`;
}

function studentSortValue(student: StudentRecord, key: StudentSortKey) {
  if (key === "name") return fullName(student).toLowerCase();
  if (key === "age") return studentAge(student) ?? Number.POSITIVE_INFINITY;
  if (key === "gender") return student.gender?.toLowerCase() || "zzzz";
  if (key === "belt") return beltOrder(student.beltRank);
  if (key === "tenure") return studentTenureDays(student) ?? Number.POSITIVE_INFINITY;
  return student.classesAttended;
}

function compareStudentSortValue(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

function StudentsPage() {
  const { students, scheduledClasses, messageLogs, addOperationsStudent, updateOperationsStudent, deleteOperationsStudent, showToast } = useAppState();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const [form, setForm] = useState(makeBlankStudentForm);
  const [studentModalMode, setStudentModalMode] = useState<"create" | "edit" | null>(null);
  const [sortKey, setSortKey] = useState<StudentSortKey>("name");
  const [sortDirection, setSortDirection] = useState<StudentSortDirection>("asc");
  const [columnWidths, setColumnWidths] = useState(defaultStudentColumnWidths);
  const resizeState = useRef<{ key: StudentSortKey; startX: number; startWidth: number } | null>(null);
  const welcomeLogs = messageLogs.filter((message) => message.kind === "welcome");
  const classByStudent = useMemo(() => {
    const classByStudent = new Map<string, ScheduledClass>();
    scheduledClasses
      .filter((item) => item.studentId)
      .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))
      .forEach((item) => {
        if (item.studentId && !classByStudent.has(item.studentId)) {
          classByStudent.set(item.studentId, item);
        }
      });
    return classByStudent;
  }, [scheduledClasses]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((left, right) => {
      const result = compareStudentSortValue(studentSortValue(left, sortKey), studentSortValue(right, sortKey)) || fullName(left).localeCompare(fullName(right));
      return sortDirection === "asc" ? result : -result;
    });
  }, [sortDirection, sortKey, students]);

  const toggleSort = (key: StudentSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const startColumnResize = (key: StudentSortKey, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeState.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key]
    };
    document.body.classList.add("is-resizing-student-column");
  };

  const resizeColumnByKeyboard = (key: StudentSortKey, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const column = studentSortColumns.find((item) => item.key === key);
    const step = event.shiftKey ? 40 : 20;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setColumnWidths((current) => ({
      ...current,
      [key]: Math.max(column?.minWidth ?? 80, current[key] + step * direction)
    }));
  };

  useEffect(() => {
    const handleColumnResize = (event: MouseEvent) => {
      const resizing = resizeState.current;
      if (!resizing) return;
      const column = studentSortColumns.find((item) => item.key === resizing.key);
      const nextWidth = resizing.startWidth + event.clientX - resizing.startX;
      setColumnWidths((current) => ({
        ...current,
        [resizing.key]: Math.max(column?.minWidth ?? 80, nextWidth)
      }));
    };
    const stopColumnResize = () => {
      resizeState.current = null;
      document.body.classList.remove("is-resizing-student-column");
    };
    window.addEventListener("mousemove", handleColumnResize);
    window.addEventListener("mouseup", stopColumnResize);
    return () => {
      window.removeEventListener("mousemove", handleColumnResize);
      window.removeEventListener("mouseup", stopColumnResize);
      document.body.classList.remove("is-resizing-student-column");
    };
  }, []);

  const directoryTableWidth = studentSortColumns.reduce((total, column) => total + columnWidths[column.key], 0);

  const selectStudent = (student: StudentRecord) => {
    setSelectedStudentId(student.id);
    setForm(studentToForm(student));
    setStudentModalMode("edit");
  };

  const openCreateStudent = () => {
    setSelectedStudentId("");
    setForm(makeBlankStudentForm());
    setStudentModalMode("create");
  };

  const closeStudentModal = () => {
    setStudentModalMode(null);
    setSelectedStudentId("");
    setForm(makeBlankStudentForm());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selectedStudent) {
      const updated = updateOperationsStudent(selectedStudent.id, form);
      if (!updated) {
        showToast("Enter student name, phone, and email.");
        return;
      }
      setForm(studentToForm(updated));
      setStudentModalMode(null);
      showToast(`${fullName(updated)} updated.`);
      return;
    }

    const created = addOperationsStudent(form);
    if (!created) {
      showToast("Enter student name, phone, and email.");
      return;
    }
    closeStudentModal();
    showToast(`${fullName(created)} added with welcome text queued.`);
  };

  const deleteSelectedStudent = () => {
    if (!selectedStudent) return;
    const deleted = deleteOperationsStudent(selectedStudent.id);
    if (!deleted) {
      showToast("Select a student to delete.");
      return;
    }
    closeStudentModal();
    showToast(`${fullName(deleted)} deleted from the student list.`);
  };

  const headerAction = (
    <button type="button" className="operations-action student-header-add" onClick={openCreateStudent}>
      <Plus size={18} /> Create New Student
    </button>
  );
  const modalTitle = selectedStudent ? `Edit ${fullName(selectedStudent)}` : "Create New Student";

  return (
    <OperationsPage title="Students" text="Review every student in one manager directory, sort each category, and click a student name to edit." action={headerAction}>
      <div className="students-workspace students-workspace--directory">
        <section className="operations-panel student-roster-panel student-directory-panel student-directory-panel--compact">
          <div className="student-roster-head">
            <div>
              <h2>Student Directory</h2>
              <p>{students.length} student{students.length === 1 ? "" : "s"} listed with sortable manager categories.</p>
            </div>
          </div>
          <div className="student-directory-scroll">
            <table className="student-directory-table" aria-label="Student directory" style={{ minWidth: `${directoryTableWidth}px` }}>
              <colgroup>
                {studentSortColumns.map((column) => (
                  <col key={column.key} data-testid={`student-column-${column.key}`} style={{ width: `${columnWidths[column.key]}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {studentSortColumns.map((column, index) => (
                    <th key={column.key} aria-sort={sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <span aria-hidden="true">{sortKey === column.key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}</span>
                      </button>
                      {index < studentSortColumns.length - 1 && (
                        <button
                          aria-label={`Resize ${column.label} column`}
                          aria-orientation="vertical"
                          aria-valuemax={520}
                          aria-valuemin={column.minWidth}
                          aria-valuenow={columnWidths[column.key]}
                          className="student-column-resizer student-column-resizer--polished"
                          onKeyDown={(event) => resizeColumnByKeyboard(column.key, event)}
                          onMouseDown={(event) => startColumnResize(column.key, event)}
                          role="separator"
                          type="button"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <button type="button" className="student-name-action" aria-label={`Edit ${fullName(student)}`} onClick={() => selectStudent(student)}>
                        <span className="student-directory-name-wrap">
                          <span data-testid="student-table-name">{fullName(student)}</span>
                          <small className="student-directory-email">{student.email}</small>
                        </span>
                        <em>{student.status ?? "Active"}</em>
                      </button>
                    </td>
                    <td>{formatStudentAge(student)}</td>
                    <td>{student.gender ?? "Not set"}</td>
                    <td>
                      <span className="student-belt-pill">{student.beltRank}</span>
                    </td>
                    <td>{formatStudentTenure(student)}</td>
                    <td>
                      <strong>{student.classesAttended}</strong>
                      <small>{classByStudent.get(student.id)?.title ?? student.program ?? "No assigned class"}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="operations-panel student-welcome-panel">
          <h2>Welcome Text Queue</h2>
          {welcomeLogs.length ? welcomeLogs.map((message) => <MessagePreview key={message.id} message={message} />) : <p>No welcome texts queued yet.</p>}
        </section>
      </div>

      {studentModalMode && (
        <div className="modal-backdrop student-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeStudentModal()}>
          <form
            aria-labelledby="student-modal-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel student-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="student-modal-title">{modalTitle}</h2>
                <p>{selectedStudent ? "Update student records, contacts, enrollment, belt rank, and notes." : "Enter the full student profile before adding them to the directory."}</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close student form" onClick={closeStudentModal}>
                <X size={18} />
              </button>
            </div>

            <section className="student-form-section">
              <h3>Student Information</h3>
              <div className="student-form-grid">
                <label>
                  Full Name
                  <input autoFocus value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                </label>
                <label>
                  Date of Birth
                  <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
                </label>
                <label>
                  Gender
                  <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Student Email
                  <input inputMode="email" value={form.studentEmail} onChange={(event) => setForm({ ...form, studentEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Parent/Guardian Information</h3>
              <div className="student-form-grid">
                <label>
                  Parent/Guardian Name
                  <input value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} />
                </label>
                <label>
                  Phone Number
                  <input aria-label="Parent/Guardian Phone Number" value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} />
                </label>
                <label>
                  Email Address
                  <input aria-label="Parent/Guardian Email Address" inputMode="email" value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Emergency Contact Information</h3>
              <div className="student-form-grid">
                <label>
                  Contact Name
                  <input aria-label="Emergency Contact Name" value={form.emergencyContactName} onChange={(event) => setForm({ ...form, emergencyContactName: event.target.value })} />
                </label>
                <label>
                  Relationship
                  <input aria-label="Emergency Relationship" value={form.emergencyContactRelationship} onChange={(event) => setForm({ ...form, emergencyContactRelationship: event.target.value })} />
                </label>
                <label>
                  Phone Number
                  <input aria-label="Emergency Phone Number" value={form.emergencyContactPhone} onChange={(event) => setForm({ ...form, emergencyContactPhone: event.target.value })} />
                </label>
                <label>
                  Email Address
                  <input aria-label="Emergency Email Address" inputMode="email" value={form.emergencyContactEmail} onChange={(event) => setForm({ ...form, emergencyContactEmail: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="student-form-section">
              <h3>Enrollment Details</h3>
              <div className="student-form-grid">
                <label>
                  Enrollment Date
                  <input type="date" value={form.enrollmentDate} onChange={(event) => setForm({ ...form, enrollmentDate: event.target.value })} />
                </label>
                <label>
                  Program
                  <input value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Belt rank
                  <select value={form.beltRank} onChange={(event) => setForm({ ...form, beltRank: event.target.value })}>
                    {beltOptions.map((rank) => (
                      <option key={rank} value={rank}>{rank}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </section>

            <div className="student-editor-actions">
              <button type="submit">
                <Plus size={18} /> {selectedStudent ? "Save Student Changes" : "Create Student"}
              </button>
              {selectedStudent && (
                <button type="button" className="student-delete-action" onClick={deleteSelectedStudent}>
                  <Trash2 size={18} /> Delete Student
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

const blankClassForm = {
  name: "",
  daysOfWeek: [] as ClassWeekday[],
  startTime: "17:00",
  endTime: "17:45",
  recurring: true,
  titleColor: "#b8f5e2",
  notes: ""
};

function studioClassToForm(studioClass: StudioClass) {
  return {
    name: studioClass.name,
    daysOfWeek: studioClass.daysOfWeek,
    startTime: studioClass.startTime,
    endTime: studioClass.endTime,
    recurring: studioClass.recurring ?? true,
    titleColor: studioClass.titleColor ?? "#b8f5e2",
    notes: studioClass.notes ?? ""
  };
}

function ClassCard({ studioClass, onSelect }: { studioClass: StudioClass; onSelect: (studioClass: StudioClass) => void }) {
  return (
    <article className="operations-list-card class-list-card">
      <div>
        <strong style={studioClass.titleColor ? { color: studioClass.titleColor } : undefined}>{studioClass.name}</strong>
        <span>{formatClassDays(studioClass.daysOfWeek)}</span>
      </div>
      <p>{formatClassTimeRange(studioClass)}</p>
      <p>{studioClass.notes || "Recurring weekly class."}</p>
      <p>{studioClass.recurring === false ? "Not recurring on calendar" : "Repeats weekly on calendar"}</p>
      <button type="button" className="operations-action secondary" onClick={() => onSelect(studioClass)}>
        <Edit3 size={17} /> Edit {studioClass.name}
      </button>
    </article>
  );
}

function ClassesPage() {
  const { studioClasses, addStudioClass, updateStudioClass, deleteStudioClass, showToast } = useAppState();
  const [selectedClassId, setSelectedClassId] = useState("");
  const selectedClass = studioClasses.find((studioClass) => studioClass.id === selectedClassId);
  const [form, setForm] = useState(blankClassForm);

  const resetForm = () => {
    setSelectedClassId("");
    setForm(blankClassForm);
  };

  const selectClass = (studioClass: StudioClass) => {
    setSelectedClassId(studioClass.id);
    setForm(studioClassToForm(studioClass));
  };

  const toggleDay = (day: ClassWeekday) => {
    setForm((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((item) => item !== day)
        : [...current.daysOfWeek, day].sort((left, right) => left - right) as ClassWeekday[]
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const savedClass = selectedClass
      ? updateStudioClass(selectedClass.id, form)
      : addStudioClass(form);
    if (!savedClass) {
      showToast("Enter a class name, at least one day, and a valid start/end time.");
      return;
    }
    setSelectedClassId(savedClass.id);
    setForm(studioClassToForm(savedClass));
    showToast(`${savedClass.name} saved to Classes and added to the calendar.`);
  };

  const removeSelectedClass = () => {
    if (!selectedClass) return;
    const removed = deleteStudioClass(selectedClass.id);
    if (!removed) return;
    resetForm();
    showToast(`${removed.name} removed from Classes and calendar.`);
  };

  return (
    <OperationsPage
      title="Classes"
      text="Create recurring weekly classes, edit class days, and set start/end times that flow into the main calendar."
      action={
        <button type="button" className="student-header-add" onClick={resetForm}>
          <Plus size={18} /> New Class
        </button>
      }
    >
      <div className="operations-two-column">
        <form className="operations-form-panel" onSubmit={submit}>
          <h2>{selectedClass ? `Edit ${selectedClass.name}` : "Create Class"}</h2>
          <label>
            Class name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <fieldset className="class-day-picker">
            <legend>Class days</legend>
            {weekdayOptions.map((day) => (
              <label key={day.value}>
                <input type="checkbox" checked={form.daysOfWeek.includes(day.value)} onChange={() => toggleDay(day.value)} />
                <span>{day.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="class-time-grid">
            <label>
              Start time
              <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            </label>
            <label>
              End time
              <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
            </label>
          </div>
          <label>
            Title color
            <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} />
          </label>
          <label className="operations-checkbox-row">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
            />
            Recurring
          </label>
          <label>
            Class notes
            <textarea value={form.notes} rows={3} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <div className="student-editor-actions">
            <button type="submit">
              <CheckCircle2 size={18} /> {selectedClass ? "Save Class Changes" : "Create Class"}
            </button>
            {selectedClass && (
              <button type="button" className="student-delete-action" onClick={removeSelectedClass}>
                <Trash2 size={18} /> Remove Class
              </button>
            )}
          </div>
        </form>
        <section className="operations-panel">
          <h2>Recurring Classes</h2>
          <div className="operations-list compact">
            {studioClasses.map((studioClass) => (
              <ClassCard key={studioClass.id} studioClass={studioClass} onSelect={selectClass} />
            ))}
          </div>
        </section>
      </div>
    </OperationsPage>
  );
}

function ScheduleCard({ item, students }: { item: ScheduledClass; students: StudentRecord[] }) {
  const student = item.studentId ? students.find((entry) => entry.id === item.studentId) : undefined;
  return (
    <article className="operations-list-card">
      <div>
        <strong style={item.titleColor ? { color: item.titleColor } : undefined}>{item.title}</strong>
        <span>{scheduleTypeLabel(item.type)}</span>
      </div>
      <p>{item.date} at {item.time}</p>
      {item.recurring && <p>Repeats weekly</p>}
      <p>{student ? `Student: ${fullName(student)}` : item.notes || "Open class item"}</p>
    </article>
  );
}

function SchedulePage() {
  const { students, scheduledClasses, addScheduledClass, showToast } = useAppState();
  const [form, setForm] = useState({ title: "", date: "2026-05-22", time: "5:30 PM", type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
  const [customScheduleTypes, setCustomScheduleTypes] = useState<string[]>([]);
  const [isCustomTypeDialogOpen, setIsCustomTypeDialogOpen] = useState(false);
  const [newScheduleTypeName, setNewScheduleTypeName] = useState("");
  const scheduleTypeOptions = useMemo(() => {
    const options = new Map(defaultScheduleTypeOptions.map((option) => [option.value, option]));
    customScheduleTypes.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed && !options.has(trimmed)) {
        options.set(trimmed, { value: trimmed, label: scheduleTypeLabel(trimmed) });
      }
    });
    scheduledClasses.forEach((item) => {
      if (item.type.trim() && !options.has(item.type)) {
        options.set(item.type, { value: item.type, label: scheduleTypeLabel(item.type) });
      }
    });
    return [...options.values()];
  }, [customScheduleTypes, scheduledClasses]);

  const closeCustomTypeDialog = () => {
    setIsCustomTypeDialogOpen(false);
    setNewScheduleTypeName("");
  };

  const submitCustomScheduleType = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = newScheduleTypeName.trim();
    if (!trimmed) {
      showToast("Enter a schedule type name.");
      return;
    }
    const existingType = scheduleTypeOptions.find(
      (option) => option.value.toLowerCase() === trimmed.toLowerCase() || option.label.toLowerCase() === trimmed.toLowerCase()
    );
    const scheduleType = existingType?.value ?? trimmed;
    if (!existingType) {
      setCustomScheduleTypes((current) =>
        current.some((type) => type.toLowerCase() === trimmed.toLowerCase()) ? current : [...current, trimmed]
      );
    }
    setForm((current) => ({ ...current, type: scheduleType }));
    closeCustomTypeDialog();
    showToast(`${scheduleTypeLabel(scheduleType)} added to schedule types.`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const created = addScheduledClass({
      title: form.title,
      date: form.date,
      time: form.time,
      type: form.type,
      recurring: form.recurring,
      titleColor: form.titleColor,
      studentId: form.studentId || undefined,
      notes: form.notes
    });
    if (!created) {
      showToast("Enter a schedule title, date, time, and type.");
      return;
    }
    setForm({ title: "", date: form.date, time: form.time, type: "class", titleColor: "#b8f5e2", recurring: false, studentId: "", notes: "" });
    showToast(`${created.title} added to schedule.`);
  };

  return (
    <OperationsPage title="Schedule" text="Create class, private lesson, and testing-prep schedule items.">
      <div className="operations-two-column">
        <form className="operations-form-panel" onSubmit={submit}>
          <h2>Add Schedule Event</h2>
          <label>
            Event title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Schedule date
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </label>
          <label>
            Schedule time
            <input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
          </label>
          <label>
            Title color
            <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} />
          </label>
          <label>
            Schedule type
            <select
              value={form.type}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setNewScheduleTypeName("");
                  setIsCustomTypeDialogOpen(true);
                  return;
                }
                setForm({ ...form, type: event.target.value });
              }}
            >
              {scheduleTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="checkbox-row operations-checkbox-row">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(event) => setForm({ ...form, recurring: event.target.checked })}
            />
            Recurring
          </label>
          <label>
            Student
            <select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
              <option value="">No specific student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{fullName(student)}</option>
              ))}
            </select>
          </label>
          <button type="submit">
            <Plus size={18} /> Add Schedule Event
          </button>
        </form>
        <section className="operations-panel">
          <h2>Upcoming Schedule</h2>
          <div className="operations-list compact">
            {scheduledClasses.map((item) => <ScheduleCard key={item.id} item={item} students={students} />)}
          </div>
        </section>
      </div>
      {isCustomTypeDialogOpen && (
        <div className="modal-backdrop">
          <form
            aria-labelledby="create-schedule-type-title"
            aria-modal="true"
            className="modal-card modal-form operations-form-panel"
            role="dialog"
            onSubmit={submitCustomScheduleType}
          >
            <div className="drawer-head">
              <div>
                <h2 id="create-schedule-type-title">Create schedule type</h2>
                <p>Name the new schedule type.</p>
              </div>
            </div>
            <label>
              New schedule type name
              <input
                autoFocus
                value={newScheduleTypeName}
                onChange={(event) => setNewScheduleTypeName(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button type="submit">Submit</button>
              <button type="button" onClick={closeCustomTypeDialog}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

function MessagePreview({ message }: { message: MessageLog }) {
  return (
    <article className="message-preview">
      <div>
        <strong>{messageKindLabel(message.kind)}</strong>
        <span>{message.status}</span>
      </div>
      <p>{message.recipientName} · {message.recipientPhone}</p>
      <p>{message.body}</p>
    </article>
  );
}

type MessengerParticipant = {
  id: string;
  name: string;
  role: "staff" | "student" | "parent";
  subtitle: string;
  detail: string;
};

type MessengerFinderFilter = MessengerParticipant["role"];

const managerMessengerParticipant: MessengerParticipant = {
  id: "direct-staff-seed",
  name: "Cho's Manager",
  role: "staff",
  subtitle: "Studio staff",
  detail: "Manager account"
};

const staffMessengerParticipants: MessengerParticipant[] = [
  managerMessengerParticipant,
  {
    id: "direct-staff-instructors",
    name: "Instructor Team",
    role: "staff",
    subtitle: "Cho's staff",
    detail: "Class, testing, and floor support"
  }
];

function studentToMessengerParticipant(student: StudentRecord): MessengerParticipant {
  return {
    id: student.id,
    name: fullName(student),
    role: "student",
    subtitle: `${student.beltRank} belt`,
    detail: student.guardianPhone || student.phone || student.email
  };
}

function studentToParentMessengerParticipant(student: StudentRecord): MessengerParticipant {
  const studentName = fullName(student);
  const guardianName = student.guardianName?.trim() || `${studentName} Parent/Guardian`;
  return {
    id: `parent-${student.id}`,
    name: guardianName,
    role: "parent",
    subtitle: `Parent of ${studentName}`,
    detail: student.guardianPhone || student.guardianEmail || student.email || "No parent contact on file"
  };
}

function directMessageThreadId(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join("__");
}

function formatMessengerTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function DirectMessageBubble({ message, mine }: { message: DirectMessage; mine: boolean }) {
  return (
    <article className={`messenger-bubble${mine ? " mine" : ""}`}>
      <div>
        <strong>{message.senderName}</strong>
        <span>{formatMessengerTime(message.createdAt)}</span>
      </div>
      <p>{message.body}</p>
    </article>
  );
}

const messengerFinderFilters: { value: MessengerFinderFilter; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" }
];

function MessagesPage() {
  const { accountRole, students, messageCampaigns, messageLogs, directMessages, sendDirectMessage, sendMarketingBlast, sendMissedClassFollowUps, showToast } = useAppState();
  const [marketingMessage, setMarketingMessage] = useState("Monthly special: 10% off gloves and uniforms this week.");
  const studentParticipants = useMemo(() => students.map(studentToMessengerParticipant), [students]);
  const parentParticipants = useMemo(() => students.map(studentToParentMessengerParticipant), [students]);
  const currentParticipant = accountRole === "student" && studentParticipants[0] ? studentParticipants[0] : managerMessengerParticipant;
  const messageContacts = useMemo(
    () => [...staffMessengerParticipants, ...studentParticipants, ...parentParticipants].filter((participant) => participant.id !== currentParticipant.id),
    [currentParticipant.id, parentParticipants, studentParticipants]
  );
  const [selectedParticipantId, setSelectedParticipantId] = useState(messageContacts[0]?.id ?? "");
  const [directMessageText, setDirectMessageText] = useState("");
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderFilter, setFinderFilter] = useState<MessengerFinderFilter>("student");
  const [finderQuery, setFinderQuery] = useState("");
  const missedCount = students.filter((student) => student.missedClassCount >= 3).length;
  const selectedParticipant = messageContacts.find((participant) => participant.id === selectedParticipantId) ?? messageContacts[0];
  const selectedThreadId = selectedParticipant ? directMessageThreadId(currentParticipant.id, selectedParticipant.id) : "";
  const selectedConversationMessages = useMemo(
    () => directMessages.filter((message) => message.threadId === selectedThreadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [directMessages, selectedThreadId]
  );
  const finderResults = useMemo(() => {
    const query = finderQuery.trim().toLowerCase();
    return messageContacts.filter((participant) => {
      if (participant.role !== finderFilter) return false;
      if (!query) return true;
      return `${participant.name} ${participant.subtitle} ${participant.detail}`.toLowerCase().includes(query);
    });
  }, [finderFilter, finderQuery, messageContacts]);

  useEffect(() => {
    if (!messageContacts.length) return;
    if (!messageContacts.some((participant) => participant.id === selectedParticipantId)) {
      setSelectedParticipantId(messageContacts[0].id);
    }
  }, [messageContacts, selectedParticipantId]);

  const sendFollowUps = () => {
    const count = sendMissedClassFollowUps();
    showToast(count ? `${count} missed-class follow-up text${count === 1 ? "" : "s"} queued.` : "No missed-class follow-ups needed.");
  };

  const sendMarketing = (event: FormEvent) => {
    event.preventDefault();
    const count = sendMarketingBlast(marketingMessage);
    showToast(count ? `Marketing blast queued for ${count} student${count === 1 ? "" : "s"}.` : "Enter a marketing message.");
  };

  const sendDirect = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedParticipant) return;
    const sent = sendDirectMessage({
      senderId: currentParticipant.id,
      senderName: currentParticipant.name,
      recipientId: selectedParticipant.id,
      recipientName: selectedParticipant.name,
      body: directMessageText
    });
    if (!sent) {
      showToast("Type a message before sending.");
      return;
    }
    setDirectMessageText("");
    showToast(`Message sent to ${selectedParticipant.name}.`);
  };

  const openConversation = (participant: MessengerParticipant) => {
    setSelectedParticipantId(participant.id);
    setDirectMessageText("");
    setFinderOpen(false);
  };

  return (
    <OperationsPage title="Messages" text="Direct-message students, families, and staff while keeping text campaigns close by.">
      <section className="operations-panel messenger-panel" aria-label="Direct message center">
        <div className="student-roster-head">
          <div>
            <h2>Direct Messenger</h2>
            <p>Click any user name to open a private conversation and send a message instantly.</p>
          </div>
          <div className="messenger-head-actions">
            <button type="button" className="operations-action secondary" onClick={() => setFinderOpen(true)}>
              <Search size={18} /> Find User
            </button>
            <span className="messenger-self-badge">Signed in as {currentParticipant.name}</span>
          </div>
        </div>
        <div className="messenger-shell">
          <aside className="messenger-people" aria-label="Message people">
            {messageContacts.map((participant) => {
              const threadId = directMessageThreadId(currentParticipant.id, participant.id);
              const latestMessage = directMessages.filter((message) => message.threadId === threadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              return (
                <button
                  key={participant.id}
                  type="button"
                  className={`messenger-contact${selectedParticipant?.id === participant.id ? " active" : ""}`}
                  aria-label={`Open conversation with ${participant.name}`}
                  onClick={() => setSelectedParticipantId(participant.id)}
                >
                  <div>
                    <strong>{participant.name}</strong>
                    <small>{participant.subtitle}</small>
                    <p>{latestMessage?.body ?? participant.detail}</p>
                  </div>
                </button>
              );
            })}
          </aside>
          <section className="messenger-chat" aria-label={selectedParticipant ? `Conversation with ${selectedParticipant.name}` : "Conversation"}>
            {selectedParticipant ? (
              <>
                <header>
                  <div>
                    <h2>{selectedParticipant.name}</h2>
                    <p>{selectedParticipant.subtitle}</p>
                  </div>
                </header>
                <div className="messenger-thread" aria-live="polite">
                  {selectedConversationMessages.length ? (
                    selectedConversationMessages.map((message) => (
                      <DirectMessageBubble key={message.id} message={message} mine={message.senderId === currentParticipant.id} />
                    ))
                  ) : (
                    <p className="messenger-empty">No messages yet. Start the conversation with {selectedParticipant.name}.</p>
                  )}
                </div>
                <form className="messenger-composer" onSubmit={sendDirect}>
                  <label>
                    Message {selectedParticipant.name}
                    <textarea rows={3} value={directMessageText} onChange={(event) => setDirectMessageText(event.target.value)} />
                  </label>
                  <button type="submit" className="operations-action">
                    <MessagesSquare size={18} /> Send Message
                  </button>
                </form>
              </>
            ) : (
              <p className="messenger-empty">Add students to start direct messaging.</p>
            )}
          </section>
        </div>
      </section>
      {finderOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setFinderOpen(false)}>
          <section
            aria-labelledby="messenger-finder-title"
            aria-modal="true"
            className="modal-card messenger-finder-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="messenger-finder-title">Find User</h2>
                <p>Search by category, then click a name to open that message thread.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close find user" onClick={() => setFinderOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="messenger-finder-tabs" role="group" aria-label="User categories">
              {messengerFinderFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={finderFilter === filter.value}
                  className={finderFilter === filter.value ? "active" : ""}
                  onClick={() => {
                    setFinderFilter(filter.value);
                    setFinderQuery("");
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="messenger-finder-search">
              Search users
              <input value={finderQuery} onChange={(event) => setFinderQuery(event.target.value)} placeholder="Type a name, role, phone, or email" />
            </label>
            <div className="messenger-finder-results">
              {finderResults.length ? (
                finderResults.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    className="messenger-finder-result"
                    aria-label={`Open conversation with ${participant.name}`}
                    onClick={() => openConversation(participant)}
                  >
                    <div>
                      <strong>{participant.name}</strong>
                      <small>{participant.subtitle}</small>
                      <p>{participant.detail}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="messenger-empty">No users found in this category.</p>
              )}
            </div>
          </section>
        </div>
      )}
      <div className="operations-two-column">
        <section className="operations-panel">
          <h2>Follow-Up Automation</h2>
          <p>{missedCount} student{missedCount === 1 ? "" : "s"} currently missed 3 classes or more.</p>
          <button type="button" className="operations-action" onClick={sendFollowUps}>
            <Mail size={18} /> Send Missed-Class Follow-Ups
          </button>
        </section>
        <form className="operations-form-panel" onSubmit={sendMarketing}>
          <h2>Marketing Tool</h2>
          <label>
            Marketing message
            <textarea rows={4} value={marketingMessage} onChange={(event) => setMarketingMessage(event.target.value)} />
          </label>
          <button type="submit">
            <Mail size={18} /> Send Marketing Blast
          </button>
          {messageCampaigns[0] && <p className="operations-note">Latest campaign: {messageCampaigns[0].title}</p>}
        </form>
      </div>
      <section className="operations-panel">
        <h2>Text Log</h2>
        <div className="message-log-grid">
          {messageLogs.map((message) => <MessagePreview key={message.id} message={message} />)}
        </div>
      </section>
    </OperationsPage>
  );
}

function CheckInsPage() {
  const { accountRole, students, checkIns, recordStudentCheckIn, showToast } = useAppState();
  const firstStudentId = students[0]?.id ?? "";
  const [selectedStudentId, setSelectedStudentId] = useState(firstStudentId);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const isStudentMode = accountRole === "student";
  const latestStudentCheckIn = selectedStudent ? checkIns.find((checkIn) => checkIn.studentId === selectedStudent.id) : undefined;
  const studentAfterCheckIn = selectedStudent ? students.find((student) => student.id === selectedStudent.id) : undefined;

  const checkIn = () => {
    if (!selectedStudent) return;
    const created = recordStudentCheckIn(selectedStudent.id);
    if (created) {
      showToast(`${created.studentName} checked in.`);
    }
  };

  return (
    <OperationsPage title={isStudentMode ? "Student Check-In" : "Check-Ins"} text="Students can sign in, track belt progress, and reset missed-class follow-up status.">
      <div className="operations-two-column">
        <section className="operations-panel checkin-panel">
          {!isStudentMode && (
            <label>
              Student
              <select value={selectedStudent?.id ?? ""} onChange={(event) => setSelectedStudentId(event.target.value)}>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>{fullName(student)}</option>
                ))}
              </select>
            </label>
          )}
          {selectedStudent && (
            <>
              <div className="student-rank-card">
                <Award size={32} />
                <div>
                  <p>Current rank</p>
                  <h2>{selectedStudent.beltRank} Belt</h2>
                </div>
              </div>
              <p>Classes attended: {studentAfterCheckIn?.classesAttended ?? selectedStudent.classesAttended}</p>
              <p>Missed classes: {studentAfterCheckIn?.missedClassCount ?? selectedStudent.missedClassCount}</p>
              <button type="button" className="operations-action" onClick={checkIn}>
                <CheckCircle2 size={18} /> Check In Today
              </button>
              {latestStudentCheckIn && <p className="operations-success">Checked in today: {latestStudentCheckIn.date}</p>}
            </>
          )}
        </section>
        <section className="operations-panel">
          <h2>Recent Check-Ins</h2>
          <div className="operations-list compact">
            {checkIns.length ? checkIns.map((checkIn) => (
              <article className="operations-list-card" key={checkIn.id}>
                <strong>{checkIn.studentName}</strong>
                <p>{checkIn.date} · {checkIn.beltRank} Belt</p>
              </article>
            )) : <p>No check-ins recorded yet.</p>}
          </div>
        </section>
      </div>
    </OperationsPage>
  );
}

function EventCard({ event }: { event: StudioEvent }) {
  return (
    <article className="operations-list-card">
      <div>
        <strong>{event.title}</strong>
        <span>{event.audience}</span>
      </div>
      <p>{event.date} at {event.time}</p>
      <p>{event.details}</p>
    </article>
  );
}

function EventsPage() {
  const { accountRole, studioEvents, addStudioEvent, showToast } = useAppState();
  const [form, setForm] = useState({ title: "", date: "2026-06-01", time: "6:00 PM", details: "", audience: "students" as StudioEvent["audience"] });
  const isStudent = accountRole === "student";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const created = addStudioEvent(form);
    if (!created) {
      showToast("Enter event title, date, and time.");
      return;
    }
    setForm({ title: "", date: form.date, time: form.time, details: "", audience: "students" });
    showToast(`${created.title} added to events.`);
  };

  return (
    <OperationsPage title="Events" text="Keep students up to date on testing dates, movie night, and special studio events.">
      <div className={isStudent ? "operations-single-column" : "operations-two-column"}>
        {!isStudent && (
          <form className="operations-form-panel" onSubmit={submit}>
            <h2>Add Event</h2>
            <label>
              Event title
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Event date
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label>
              Event time
              <input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            </label>
            <label>
              Event details
              <textarea rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} />
            </label>
            <button type="submit">
              <Plus size={18} /> Add Event
            </button>
          </form>
        )}
        <section className="operations-panel">
          <h2>Studio Event Board</h2>
          <div className="operations-list compact">
            {studioEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </section>
      </div>
    </OperationsPage>
  );
}

const emptyMerchandiseForm = {
  name: "",
  category: "Gloves",
  price: "39",
  stock: "6",
  description: "",
  imageDataUrl: ""
};

function merchandiseItemToForm(item: MerchandiseItem) {
  return {
    name: item.name,
    category: item.category,
    price: String(item.price),
    stock: String(item.stock),
    description: item.description,
    imageDataUrl: item.imageDataUrl ?? ""
  };
}

function MerchandiseCard({ item, onEdit }: { item: MerchandiseItem; onEdit: (item: MerchandiseItem) => void }) {
  return (
    <article className="merchandise-card">
      <div className="merchandise-image">
        {item.imageDataUrl ? <img src={item.imageDataUrl} alt={item.name} /> : <ShoppingCart aria-hidden="true" size={24} />}
      </div>
      <strong>{item.name}</strong>
      <span>{item.category}</span>
      <p>{item.description}</p>
      <div className="merchandise-card-price">
        <b>{formatMoney(item.price)}</b>
        <small>{item.stock} in stock</small>
      </div>
      <div className="merchandise-card-actions">
        <button type="button" className="operations-action secondary" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
          <Edit3 size={16} /> Edit
        </button>
      </div>
    </article>
  );
}

function MerchandisePage() {
  const { merchandiseItems, addMerchandiseItem, updateMerchandiseItem, deleteMerchandiseItem, showToast } = useAppState();
  const [form, setForm] = useState(emptyMerchandiseForm);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedMerchandiseId, setSelectedMerchandiseId] = useState("");
  const selectedMerchandise = merchandiseItems.find((item) => item.id === selectedMerchandiseId);
  const inventoryValue = useMemo(() => merchandiseItems.reduce((sum, item) => sum + item.price * item.stock, 0), [merchandiseItems]);

  const closeMerchandiseModal = () => {
    setModalMode(null);
    setSelectedMerchandiseId("");
    setForm(emptyMerchandiseForm);
  };

  const openCreateMerchandise = () => {
    setSelectedMerchandiseId("");
    setForm(emptyMerchandiseForm);
    setModalMode("create");
  };

  const openEditMerchandise = (item: MerchandiseItem) => {
    setSelectedMerchandiseId(item.id);
    setForm(merchandiseItemToForm(item));
    setModalMode("edit");
  };

  const handleImageUpload = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, imageDataUrl: typeof reader.result === "string" ? reader.result : "" }));
    };
    reader.readAsDataURL(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      description: form.description,
      imageDataUrl: form.imageDataUrl || undefined
    };
    const saved = selectedMerchandise && modalMode === "edit"
      ? updateMerchandiseItem(selectedMerchandise.id, payload)
      : addMerchandiseItem(payload);
    if (!saved) {
      showToast("Enter product name, category, price, and stock.");
      return;
    }
    closeMerchandiseModal();
    showToast(`${saved.name} saved to merchandise.`);
  };

  const deleteSelectedMerchandise = () => {
    if (!selectedMerchandise) return;
    const deleted = deleteMerchandiseItem(selectedMerchandise.id);
    if (!deleted) return;
    closeMerchandiseModal();
    showToast(`${deleted.name} removed from merchandise.`);
  };

  const modalTitle = modalMode === "edit" && selectedMerchandise ? `Edit ${selectedMerchandise.name}` : "Add New Merchandise";

  return (
    <OperationsPage
      title="Merchandise"
      text="Upload and browse gloves, uniforms, sparring equipment, and Cho's apparel."
      action={
        <button type="button" className="operations-action student-header-add" onClick={openCreateMerchandise}>
          <Plus size={18} /> Add New Merchandise
        </button>
      }
    >
      <div className="operations-stats">
        <StatCard label="Products" value={merchandiseItems.length} icon={<Package />} />
        <StatCard label="Inventory value" value={formatMoney(inventoryValue)} icon={<Target />} />
      </div>
      <div className="operations-single-column">
        <section className="operations-panel merchandise-manager-panel">
          <h2>Product List</h2>
          <div className="merchandise-grid">
            {merchandiseItems.map((item) => (
              <MerchandiseCard key={item.id} item={item} onEdit={openEditMerchandise} />
            ))}
          </div>
        </section>
      </div>
      {modalMode && (
        <div className="modal-backdrop" role="presentation" onClick={closeMerchandiseModal}>
          <form
            aria-labelledby="merchandise-modal-title"
            aria-modal="true"
            className="modal-card operations-form-panel student-modal-card merchandise-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="student-modal-head">
              <div>
                <h2 id="merchandise-modal-title">{modalTitle}</h2>
                <p>Manage the item details, inventory count, and display image shown in the merchandise shop.</p>
              </div>
              <button type="button" className="student-modal-close" aria-label="Close merchandise editor" onClick={closeMerchandiseModal}>
                <X size={18} />
              </button>
            </div>
            <section className="student-form-section">
              <h3>Product Details</h3>
              <div className="student-form-grid">
                <label>
                  Product name
                  <input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  Category
                  <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
                </label>
                <label>
                  Price
                  <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
                </label>
                <label>
                  Stock
                  <input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                </label>
                <label className="student-form-wide">
                  Description
                  <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            </section>
            <section className="student-form-section">
              <h3>Product Image</h3>
              <div className="merchandise-upload-grid">
                <label className="merchandise-image-upload">
                  Product image
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </label>
                <div className="merchandise-image-preview">
                  {form.imageDataUrl ? <img src={form.imageDataUrl} alt="Uploaded merchandise preview" /> : <span>No product image uploaded.</span>}
                </div>
              </div>
            </section>
            <div className="student-editor-actions">
              <button type="submit">
                <CheckCircle2 size={18} /> {modalMode === "edit" ? "Save Merchandise Changes" : "Create Merchandise"}
              </button>
              {modalMode === "edit" && (
                <button type="button" className="student-delete-action" onClick={deleteSelectedMerchandise}>
                  <Trash2 size={18} /> Delete Merchandise
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </OperationsPage>
  );
}

export function OperationsApp() {
  return (
    <OperationsShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/check-ins" element={<CheckInsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/merchandise" element={<MerchandisePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OperationsShell>
  );
}
