import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { getProduct, studio } from "./data";
import type {
  AccountRole,
  AccountSession,
  BookingDetails,
  CartItem,
  ChildAccount,
  ContactSubmission,
  Coupon,
  CustomerInfo,
  DirectMessage,
  MerchandiseItem,
  MessageCampaign,
  MessageLog,
  Order,
  StudioClass,
  ScheduledClass,
  StudentCheckIn,
  StudentRecord,
  StudioEvent
} from "./types";
import { applyCoupon, calculateTotals, createOrder } from "./utils";

const keys = {
  cart: "chos.cart.v1",
  orders: "chos.orders.v1",
  bookings: "chos.bookings.v1",
  contacts: "chos.contacts.v1",
  session: "chos.session.v1",
  accounts: "chos.accounts.v1",
  accountRoles: "chos.accountRoles.v1",
  childAccounts: "chos.childAccounts.v1",
  coupon: "chos.coupon.v1",
  students: "chos.operations.students.v1",
  studioClasses: "chos.operations.classes.v1",
  scheduledClasses: "chos.operations.schedule.v1",
  messageCampaigns: "chos.operations.campaigns.v1",
  messageLogs: "chos.operations.messages.v1",
  directMessages: "chos.operations.directMessages.v1",
  studioEvents: "chos.operations.events.v1",
  merchandiseItems: "chos.operations.merchandise.v1",
  checkIns: "chos.operations.checkins.v1"
} as const;

const seedStudents: StudentRecord[] = [
  {
    id: "student-mina-seed",
    firstName: "Mina",
    lastName: "Cho",
    dateOfBirth: "2014-08-20",
    gender: "Female",
    phone: "(262) 555-0101",
    email: "mina@example.com",
    guardianName: "Daniel Cho",
    guardianPhone: "(262) 555-0101",
    guardianEmail: "daniel@example.com",
    emergencyContactName: "Grace Kim",
    emergencyContactRelationship: "Aunt",
    emergencyContactPhone: "(262) 555-0130",
    emergencyContactEmail: "grace@example.com",
    enrollmentDate: "2026-02-10",
    program: "Private Intro Lesson",
    status: "Active",
    beltRank: "Green",
    classesAttended: 24,
    missedClassCount: 1,
    lastCheckIn: "2026-05-08",
    joinedAt: "2026-02-10",
    notes: "Youth advanced student."
  },
  {
    id: "student-mason-seed",
    firstName: "Mason",
    lastName: "Lee",
    dateOfBirth: "2012-03-15",
    gender: "Male",
    phone: "(262) 555-0102",
    email: "mason@example.com",
    guardianName: "Sora Lee",
    guardianPhone: "(262) 555-0102",
    guardianEmail: "sora@example.com",
    emergencyContactName: "Chris Park",
    emergencyContactRelationship: "Uncle",
    emergencyContactPhone: "(262) 555-0140",
    emergencyContactEmail: "chris@example.com",
    enrollmentDate: "2026-01-18",
    program: "Youth Foundations",
    status: "Active",
    beltRank: "Yellow",
    classesAttended: 12,
    missedClassCount: 3,
    lastCheckIn: "2026-04-22",
    joinedAt: "2026-01-18",
    notes: "Needs follow-up after missed classes."
  }
];

const seedScheduledClasses: ScheduledClass[] = [
  { id: "schedule-youth-beginners", title: "Youth Beginners", date: "2026-05-18", time: "5:00 PM", type: "class", notes: "Beginner martial arts fundamentals." },
  { id: "schedule-private-intro", title: "Private Intro Lesson", date: "2026-05-19", time: "12:30 PM", type: "private-lesson", studentId: "student-mina-seed", notes: "Welcome and starter assessment." }
];

const seedStudioClasses: StudioClass[] = [
  { id: "class-youth-foundations", name: "Youth Foundations", daysOfWeek: [0, 2], startTime: "17:00", endTime: "17:45", notes: "Beginner youth fundamentals and confidence work." },
  { id: "class-family-training", name: "Family Training", daysOfWeek: [2, 4], startTime: "18:00", endTime: "18:50", notes: "All-belt family class with basics, forms, and fitness." }
];

const seedMessageLogs: MessageLog[] = [
  {
    id: "message-reminder-seed",
    kind: "reminder",
    recipientName: "Mina Cho",
    recipientPhone: "(262) 555-0101",
    body: "Reminder: Youth Beginners meets this week at Cho's Martial Arts.",
    status: "sent",
    createdAt: "2026-05-10T15:00:00.000Z"
  }
];

const seedDirectMessages: DirectMessage[] = [
  {
    id: "direct-message-mina-seed-1",
    threadId: "direct-staff-seed__student-mina-seed",
    senderId: "direct-staff-seed",
    senderName: "Cho's Manager",
    recipientId: "student-mina-seed",
    recipientName: "Mina Cho",
    body: "Hi Mina, your next class notes are ready when you arrive.",
    createdAt: "2026-05-13T18:00:00.000Z",
    status: "sent"
  },
  {
    id: "direct-message-mina-seed-2",
    threadId: "direct-staff-seed__student-mina-seed",
    senderId: "student-mina-seed",
    senderName: "Mina Cho",
    recipientId: "direct-staff-seed",
    recipientName: "Cho's Manager",
    body: "Thank you, I will be there for training.",
    createdAt: "2026-05-13T18:05:00.000Z",
    status: "sent"
  }
];

const seedStudioEvents: StudioEvent[] = [
  { id: "event-testing-seed", title: "Color Belt Testing", date: "2026-05-30", time: "10:00 AM", details: "Testing date for students cleared by instructors.", audience: "students" },
  { id: "event-movie-night-seed", title: "Movie Night", date: "2026-06-07", time: "6:30 PM", details: "Family movie night at the studio.", audience: "families" }
];

const seedMerchandiseItems: MerchandiseItem[] = [
  { id: "merch-gloves-seed", name: "Youth Boxing Gloves", category: "Gloves", price: 39, stock: 6, description: "Youth 6oz gloves for bag work and sparring prep.", imageLabel: "gloves" },
  { id: "merch-uniform-seed", name: "White Basic Uniform", category: "Uniforms", price: 39, stock: 10, description: "Starter uniform with Cho's logo patches.", imageLabel: "uniform" }
];

interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface AccountRecord {
  email: string;
  createdAt: string;
}

interface AccountRoleRecord {
  email: string;
  role: AccountRole;
}

type StudioClassInput = {
  name: string;
  daysOfWeek: StudioClass["daysOfWeek"];
  startTime: string;
  endTime: string;
  recurring?: boolean;
  titleColor?: string;
  notes?: string;
};

type StudentInput = {
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  studentEmail: string;
  guardianName?: string;
  guardianPhone: string;
  guardianEmail?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  enrollmentDate?: string;
  program?: string;
  status?: string;
  beltRank: string;
  notes?: string;
};

type MerchandiseInput = {
  name: string;
  category: string;
  price: number;
  stock: number;
  description?: string;
  imageDataUrl?: string;
};

interface AppState {
  cart: CartItem[];
  coupon?: Coupon;
  totals: ReturnType<typeof calculateTotals>;
  orders: Order[];
  bookings: BookingDetails[];
  contacts: ContactSubmission[];
  session?: AccountSession;
  accountRole?: AccountRole;
  accounts: AccountRecord[];
  guardianChildren: ChildAccount[];
  students: StudentRecord[];
  studioClasses: StudioClass[];
  scheduledClasses: ScheduledClass[];
  messageCampaigns: MessageCampaign[];
  messageLogs: MessageLog[];
  directMessages: DirectMessage[];
  studioEvents: StudioEvent[];
  merchandiseItems: MerchandiseItem[];
  checkIns: StudentCheckIn[];
  toasts: Toast[];
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  dismissToast: (id: string) => void;
  addProductToCart: (productSlug: string, quantity: number) => void;
  addBookingToCart: (booking: BookingDetails) => void;
  updateCartQuantity: (id: string, quantity: number) => void;
  removeCartItem: (id: string) => void;
  clearCart: () => void;
  applyCartCoupon: (code: string) => Coupon;
  clearCoupon: () => void;
  placeOrder: (customer: CustomerInfo, notes: string) => Order;
  saveBooking: (booking: BookingDetails) => void;
  saveContact: (contact: ContactSubmission) => void;
  login: (email: string, remembered: boolean, role?: AccountRole) => void;
  loginChildAccount: (childId: string) => void;
  logout: () => void;
  register: (email: string) => void;
  setAccountRole: (role: AccountRole) => void;
  addChildAccount: (child: { name: string; age: string; beltSlug: string }) => ChildAccount | undefined;
  addOperationsStudent: (student: StudentInput) => StudentRecord | undefined;
  updateOperationsStudent: (studentId: string, student: StudentInput) => StudentRecord | undefined;
  deleteOperationsStudent: (studentId: string) => StudentRecord | undefined;
  addStudioClass: (studioClass: StudioClassInput) => StudioClass | undefined;
  updateStudioClass: (classId: string, studioClass: StudioClassInput) => StudioClass | undefined;
  deleteStudioClass: (classId: string) => StudioClass | undefined;
  addScheduledClass: (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => ScheduledClass | undefined;
  addStudioEvent: (event: { title: string; date: string; time: string; details: string; audience: StudioEvent["audience"] }) => StudioEvent | undefined;
  addMerchandiseItem: (item: MerchandiseInput) => MerchandiseItem | undefined;
  updateMerchandiseItem: (itemId: string, item: MerchandiseInput) => MerchandiseItem | undefined;
  deleteMerchandiseItem: (itemId: string) => MerchandiseItem | undefined;
  recordStudentCheckIn: (studentId: string) => StudentCheckIn | undefined;
  sendMissedClassFollowUps: () => number;
  sendMarketingBlast: (body: string) => number;
  sendDirectMessage: (message: { senderId: string; senderName: string; recipientId: string; recipientName: string; body: string }) => DirectMessage | undefined;
}

const Context = createContext<AppState | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing, blocked-storage contexts, or when large image uploads exceed quota.
  }
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStorage<T>(key, fallback));
  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  return [value, update] as const;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function createPrototypeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function studentFullName(student: Pick<StudentRecord, "firstName" | "lastName">) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function splitStudentName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ")
  };
}

function normalizeStudentInput(student: StudentInput, fallbackEnrollmentDate = todayStamp()) {
  const { firstName, lastName } = splitStudentName(student.fullName);
  const phone = student.guardianPhone.trim() || student.emergencyContactPhone?.trim() || "";
  const email = student.studentEmail.trim();
  const beltRank = student.beltRank.trim() || "White";
  const enrollmentDate = student.enrollmentDate?.trim() || fallbackEnrollmentDate;
  if (!firstName || !phone || !email) return undefined;

  return {
    firstName,
    lastName,
    dateOfBirth: student.dateOfBirth?.trim() || undefined,
    gender: student.gender?.trim() || undefined,
    phone,
    email,
    guardianName: student.guardianName?.trim() || undefined,
    guardianPhone: student.guardianPhone.trim() || undefined,
    guardianEmail: student.guardianEmail?.trim() || undefined,
    emergencyContactName: student.emergencyContactName?.trim() || undefined,
    emergencyContactRelationship: student.emergencyContactRelationship?.trim() || undefined,
    emergencyContactPhone: student.emergencyContactPhone?.trim() || undefined,
    emergencyContactEmail: student.emergencyContactEmail?.trim() || undefined,
    enrollmentDate,
    program: student.program?.trim() || "Youth Foundations",
    status: student.status?.trim() || "Active",
    beltRank,
    joinedAt: enrollmentDate,
    notes: student.notes?.trim()
  };
}

function welcomeTextForStudent(student: StudentRecord) {
  return `Welcome ${student.firstName} to Cho's Martial Arts. Start here: ${studio.facebookUrl} and ${studio.instagramUrl}. Website: ${studio.mapsUrl}`;
}

function missedClassTextForStudent(student: StudentRecord) {
  return `We missed you in class, ${student.firstName}. You missed ${student.missedClassCount} classes. Reply or call ${studio.phone} so we can help you get back on schedule.`;
}

function makeMessageLog(input: Omit<MessageLog, "id" | "createdAt" | "status">): MessageLog {
  return {
    ...input,
    id: createPrototypeId("message"),
    createdAt: new Date().toISOString(),
    status: "queued"
  };
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useStoredState<CartItem[]>(keys.cart, []);
  const [orders, setOrders] = useStoredState<Order[]>(keys.orders, []);
  const [bookings, setBookings] = useStoredState<BookingDetails[]>(keys.bookings, []);
  const [contacts, setContacts] = useStoredState<ContactSubmission[]>(keys.contacts, []);
  const [session, setSession] = useStoredState<AccountSession | undefined>(keys.session, undefined);
  const [accounts, setAccounts] = useStoredState<AccountRecord[]>(keys.accounts, []);
  const [accountRoles, setAccountRoles] = useStoredState<AccountRoleRecord[]>(keys.accountRoles, []);
  const [childAccounts, setChildAccounts] = useStoredState<ChildAccount[]>(keys.childAccounts, []);
  const [coupon, setCoupon] = useStoredState<Coupon | undefined>(keys.coupon, undefined);
  const [students, setStudents] = useStoredState<StudentRecord[]>(keys.students, seedStudents);
  const [studioClasses, setStudioClasses] = useStoredState<StudioClass[]>(keys.studioClasses, seedStudioClasses);
  const [scheduledClasses, setScheduledClasses] = useStoredState<ScheduledClass[]>(keys.scheduledClasses, seedScheduledClasses);
  const [messageCampaigns, setMessageCampaigns] = useStoredState<MessageCampaign[]>(keys.messageCampaigns, []);
  const [messageLogs, setMessageLogs] = useStoredState<MessageLog[]>(keys.messageLogs, seedMessageLogs);
  const [directMessages, setDirectMessages] = useStoredState<DirectMessage[]>(keys.directMessages, seedDirectMessages);
  const [studioEvents, setStudioEvents] = useStoredState<StudioEvent[]>(keys.studioEvents, seedStudioEvents);
  const [merchandiseItems, setMerchandiseItems] = useStoredState<MerchandiseItem[]>(keys.merchandiseItems, seedMerchandiseItems);
  const [checkIns, setCheckIns] = useStoredState<StudentCheckIn[]>(keys.checkIns, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    const id = createPrototypeId("toast");
    setToasts((current) => [...current, { id, message, actionLabel, onAction }]);
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
    toastTimersRef.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(
    () => () => {
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current.clear();
    },
    []
  );

  const totals = useMemo(() => calculateTotals(cart, coupon), [cart, coupon]);
  const accountRole = useMemo(() => (session ? accountRoles.find((record) => record.email.toLowerCase() === session.email.toLowerCase())?.role : undefined), [accountRoles, session]);
  const guardianChildren = useMemo(
    () => (session ? childAccounts.filter((child) => child.parentEmail.toLowerCase() === session.email.toLowerCase()) : []),
    [childAccounts, session]
  );

  const saveRoleForEmail = useCallback(
    (email: string, role: AccountRole) => {
      setAccountRoles((current) => {
        const normalizedEmail = email.toLowerCase();
        const existing = current.some((record) => record.email.toLowerCase() === normalizedEmail);
        return existing ? current.map((record) => (record.email.toLowerCase() === normalizedEmail ? { ...record, role } : record)) : [...current, { email, role }];
      });
    },
    [setAccountRoles]
  );

  const addProductToCart = useCallback(
    (productSlug: string, quantity: number) => {
      const product = getProduct(productSlug);
      if (!product) return;
      setCart((current) => {
        const existing = current.find((item) => item.productSlug === productSlug && !item.booking);
        if (existing) {
          return current.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item));
        }
        return [
          ...current,
          {
            id: `cart-${productSlug}-${Date.now()}`,
            productSlug,
            name: product.name,
            unitPrice: product.price,
            displayPrice: product.displayPrice,
            quantity
          }
        ];
      });
    },
    [setCart]
  );

  const saveBooking = useCallback(
    (booking: BookingDetails) => {
      setBookings((current) => [...current, booking]);
    },
    [setBookings]
  );

  const addBookingToCart = useCallback(
    (booking: BookingDetails) => {
      const product = getProduct("starter-program");
      if (!product) return;
      setCart((current) => [
        ...current,
        {
          id: `booking-${Date.now()}`,
          productSlug: product.slug,
          name: `${product.name} - ${booking.date} ${booking.time}`,
          unitPrice: product.price * booking.persons,
          displayPrice: product.displayPrice,
          quantity: 1,
          booking
        }
      ]);
      saveBooking(booking);
    },
    [saveBooking, setCart]
  );

  const updateCartQuantity = useCallback(
    (id: string, quantity: number) => {
      setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)));
    },
    [setCart]
  );

  const removeCartItem = useCallback(
    (id: string) => {
      setCart((current) => current.filter((item) => item.id !== id));
    },
    [setCart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setCoupon(undefined);
  }, [setCart, setCoupon]);

  const applyCartCoupon = useCallback(
    (code: string) => {
      const nextCoupon = applyCoupon(code, calculateTotals(cart).subtotal);
      setCoupon(nextCoupon);
      return nextCoupon;
    },
    [cart, setCoupon]
  );

  const clearCoupon = useCallback(() => setCoupon(undefined), [setCoupon]);

  const placeOrder = useCallback(
    (customer: CustomerInfo, notes: string) => {
      const order = createOrder({ existingOrdersCount: orders.length, customer, items: cart, coupon, notes });
      setOrders((current) => [...current, order]);
      setCart([]);
      setCoupon(undefined);
      return order;
    },
    [cart, coupon, orders.length, setCart, setCoupon, setOrders]
  );

  const saveContact = useCallback(
    (contact: ContactSubmission) => {
      setContacts((current) => [...current, contact]);
    },
    [setContacts]
  );

  const login = useCallback(
    (email: string, remembered: boolean, role?: AccountRole) => {
      setSession({ email, remembered, createdAt: new Date().toISOString() });
      if (role) saveRoleForEmail(email, role);
    },
    [saveRoleForEmail, setSession]
  );

  const logout = useCallback(() => setSession(undefined), [setSession]);

  const setAccountRole = useCallback(
    (role: AccountRole) => {
      if (!session) return;
      saveRoleForEmail(session.email, role);
    },
    [saveRoleForEmail, session]
  );

  const addChildAccount = useCallback(
    (child: { name: string; age: string; beltSlug: string }) => {
      if (!session) return undefined;
      const cleanedName = child.name.trim();
      if (!cleanedName) return undefined;
      const usernameBase = cleanedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const username = `${usernameBase || "student"}.child`;
      const createdChild: ChildAccount = {
        id: createPrototypeId("child"),
        parentEmail: session.email,
        name: cleanedName,
        username,
        age: child.age.trim(),
        beltSlug: child.beltSlug,
        createdAt: new Date().toISOString()
      };
      setChildAccounts((current) => [...current, createdChild]);
      saveRoleForEmail(username, "student");
      return createdChild;
    },
    [saveRoleForEmail, session, setChildAccounts]
  );

  const loginChildAccount = useCallback(
    (childId: string) => {
      const child = childAccounts.find((item) => item.id === childId);
      if (!child) return;
      saveRoleForEmail(child.username, "student");
      setSession({ email: child.username, remembered: true, createdAt: new Date().toISOString() });
    },
    [childAccounts, saveRoleForEmail, setSession]
  );

  const register = useCallback(
    (email: string) => {
      setAccounts((current) => (current.some((account) => account.email === email) ? current : [...current, { email, createdAt: new Date().toISOString() }]));
    },
    [setAccounts]
  );

  const addOperationsStudent = useCallback(
    (student: StudentInput) => {
      const normalizedStudent = normalizeStudentInput(student);
      if (!normalizedStudent) return undefined;
      const createdStudent: StudentRecord = {
        ...normalizedStudent,
        id: createPrototypeId("student"),
        classesAttended: 0,
        missedClassCount: 0
      };
      setStudents((current) => [createdStudent, ...current]);
      setMessageLogs((current) => [
        makeMessageLog({
          kind: "welcome",
          recipientName: studentFullName(createdStudent),
          recipientPhone: createdStudent.phone,
          body: welcomeTextForStudent(createdStudent)
        }),
        ...current
      ]);
      return createdStudent;
    },
    [setMessageLogs, setStudents]
  );

  const updateOperationsStudent = useCallback(
    (studentId: string, student: StudentInput) => {
      const existing = students.find((item) => item.id === studentId);
      if (!existing) return undefined;
      const normalizedStudent = normalizeStudentInput(student, existing.enrollmentDate || existing.joinedAt);
      if (!normalizedStudent) return undefined;
      const updatedStudent: StudentRecord = {
        ...existing,
        ...normalizedStudent
      };
      setStudents((current) => current.map((item) => (item.id === studentId ? updatedStudent : item)));
      return updatedStudent;
    },
    [setStudents, students]
  );

  const deleteOperationsStudent = useCallback(
    (studentId: string) => {
      const existing = students.find((item) => item.id === studentId);
      if (!existing) return undefined;
      setStudents((current) => current.filter((item) => item.id !== studentId));
      setScheduledClasses((current) => current.map((item) => (item.studentId === studentId ? { ...item, studentId: undefined } : item)));
      setCheckIns((current) => current.filter((item) => item.studentId !== studentId));
      setMessageLogs((current) => current.filter((item) => item.recipientPhone !== existing.phone));
      return existing;
    },
    [setCheckIns, setMessageLogs, setScheduledClasses, setStudents, students]
  );

  const addScheduledClass = useCallback(
    (scheduledClass: { title: string; date: string; time: string; type: string; recurring?: boolean; titleColor?: string; studentId?: string; notes?: string }) => {
      const title = scheduledClass.title.trim();
      const type = scheduledClass.type.trim();
      if (!title || !scheduledClass.date || !scheduledClass.time.trim() || !type) return undefined;
      const createdClass: ScheduledClass = {
        id: createPrototypeId("schedule"),
        title,
        date: scheduledClass.date,
        time: scheduledClass.time.trim(),
        type,
        recurring: scheduledClass.recurring || undefined,
        titleColor: scheduledClass.titleColor?.trim() || undefined,
        studentId: scheduledClass.studentId,
        notes: scheduledClass.notes?.trim()
      };
      setScheduledClasses((current) => [createdClass, ...current]);
      return createdClass;
    },
    [setScheduledClasses]
  );

  const cleanStudioClass = useCallback((studioClass: StudioClassInput) => {
    const name = studioClass.name.trim();
    const daysOfWeek = [...new Set(studioClass.daysOfWeek)].sort((left, right) => left - right) as StudioClass["daysOfWeek"];
    const startTime = studioClass.startTime.trim();
    const endTime = studioClass.endTime.trim();
    if (!name || !daysOfWeek.length || !startTime || !endTime || startTime >= endTime) return undefined;
    return {
      name,
      daysOfWeek,
      startTime,
      endTime,
      recurring: studioClass.recurring ?? true,
      titleColor: studioClass.titleColor?.trim() || undefined,
      notes: studioClass.notes?.trim()
    };
  }, []);

  const addStudioClass = useCallback(
    (studioClass: StudioClassInput) => {
      const cleaned = cleanStudioClass(studioClass);
      if (!cleaned) return undefined;
      const createdClass: StudioClass = {
        id: createPrototypeId("class"),
        ...cleaned
      };
      setStudioClasses((current) => [createdClass, ...current]);
      return createdClass;
    },
    [cleanStudioClass, setStudioClasses]
  );

  const updateStudioClass = useCallback(
    (classId: string, studioClass: StudioClassInput) => {
      const existing = studioClasses.find((item) => item.id === classId);
      if (!existing) return undefined;
      const cleaned = cleanStudioClass(studioClass);
      if (!cleaned) return undefined;
      const updatedClass: StudioClass = {
        ...existing,
        ...cleaned
      };
      setStudioClasses((current) => current.map((item) => (item.id === classId ? updatedClass : item)));
      return updatedClass;
    },
    [cleanStudioClass, setStudioClasses, studioClasses]
  );

  const deleteStudioClass = useCallback(
    (classId: string) => {
      const existing = studioClasses.find((item) => item.id === classId);
      if (!existing) return undefined;
      setStudioClasses((current) => current.filter((item) => item.id !== classId));
      return existing;
    },
    [setStudioClasses, studioClasses]
  );

  const addStudioEvent = useCallback(
    (event: { title: string; date: string; time: string; details: string; audience: StudioEvent["audience"] }) => {
      const title = event.title.trim();
      if (!title || !event.date || !event.time.trim()) return undefined;
      const createdEvent: StudioEvent = {
        id: createPrototypeId("event"),
        title,
        date: event.date,
        time: event.time.trim(),
        details: event.details.trim(),
        audience: event.audience
      };
      setStudioEvents((current) => [createdEvent, ...current]);
      return createdEvent;
    },
    [setStudioEvents]
  );

  const addMerchandiseItem = useCallback(
    (item: MerchandiseInput) => {
      const name = item.name.trim();
      const category = item.category.trim();
      if (!name || !category || !Number.isFinite(item.price) || !Number.isFinite(item.stock) || item.price < 0 || item.stock < 0) return undefined;
      const createdItem: MerchandiseItem = {
        id: createPrototypeId("merch"),
        name,
        category,
        price: item.price,
        stock: item.stock,
        description: item.description?.trim() || `${category} available for pickup at Cho's Martial Arts.`,
        imageLabel: category.toLowerCase(),
        imageDataUrl: item.imageDataUrl
      };
      setMerchandiseItems((current) => [createdItem, ...current]);
      return createdItem;
    },
    [setMerchandiseItems]
  );

  const updateMerchandiseItem = useCallback(
    (itemId: string, item: MerchandiseInput) => {
      const name = item.name.trim();
      const category = item.category.trim();
      if (!name || !category || !Number.isFinite(item.price) || !Number.isFinite(item.stock) || item.price < 0 || item.stock < 0) return undefined;
      let updatedItem: MerchandiseItem | undefined;
      setMerchandiseItems((current) =>
        current.map((currentItem) => {
          if (currentItem.id !== itemId) return currentItem;
          updatedItem = {
            ...currentItem,
            name,
            category,
            price: item.price,
            stock: item.stock,
            description: item.description?.trim() || `${category} available for pickup at Cho's Martial Arts.`,
            imageLabel: category.toLowerCase(),
            imageDataUrl: item.imageDataUrl
          };
          return updatedItem;
        })
      );
      return updatedItem;
    },
    [setMerchandiseItems]
  );

  const deleteMerchandiseItem = useCallback(
    (itemId: string) => {
      let deletedItem: MerchandiseItem | undefined;
      setMerchandiseItems((current) => {
        deletedItem = current.find((item) => item.id === itemId);
        return current.filter((item) => item.id !== itemId);
      });
      return deletedItem;
    },
    [setMerchandiseItems]
  );

  const recordStudentCheckIn = useCallback(
    (studentId: string) => {
      const student = students.find((item) => item.id === studentId);
      if (!student) return undefined;
      const checkInDate = todayStamp();
      const createdCheckIn: StudentCheckIn = {
        id: createPrototypeId("checkin"),
        studentId: student.id,
        studentName: studentFullName(student),
        date: checkInDate,
        beltRank: student.beltRank
      };
      setStudents((current) =>
        current.map((item) =>
          item.id === studentId
            ? {
                ...item,
                classesAttended: item.classesAttended + 1,
                missedClassCount: 0,
                lastCheckIn: checkInDate
              }
            : item
        )
      );
      setCheckIns((current) => [createdCheckIn, ...current]);
      return createdCheckIn;
    },
    [setCheckIns, setStudents, students]
  );

  const sendMissedClassFollowUps = useCallback(() => {
    const targets = students.filter((student) => student.missedClassCount >= 3 && student.phone.trim());
    if (!targets.length) return 0;
    const logs = targets.map((student) =>
      makeMessageLog({
        kind: "follow-up",
        recipientName: studentFullName(student),
        recipientPhone: student.phone,
        body: missedClassTextForStudent(student)
      })
    );
    setMessageLogs((current) => [...logs, ...current]);
    setStudents((current) => current.map((student) => (student.missedClassCount >= 3 ? { ...student, lastContactedAt: todayStamp() } : student)));
    return logs.length;
  }, [setMessageLogs, setStudents, students]);

  const sendMarketingBlast = useCallback(
    (body: string) => {
      const cleanBody = body.trim();
      if (!cleanBody) return 0;
      const campaign: MessageCampaign = {
        id: createPrototypeId("campaign"),
        title: "Marketing blast",
        body: cleanBody,
        audience: "all-students",
        createdAt: new Date().toISOString()
      };
      const logs = students
        .filter((student) => student.phone.trim())
        .map((student) =>
          makeMessageLog({
            kind: "marketing",
            recipientName: studentFullName(student),
            recipientPhone: student.phone,
            body: cleanBody,
            campaignId: campaign.id
          })
        );
      setMessageCampaigns((current) => [campaign, ...current]);
      setMessageLogs((current) => [...logs, ...current]);
      return logs.length;
    },
    [setMessageCampaigns, setMessageLogs, students]
  );

  const sendDirectMessage = useCallback(
    (message: { senderId: string; senderName: string; recipientId: string; recipientName: string; body: string }) => {
      const body = message.body.trim();
      if (!message.senderId || !message.recipientId || message.senderId === message.recipientId || !body) return undefined;
      const threadId = [message.senderId, message.recipientId].sort().join("__");
      const createdMessage: DirectMessage = {
        id: createPrototypeId("direct"),
        threadId,
        senderId: message.senderId,
        senderName: message.senderName.trim() || "Cho's User",
        recipientId: message.recipientId,
        recipientName: message.recipientName.trim() || "Cho's User",
        body,
        createdAt: new Date().toISOString(),
        status: "sent"
      };
      setDirectMessages((current) => [...current, createdMessage]);
      return createdMessage;
    },
    [setDirectMessages]
  );

  const value: AppState = {
    cart,
    coupon,
    totals,
    orders,
    bookings,
    contacts,
    session,
    accountRole,
    accounts,
    guardianChildren,
    students,
    studioClasses,
    scheduledClasses,
    messageCampaigns,
    messageLogs,
    directMessages,
    studioEvents,
    merchandiseItems,
    checkIns,
    toasts,
    showToast,
    dismissToast,
    addProductToCart,
    addBookingToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    applyCartCoupon,
    clearCoupon,
    placeOrder,
    saveBooking,
    saveContact,
    login,
    loginChildAccount,
    logout,
    register,
    setAccountRole,
    addChildAccount,
    addOperationsStudent,
    updateOperationsStudent,
    deleteOperationsStudent,
    addStudioClass,
    updateStudioClass,
    deleteStudioClass,
    addScheduledClass,
    addStudioEvent,
    addMerchandiseItem,
    updateMerchandiseItem,
    deleteMerchandiseItem,
    recordStudentCheckIn,
    sendMissedClassFollowUps,
    sendMarketingBlast,
    sendDirectMessage
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const value = useContext(Context);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}
