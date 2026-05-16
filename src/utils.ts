import { addDays, compareAsc, format, parseISO, startOfDay } from "date-fns";
import { appTopics, benefits, classRules, instructors, navLinks, products, programs, termsSections } from "./data";
import type { AccountSession, CartItem, ClassEvent, ContactSubmission, Coupon, CustomerInfo, Order, SearchResult } from "./types";

export const TAX_RATE = 0.05;
export const PICKUP_OPTION = "In-store pickup and fitting at Cho's Martial Arts";

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyCoupon(code: string, subtotal: number): Coupon {
  const normalized = code.trim().toUpperCase();
  if (normalized === "CHOS10") {
    return { code: normalized, amount: roundCurrency(subtotal * 0.1), valid: true };
  }
  return { code: normalized, amount: 0, valid: false };
}

export function calculateTotals(items: CartItem[], coupon?: Coupon) {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const discount = coupon?.valid ? Math.min(coupon.amount, subtotal) : 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = roundCurrency(taxable * TAX_RATE);
  const total = roundCurrency(taxable + tax);
  return { subtotal, discount, tax, total };
}

export function createOrder(input: {
  existingOrdersCount: number;
  customer: CustomerInfo;
  items: CartItem[];
  coupon?: Coupon;
  notes: string;
}): Order {
  const totals = calculateTotals(input.items, input.coupon);
  const sequence = String(input.existingOrdersCount + 1).padStart(4, "0");
  return {
    id: `order-${Date.now()}`,
    orderNumber: `CHOS-2026-${sequence}`,
    createdAt: new Date().toISOString(),
    customer: input.customer,
    items: input.items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    coupon: input.coupon,
    notes: input.notes,
    pickupOption: PICKUP_OPTION,
    status: "Ready for in-store pickup coordination"
  };
}

export function generateClassEvents(): ClassEvent[] {
  const start = startOfDay(new Date(2026, 4, 1));
  const end = startOfDay(new Date(2026, 5, 30));
  const events: ClassEvent[] = [];

  for (let day = start; compareAsc(day, end) <= 0; day = addDays(day, 1)) {
    const weekday = day.getDay();
    const date = format(day, "yyyy-MM-dd");
    classRules.forEach((rule) => {
      if (rule.weekdays.includes(weekday)) {
        events.push({
          id: `${rule.id}-${date}`,
          ruleId: rule.id,
          title: rule.title,
          date,
          startTime: rule.startTime,
          endTime: rule.endTime,
          description: rule.description,
          ageNote: rule.ageNote
        });
      }
    });
  }

  return events.sort((a, b) => `${a.date} ${toSortableTime(a.startTime)}`.localeCompare(`${b.date} ${toSortableTime(b.startTime)}`));
}

function toSortableTime(time: string) {
  const { hours, minutes } = parseTime(time);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTime(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return { hours: 0, minutes: 0 };
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

function chicagoDateTimeToUtcStamp(date: string, time: string) {
  const { hours, minutes } = parseTime(time);
  const local = parseISO(`${date}T00:00:00`);
  const daylightOffsetHours = 5;
  const utcDate = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), hours + daylightOffsetHours, minutes));
  return [
    utcDate.getUTCFullYear(),
    String(utcDate.getUTCMonth() + 1).padStart(2, "0"),
    String(utcDate.getUTCDate()).padStart(2, "0"),
    "T",
    String(utcDate.getUTCHours()).padStart(2, "0"),
    String(utcDate.getUTCMinutes()).padStart(2, "0"),
    String(utcDate.getUTCSeconds()).padStart(2, "0"),
    "Z"
  ].join("");
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function generateIcs(event: Pick<ClassEvent, "title" | "date" | "startTime" | "endTime" | "description">) {
  const uid = `${event.title}-${event.date}-${event.startTime}@chos-prototype`.replace(/\s+/g, "-").toLowerCase();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cho's Martial Arts//Prototype Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
    `DTSTART:${chicagoDateTimeToUtcStamp(event.date, event.startTime)}`,
    `DTEND:${chicagoDateTimeToUtcStamp(event.date, event.endTime)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    `LOCATION:${icsEscape("N89W16863 Appleton Ave. Menomonee Falls, Wisconsin 53051")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/calendar") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function searchSite(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const entries: SearchResult[] = [
    ...appTopics.map((topic) => ({ title: topic.label, subtitle: topic.summary, path: topic.path, type: "App Topic" })),
    ...navLinks.map((link) => ({ title: link.label, subtitle: "Page", path: link.path, type: "Page" })),
    ...programs.map((program) => ({ title: program.title, subtitle: program.shortDescription, path: `/programs?program=${program.slug}`, type: "Program" })),
    ...benefits.map((benefit) => ({ title: benefit.title, subtitle: benefit.summary, path: "/programs", type: "Benefit" })),
    ...instructors.map((instructor) => ({ title: instructor.name, subtitle: instructor.role, path: "/about-us", type: "Instructor" })),
    ...products.map((product) => ({ title: product.name, subtitle: product.displayPrice, path: `/product/${product.slug}`, type: "Product" })),
    ...classRules.map((rule) => ({ title: rule.title, subtitle: `${rule.startTime} - ${rule.endTime}`, path: "/classes", type: "Class" })),
    ...termsSections.map((term) => ({ title: term.title, subtitle: term.content, path: "/terms-and-conditions", type: "Terms" }))
  ];

  return entries
    .filter((entry) => `${entry.title} ${entry.subtitle} ${entry.type}`.toLowerCase().includes(q))
    .slice(0, 12);
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function getLoginGateState(session?: AccountSession) {
  return session?.email ? "app" : "login";
}

export function validateLoginForm(input: { username: string; password: string }) {
  const errors: Record<string, string> = {};
  if (!input.username.trim()) errors.username = "Username is required.";
  if (!input.password.trim()) errors.password = "Password is required.";
  return errors;
}

export const prototypeManagerLogin = {
  username: "Manager123",
  password: "123456",
  email: "manager123@chos.prototype",
  role: "staff"
} as const;

export function isPrototypeManagerLogin(input: { username: string; password: string }) {
  return input.username.trim().toLowerCase() === prototypeManagerLogin.username.toLowerCase() && input.password.trim() === prototypeManagerLogin.password;
}

export function validateRegisterForm(input: { email: string; password: string }) {
  const errors: Record<string, string> = {};
  if (!validateEmail(input.email)) errors.email = "Valid email is required.";
  if (input.password.trim().length < 6) errors.password = "Password must be at least 6 characters.";
  return errors;
}

export function createGuestSession(): AccountSession {
  return { email: "guest@chos.prototype", remembered: false, createdAt: new Date().toISOString() };
}

export function getInitialLaunchPhase(prefersReducedMotion: boolean) {
  return prefersReducedMotion ? "final-logo" : "playing";
}

export function validateContactForm(input: { name: string; email: string; phone: string; message: string; captcha: boolean; url: string }) {
  const errors: Record<string, string> = {};
  if (input.url.trim()) {
    return { url: "Submission blocked." };
  }
  if (!input.name.trim()) errors.name = "Name is required.";
  if (!validateEmail(input.email)) errors.email = "Valid email is required.";
  if (!input.phone.trim()) errors.phone = "Phone number is required.";
  if (!input.message.trim()) errors.message = "Message is required.";
  if (!input.captcha) errors.captcha = "Please confirm you are not a robot.";
  return errors;
}

export function validateCheckoutForm(input: CustomerInfo & { terms: boolean }) {
  const errors: Record<string, string> = {};
  if (!input.firstName.trim()) errors.firstName = "First name is required.";
  if (!input.lastName.trim()) errors.lastName = "Last name is required.";
  if (!validateEmail(input.email)) errors.email = "Valid email is required.";
  if (!input.phone.trim()) errors.phone = "Phone is required.";
  if (!input.address.trim()) errors.address = "Address is required.";
  if (!input.city.trim()) errors.city = "City is required.";
  if (!input.state.trim()) errors.state = "State is required.";
  if (!input.zip.trim()) errors.zip = "ZIP is required.";
  if (!input.terms) errors.terms = "Please accept the terms and conditions.";
  return errors;
}

export function makeContactSubmission(input: { name: string; email: string; phone: string; message: string }): ContactSubmission {
  return {
    id: `contact-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...input
  };
}

export function groupEventsByDate(events: ClassEvent[]) {
  return events.reduce<Record<string, ClassEvent[]>>((groups, event) => {
    groups[event.date] = [...(groups[event.date] ?? []), event];
    return groups;
  }, {});
}

export function displayDate(date: string) {
  return format(parseISO(`${date}T00:00:00`), "EEEE, MMMM d, yyyy");
}

export function monthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}
