export type RoutePath =
  | "/"
  | "/about-us"
  | "/programs"
  | "/private-lessons"
  | "/classes"
  | "/shop"
  | "/cart"
  | "/checkout"
  | "/my-account"
  | "/contact-us"
  | "/terms-and-conditions";

export interface Program {
  slug: string;
  title: string;
  shortDescription: string;
  detail: string;
  imageAlt: string;
}

export interface Benefit {
  title: string;
  summary: string;
  detail: string;
}

export interface Instructor {
  name: string;
  role: string;
  highlights: string[];
  bio: string;
  imageAlt: string;
}

export interface Testimonial {
  name: string;
  excerpt: string;
}

export interface ProductCategory {
  slug: string;
  name: string;
  productSlugs: string[];
}

export interface Product {
  slug: string;
  name: string;
  categories: string[];
  price: number;
  displayPrice: string;
  type?: "product" | "booking";
  description: string;
  sku: string;
  imageAlt: string;
  relatedSlugs: string[];
}

export interface ClassRule {
  id: string;
  title: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  description: string;
  ageNote?: string;
}

export interface ClassEvent {
  id: string;
  ruleId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  ageNote?: string;
}

export interface TermSection {
  title: string;
  content: string;
}

export interface BeltRank {
  slug: string;
  name: string;
  color: string;
  textColor: string;
  level: string;
  focus: string;
  meaning: string;
  classesRequired: number;
}

export interface BeltReadinessItem {
  id: string;
  label: string;
  detail: string;
}

export interface CartItem {
  id: string;
  productSlug: string;
  name: string;
  unitPrice: number;
  displayPrice: string;
  quantity: number;
  booking?: BookingDetails;
}

export interface BookingDetails {
  persons: number;
  date: string;
  time: string;
  timezone: "America/Chicago";
}

export interface Coupon {
  code: string;
  amount: number;
  valid: boolean;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  coupon?: Coupon;
  notes: string;
  pickupOption: string;
  status: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
}

export interface AccountSession {
  email: string;
  remembered: boolean;
  createdAt: string;
}

export interface SearchResult {
  title: string;
  subtitle: string;
  path: string;
  type: string;
}
