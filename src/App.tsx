import {
  ArrowLeft,
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Home,
  Lock,
  Mail,
  MapPin,
  Menu,
  Minus,
  Package,
  Pause,
  Phone,
  Play,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Target,
  Trash2,
  User,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  apartCards,
  beltRanks,
  beltReadinessItems,
  benefits,
  categories,
  getCategory,
  getProduct,
  getProductsForCategory,
  instructors,
  moreTopics,
  navLinks,
  parentTopics,
  products,
  programs,
  studio,
  studentTopics,
  termsSections,
  testimonials
} from "./data";
import { useAppState } from "./state";
import type { ClassEvent, Product } from "./types";
import {
  displayDate,
  downloadTextFile,
  formatMoney,
  createGuestSession,
  generateClassEvents,
  generateIcs,
  getInitialLaunchPhase,
  getLoginGateState,
  groupEventsByDate,
  makeContactSubmission,
  monthKey,
  searchSite,
  todayIso,
  validateCheckoutForm,
  validateContactForm,
  validateEmail,
  validateLoginForm,
  validateRegisterForm
} from "./utils";

const demoEvents = generateClassEvents();
const starterTimes = ["12:30 PM", "1:30 PM", "2:30 PM", "3:30 PM"];
const appTopicIcons: Record<string, typeof Target> = {
  today: Home,
  programs: Target,
  classes: CalendarDays,
  "private-lessons": Clock,
  shop: Package,
  progress: Award,
  practice: Target,
  orders: ShoppingCart,
  bookings: CheckCircle2,
  profile: User,
  help: Mail,
  contact: Mail,
  terms: ShieldCheck,
  about: ShieldCheck
};

function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

interface ProfileSettings {
  name: string;
  email: string;
  phone: string;
  updates: boolean;
}

interface StudentProgressSettings {
  currentBeltSlug: string;
  classesAttended: number;
  completedRequirementIds: string[];
  lastPromotionDate: string;
  trainingGoal: string;
}

const studentProgressStorageKey = "chos.studentProgress.v1";
const defaultStudentProgress: StudentProgressSettings = {
  currentBeltSlug: "green",
  classesAttended: 24,
  completedRequirementIds: ["attendance", "basics", "forms"],
  lastPromotionDate: "2026-04-15",
  trainingGoal: "Earn Blue Belt"
};

function loadStudentProgress(): StudentProgressSettings {
  if (typeof window === "undefined") return defaultStudentProgress;
  try {
    const saved = window.localStorage.getItem(studentProgressStorageKey);
    if (!saved) return defaultStudentProgress;
    const parsed = JSON.parse(saved) as Partial<StudentProgressSettings>;
    return {
      ...defaultStudentProgress,
      ...parsed,
      completedRequirementIds: Array.isArray(parsed.completedRequirementIds) ? parsed.completedRequirementIds : defaultStudentProgress.completedRequirementIds
    };
  } catch {
    return defaultStudentProgress;
  }
}

function App() {
  const { session } = useAppState();
  const [launchComplete, setLaunchComplete] = useState(false);
  const [loginReveal, setLoginReveal] = useState(false);
  const revealLogin = useCallback(() => setLoginReveal(true), []);
  const completeLaunch = useCallback(() => {
    setLoginReveal(true);
    setLaunchComplete(true);
  }, []);

  if (getLoginGateState(session) === "login") {
    return (
      <>
        <div className="auth-gate" data-testid="auth-gate">
          <AuthLaunchLogo animating={!launchComplete} />
          <LoginLandingPage visible={true} handoffActive={!launchComplete} />
          {!launchComplete && <LaunchLogoAnimation onReveal={revealLogin} onComplete={completeLaunch} />}
        </div>
        <ToastViewport />
      </>
    );
  }

  return (
    <>
      <Shell>
        <Routes>
          <Route path="/" element={<AppLauncherPage />} />
          <Route path="/more" element={<MoreMenuPage />} />
          <Route path="/about-us" element={<AboutPage />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/private-lessons" element={<PrivateLessonsPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/category/:categorySlug" element={<ShopPage />} />
          <Route path="/product/:productSlug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/my-account" element={<AccountPage />} />
          <Route path="/contact-us" element={<ContactPage />} />
          <Route path="/terms-and-conditions" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Shell>
      <ToastViewport />
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { cart, session } = useAppState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 420);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <button className="icon-button app-menu-button" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <Menu size={22} />
            </button>
          </div>
          <Link className="chos-menu-link" to="/more" aria-label="Cho's menu">
            <img src={publicAsset("682e95109aa21_chos-logo.png")} alt="" aria-hidden="true" />
          </Link>
          <div className="header-actions">
            <button className="icon-button" aria-label="Search site" onClick={() => setSearchOpen(true)}>
              <Search size={20} />
            </button>
            <Link className="icon-button cart-button" to="/cart" aria-label={`Cart with ${cartCount} items`}>
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </Link>
            {session && (
              <NavLink className={({ isActive }) => `profile-button ${isActive ? "active" : ""}`} to="/my-account?topic=profile" aria-label="Open profile settings">
                <User size={18} />
                <span>Profile</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {drawerOpen && <MobileDrawer onClose={() => setDrawerOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      {session && <AppPageNavigation onBack={() => navigate(-1)} onForward={() => navigate(1)} />}

      <main>{children}</main>

      {session ? <StudentHelpStrip /> : <Footer />}

      {showTop && (
        <button className="scroll-top" aria-label="Scroll to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowLeft size={18} className="rotate-up" />
        </button>
      )}

    </>
  );
}

function AppPageNavigation({ onBack, onForward }: { onBack: () => void; onForward: () => void }) {
  return (
    <nav className="app-page-navigation" aria-label="App page navigation">
      <button type="button" className="app-nav-control" aria-label="Go back" onClick={onBack}>
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>
      <Link className="app-nav-home" to="/">
        <Home size={18} />
        <span>Student Home</span>
      </Link>
      <button type="button" className="app-nav-control" aria-label="Go forward" onClick={onForward}>
        <span>Forward</span>
        <ArrowRight size={18} />
      </button>
    </nav>
  );
}

interface StudentPageAction {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

function StudentAppPage({ title, text, action, children, className = "" }: { title: string; text: string; action?: StudentPageAction; children: ReactNode; className?: string }) {
  const actionContent = action && (
    <>
      {action.icon}
      <span>{action.label}</span>
    </>
  );

  return (
    <section className={`section student-app-page ${className}`} aria-label={`${title} app page`}>
      <div className="student-page-header">
        <div>
          <p className="eyebrow">Student App</p>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
        {action?.to && (
          <Link className="btn btn-red student-page-action" to={action.to}>
            {actionContent}
          </Link>
        )}
        {action?.href && (
          <a className="btn btn-red student-page-action" href={action.href}>
            {actionContent}
          </a>
        )}
        {action?.onClick && (
          <button className="btn btn-red student-page-action" type="button" onClick={action.onClick}>
            {actionContent}
          </button>
        )}
      </div>
      <div className="student-page-body">{children}</div>
    </section>
  );
}

function ToastViewport() {
  const { toasts, dismissToast } = useAppState();
  return (
    <div className="toast-stack" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              onClick={() => {
                toast.onAction?.();
                dismissToast(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function AuthLaunchLogo({ animating }: { animating: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <img
      className={`auth-logo ${animating && !prefersReducedMotion ? "is-animating" : "is-settled"}`}
      src={publicAsset("682e95109aa21_chos-logo.png")}
      alt="Cho's Martial Arts"
    />
  );
}

function LaunchLogoAnimation({ onReveal, onComplete }: { onReveal: () => void; onComplete: () => void }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase] = useState(() => getInitialLaunchPhase(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const [frameIndex, setFrameIndex] = useState(0);
  const frameCount = 60;
  const loaderDuration = phase === "final-logo" || prefersReducedMotion ? 950 : 4550;
  const revealDelay = phase === "final-logo" || prefersReducedMotion ? 80 : 2360;
  const fighterDuration = 1850;
  const frameSrc = `${publicAsset(`roundhouse-frames/frame-${String(frameIndex).padStart(2, "0")}.png`)}?v=clean-no-lines-2`;

  useEffect(() => {
    const imageSources = [
      ...Array.from({ length: frameCount }, (_, index) => `${publicAsset(`roundhouse-frames/frame-${String(index).padStart(2, "0")}.png`)}?v=clean-no-lines-2`),
      publicAsset("682e95109aa21_chos-logo.png")
    ];
    imageSources.forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || phase === "final-logo") {
      const revealTimer = window.setTimeout(onReveal, revealDelay);
      const timer = window.setTimeout(onComplete, loaderDuration);
      return () => {
        window.clearTimeout(revealTimer);
        window.clearTimeout(timer);
      };
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    const render = (now: number) => {
      const elapsed = Math.max(0, now - startedAt);
      const fighterElapsed = Math.min(elapsed, fighterDuration);
      setFrameIndex(Math.min(frameCount - 1, Math.floor((fighterElapsed / fighterDuration) * (frameCount - 1))));
      if (elapsed < loaderDuration) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };
    animationFrame = window.requestAnimationFrame(render);
    const revealTimer = window.setTimeout(onReveal, revealDelay);
    const timer = window.setTimeout(onComplete, loaderDuration);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(revealTimer);
      window.clearTimeout(timer);
    };
  }, [fighterDuration, loaderDuration, onComplete, onReveal, phase, prefersReducedMotion, revealDelay]);

  return (
    <section className={`launch-loader ${prefersReducedMotion || phase === "final-logo" ? "is-reduced" : "is-playing"}`} aria-label="Cho's Martial Arts loading animation">
      <div className="launch-screen-backdrop"></div>
      <div className="launch-stage" aria-hidden="true">
        <div className="launch-stage-haze"></div>
        <div className="launch-floor-glow"></div>
        {!prefersReducedMotion && phase !== "final-logo" && <img className="launch-fighter-frame" src={frameSrc} alt="" />}
        <div className="launch-impact-flash"></div>
        <div className="launch-logo-aura"></div>
        <div className="launch-letter-sparks"></div>
      </div>
    </section>
  );
}

function LoginLandingPage({ visible, handoffActive = false }: { visible: boolean; handoffActive?: boolean }) {
  const { login, register, showToast } = useAppState();
  const navigate = useNavigate();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const loginLandingStyle = { "--login-bg-image": `url("${publicAsset("NewFinalBackground.png")}")` } as CSSProperties;

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateLoginForm(loginForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Enter a username and password.");
      return;
    }
    login(loginForm.username, true);
    showToast("Signed in to Cho's prototype.");
    navigate("/");
  };

  const submitRegister = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateRegisterForm(registerForm);
    setRegisterErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Check the create account fields.");
      return;
    }
    register(registerForm.email);
    login(registerForm.email, true);
    showToast("Prototype account created.");
    navigate("/");
  };

  const guest = () => {
    const guestSession = createGuestSession();
    login(guestSession.email, guestSession.remembered);
    showToast("Signed in as guest.");
    navigate("/");
  };

  return (
    <section className={`login-landing ${visible ? "is-visible" : ""} ${handoffActive ? "is-handoff" : ""}`} style={loginLandingStyle} aria-label="Cho's Martial Arts login">
      <div className="login-scrim"></div>
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={submitLogin}>
          <label className="login-field">
            <User size={34} aria-hidden="true" />
            <span className="sr-only">Username</span>
            <input
              autoComplete="username"
              placeholder="Username"
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
            />
          </label>
          {errors.username && <p className="login-error">{errors.username}</p>}
          <label className="login-field">
            <Lock size={32} aria-hidden="true" />
            <span className="sr-only">Password</span>
            <input
              autoComplete="current-password"
              placeholder="Password"
              type={passwordVisible ? "text" : "password"}
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            />
            <button className="login-field-action" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={32} /> : <Eye size={32} />}
            </button>
          </label>
          {errors.password && <p className="login-error">{errors.password}</p>}
          <button className="login-submit" type="submit">
            Sign In
          </button>
          <button className="login-create" type="button" onClick={() => setRegisterOpen(true)}>
            Create New Account
          </button>
          <button className="login-guest" type="button" onClick={guest}>
            Sign in as Guest
          </button>
        </form>
        <div className="login-divider" aria-hidden="true">
          <span></span>
          <span className="yin-yang">☯</span>
          <span></span>
        </div>
      </div>
      {registerOpen && (
        <ModalShell label="Create New Account" onClose={() => setRegisterOpen(false)} panelClass="modal-card login-register-modal">
          <div className="drawer-head">
            <h2>Create New Account</h2>
            <button className="icon-button" aria-label="Close create account" onClick={() => setRegisterOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <form className="modal-form" onSubmit={submitRegister}>
            <Field label="Email address" error={registerErrors.email}>
              <input className="input" autoComplete="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} />
            </Field>
            <Field label="Password" error={registerErrors.password}>
              <input className="input" type="password" autoComplete="new-password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} />
            </Field>
            <p className="muted">This creates a local prototype account only.</p>
            <button className="btn btn-red" type="submit">
              Create Account
            </button>
          </form>
        </ModalShell>
      )}
    </section>
  );
}

function MobileDrawer({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell label="Mobile navigation" onClose={onClose} panelClass="drawer-panel">
      <div className="drawer-head">
        <strong>Cho&apos;s Martial Arts</strong>
        <button className="icon-button" aria-label="Close menu" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <nav className="drawer-nav" aria-label="Mobile navigation">
        <span className="drawer-section-label">Student</span>
        {studentTopics.map((topic) => (
          <Link key={topic.slug} to={topic.path} onClick={onClose}>
            {topic.label}
          </Link>
        ))}
        <span className="drawer-section-label">Grown-ups</span>
        {parentTopics.map((topic) => (
          <Link key={topic.slug} to={topic.path} onClick={onClose}>
            {topic.label}
          </Link>
        ))}
      </nav>
      <h3>Quick Links</h3>
      <div className="chip-list">
        {["/private-lessons", "/about-us", "/cart", "/terms-and-conditions"].map((path) => (
          <Link key={path} to={path} onClick={onClose} className="chip">
            {path.replace("/", "").replace("?topic=", " ").replaceAll("-", " ") || "home"}
          </Link>
        ))}
      </div>
      <h3>Product Categories</h3>
      <div className="drawer-category-list">
        {categories.map((category) => (
          <Link key={category.slug} to={`/shop/category/${category.slug}`} onClick={onClose}>
            {category.name}
          </Link>
        ))}
      </div>
    </ModalShell>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchSite(query), [query]);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <ModalShell label="Search site" onClose={onClose} panelClass="search-panel">
      <div className="drawer-head">
        <strong>Search Cho&apos;s</strong>
        <button className="icon-button" aria-label="Close search" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <label className="field-label" htmlFor="site-search">
        Search pages, programs, classes, instructors, products, and terms
      </label>
      <input id="site-search" ref={inputRef} className="input large-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try starter, gloves, Major Artis..." />
      <div className="search-results">
        {query && results.length === 0 && <p className="muted">No prototype results found.</p>}
        {results.map((result) => (
          <button
            className="search-result"
            key={`${result.type}-${result.title}`}
            onClick={() => {
              navigate(result.path);
              onClose();
            }}
          >
            <span>{result.type}</span>
            <strong>{result.title}</strong>
            <small>{result.subtitle}</small>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function Footer() {
  const quickLinks = [
    ["/cart", "Cart"],
    ["/checkout", "Checkout"],
    ["/my-account", "My Account"],
    ["/terms-and-conditions", "Terms and Conditions"]
  ];
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <h2>Cho&apos;s Martial Arts</h2>
          <p>{studio.address}</p>
          <a href={studio.phoneHref}>{studio.phone}</a>
          <div className="social-row">
            <a href={studio.facebookUrl} target="_blank" rel="noreferrer">
              Facebook <ExternalLink size={14} />
            </a>
            <a href={studio.yelpUrl} target="_blank" rel="noreferrer">
              Yelp <ExternalLink size={14} />
            </a>
            <a href={studio.instagramUrl} target="_blank" rel="noreferrer">
              Instagram <ExternalLink size={14} />
            </a>
          </div>
        </div>
        <div>
          <h3>Site Links</h3>
          {navLinks.map((link) => (
            <Link key={link.path} to={link.path}>
              {link.label}
            </Link>
          ))}
        </div>
        <div>
          <h3>Quick Links</h3>
          {quickLinks.map(([path, label]) => (
            <Link key={path} to={path}>
              {label}
            </Link>
          ))}
        </div>
        <div>
          <h3>Categories</h3>
          {categories.map((category) => (
            <Link key={category.slug} to={`/shop/category/${category.slug}`}>
              {category.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026, Cho&apos;s Martial Arts. All Rights Reserved.</span>
        <button className="text-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Scroll to Top
        </button>
      </div>
    </footer>
  );
}

function StudentHelpStrip() {
  return (
    <footer className="student-help-strip" aria-label="Student help">
      <div>
        <strong>Need help?</strong>
        <span>Ask a grown-up or contact Cho&apos;s.</span>
      </div>
      <div className="student-help-actions">
        <Link to="/contact-us">Ask for Help</Link>
        <a href={studio.phoneHref}>{studio.phone}</a>
      </div>
    </footer>
  );
}

function MobileTabBar({ cartCount }: { cartCount: number }) {
  const tabs = [
    { path: "/", label: "Home", icon: Home },
    { path: "/classes", label: "Classes", icon: CalendarDays },
    { path: "/shop", label: "Shop", icon: Package },
    { path: "/cart", label: "Cart", icon: ShoppingCart, count: cartCount },
    { path: "/contact-us", label: "Contact", icon: Mail }
  ];
  return (
    <nav className="mobile-tabbar" aria-label="Mobile tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink key={tab.path} to={tab.path} className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="tab-icon">
              <Icon size={18} />
              {tab.count ? <small>{tab.count}</small> : null}
            </span>
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function AppLauncherPage() {
  const { session, orders, bookings } = useAppState();
  const nextClass = demoEvents.find((event) => event.date >= todayIso()) ?? demoEvents[0];
  const displayName = session?.email.split("@")[0] || "student";
  const progress = loadStudentProgress();
  const currentBeltIndex = Math.max(0, beltRanks.findIndex((rank) => rank.slug === progress.currentBeltSlug));
  const currentBelt = beltRanks[currentBeltIndex] ?? beltRanks[0];
  const nextBelt = beltRanks[currentBeltIndex + 1];
  const nextGoal = nextBelt ? `${nextBelt.name} Belt` : "Black Belt training";

  return (
    <section className="section app-launcher-page student-home-page">
      <div className="launcher-shell">
        <div className="student-home-head">
          <div>
            <p className="eyebrow">Cho&apos;s Martial Arts</p>
            <h1>Student Home</h1>
            <p>Hi, {displayName}. Pick one big button and keep moving.</p>
          </div>
          <img src={publicAsset("682e95109aa21_chos-logo.png")} alt="Cho's Martial Arts" />
        </div>

        <section className="student-today-panel" aria-label="Today at Cho's">
          <div>
            <span className="student-today-icon" aria-hidden="true">
              <CalendarDays size={30} />
            </span>
            <div>
              <p className="eyebrow">Today</p>
              <h2>{nextClass ? nextClass.title : "Check your class plan"}</h2>
              <p>{nextClass ? `${displayDate(nextClass.date)} at ${nextClass.startTime}` : "Open classes to see what is next."}</p>
            </div>
          </div>
          <div className="student-today-stats">
            <div>
              <span>Current belt</span>
              <strong>{currentBelt.name}</strong>
            </div>
            <div>
              <span>Next goal</span>
              <strong>{nextGoal}</strong>
            </div>
          </div>
          <Link className="btn btn-red" to="/classes">
            View Classes
          </Link>
        </section>

        <nav className="app-topic-grid student-topic-grid" aria-label="Student actions">
          {studentTopics.map((topic) => {
            const TopicIcon = appTopicIcons[topic.slug] ?? Target;
            return (
              <Link className={`app-topic-tile tone-${topic.tone}`} key={topic.slug} to={topic.path} aria-label={topic.label}>
                <span className="app-topic-icon" aria-hidden="true">
                  <TopicIcon size={28} />
                </span>
                <strong>{topic.label}</strong>
                <small>{topic.summary}</small>
              </Link>
            );
          })}
        </nav>

        <section className="parent-topic-section">
          <div>
            <p className="eyebrow">Grown-ups</p>
            <h2>Parent and Account</h2>
          </div>
          <nav className="parent-topic-row" aria-label="Parent and account actions">
            {parentTopics.map((topic) => {
              const TopicIcon = appTopicIcons[topic.slug] ?? Target;
              const badge = topic.slug === "orders" ? orders.length : topic.slug === "bookings" ? bookings.length : undefined;
              return (
                <Link className={`parent-topic-pill tone-${topic.tone}`} key={topic.slug} to={topic.path} aria-label={topic.label}>
                  <TopicIcon size={18} />
                  <span>{topic.label}</span>
                  {typeof badge === "number" && <small>{badge}</small>}
                </Link>
              );
            })}
          </nav>
        </section>
      </div>
    </section>
  );
}

function MoreMenuPage() {
  return (
    <StudentAppPage
      title="Cho's Menu"
      text="Everything outside student practice and progress lives here."
      action={{ label: "Student Home", to: "/", icon: <Home size={18} /> }}
      className="more-menu-page"
    >
      <nav className="more-menu-grid" aria-label="Cho's non-student links">
        {moreTopics.map((topic) => {
          const TopicIcon = appTopicIcons[topic.slug] ?? Target;
          return (
            <Link className={`more-menu-card tone-${topic.tone}`} key={topic.slug} to={topic.path} aria-label={topic.label}>
              <span className="more-menu-icon" aria-hidden="true">
                <TopicIcon size={24} />
              </span>
              <span>
                <strong>{topic.label}</strong>
                <small>{topic.summary}</small>
              </span>
            </Link>
          );
        })}
      </nav>
    </StudentAppPage>
  );
}

function HomePage() {
  const [activeProgram, setActiveProgram] = useState<(typeof programs)[number] | null>(null);
  const [openApart, setOpenApart] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <section className="hero app-band">
        <div className="hero-copy">
          <p className="eyebrow">Menomonee Falls martial arts studio</p>
          <h1>Train Like a Fighter, Live Like a Champion</h1>
          <p>Build Your Self-Confidence Through Expert Martial Arts Training in Taekwondo, Kickboxing, MMA, Etc.</p>
          <div className="button-row">
            <button className="btn btn-red" onClick={() => navigate("/product/starter-program?focus=booking")}>
              Sign Up to Train With Us
            </button>
            <Link className="btn btn-gold" to="/shop">
              Shop Now
            </Link>
            <Link className="btn btn-ghost" to="/classes">
              View Class Info
            </Link>
            <Link className="btn btn-ghost" to="/contact-us">
              Get in Touch
            </Link>
          </div>
        </div>
        <ImagePanel label="Disciplined dojo training" alt="Dojo with martial artists training under dramatic studio lighting" tone="hero" />
      </section>

      <section className="section">
        <SectionHeader eyebrow="Programs" title="What We Teach" text="Pricing varies, from $98 to $128 depending on which classes are chosen." />
        <div className="card-grid four">
          {programs.map((program) => (
            <article className="feature-card clickable" key={program.slug} onClick={() => setActiveProgram(program)}>
              <ImagePanel label={program.title} alt={program.imageAlt} tone={program.slug} compact />
              <h3>{program.title}</h3>
              <p>{program.shortDescription}</p>
              <button
                className="btn btn-small btn-dark"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/programs?program=${program.slug}`);
                }}
              >
                Explore Program
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section split">
        <div>
          <SectionHeader eyebrow="Standards" title="What Sets Cho's Martial Arts in Menomonee Falls Apart?" />
          <div className="accordion-list">
            {apartCards.map((card, index) => (
              <Accordion key={card.title} title={card.title} open={openApart === index} onToggle={() => setOpenApart(openApart === index ? -1 : index)}>
                {card.content}
              </Accordion>
            ))}
          </div>
        </div>
        <ImagePanel label="Focused sparring" alt="Martial artists in protective gear practicing controlled sparring" tone="sparring" />
      </section>

      <section className="section info-panel">
        <SectionHeader title="Customized Martial Arts Training for All" />
        <ul className="check-list">
          <li>Ideal for individuals, Girl/Boy Scouts, daycare classes, and workplace seminars.</li>
          <li>Handpicked masters uphold Grandmaster Cho&apos;s philosophy.</li>
          <li>Great Grandmaster&apos;s son Ung Cho continues the family tradition.</li>
          <li>Each master has 20+ years of experience and a championship title.</li>
        </ul>
        <Link className="btn btn-red" to="/about-us">
          Get to Know Our Trainers
        </Link>
      </section>

      <section className="section split reverse">
        <ImagePanel label="Family training" alt="Adults and youth students training together in uniforms" tone="family" />
        <div>
          <SectionHeader title="Classes for All Age Groups" />
          <p>Adult classes blend practical martial arts with full-body conditioning, speed, coordination, flexibility, and lifelong fitness.</p>
          <p>Youth classes help students build discipline, confidence, coordination, focus, and respectful habits.</p>
          <Link className="btn btn-dark" to="/classes">
            View Class Calendar
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="video-card">
          <div>
            <p className="eyebrow">Training highlight</p>
            <h2>See the energy inside Cho&apos;s</h2>
            <p>Watch a mock preview of forms, bag work, youth leadership, and controlled sparring.</p>
          </div>
          <button className="btn btn-gold" onClick={() => setVideoOpen(true)}>
            <Play size={18} /> Play Video
          </button>
        </div>
      </section>

      <section className="section cta-band">
        <h2>Let&apos;s Connect</h2>
        <p>Questions about youth classes, private lessons, or the starter program?</p>
        <Link className="btn btn-red" to="/contact-us">
          Get in Touch
        </Link>
      </section>

      <TestimonialsCarousel />
      {activeProgram && (
        <InfoModal title={activeProgram.title} onClose={() => setActiveProgram(null)}>
          <p>{activeProgram.detail}</p>
          <Link className="btn btn-red" to={`/programs?program=${activeProgram.slug}`}>
            Explore Program
          </Link>
        </InfoModal>
      )}
      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}
    </>
  );
}

function TestimonialsCarousel() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const { showToast } = useAppState();
  const testimonial = testimonials[index];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % testimonials.length), 4500);
    return () => window.clearInterval(timer);
  }, [playing]);

  const next = () => setIndex((current) => (current + 1) % testimonials.length);
  const previous = () => setIndex((current) => (current - 1 + testimonials.length) % testimonials.length);

  return (
    <section className="section">
      <div className="testimonial-shell">
        <div className="rating-block">
          <div className="stars" aria-label="4.9 out of 5 stars">
            {Array.from({ length: 5 }).map((_, star) => (
              <Star key={star} size={20} fill="currentColor" />
            ))}
          </div>
          <h2>4.9 powered by Google</h2>
          <button
            className="btn btn-dark"
            onClick={() => {
              window.open(studio.reviewUrl, "_blank", "noopener,noreferrer");
              showToast("Opening Google review page.");
            }}
          >
            Review Us
          </button>
        </div>
        <article className="testimonial-card">
          <p>“{testimonial.excerpt}”</p>
          <strong>{testimonial.name}</strong>
          <div className="carousel-controls">
            <button className="icon-button" aria-label="Previous review" onClick={previous}>
              <ArrowLeft size={18} />
            </button>
            <button className="icon-button" aria-label={playing ? "Pause reviews" : "Play reviews"} onClick={() => setPlaying(!playing)}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="icon-button" aria-label="Next review" onClick={next}>
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="dots">
            {testimonials.map((item, dotIndex) => (
              <button key={item.name} aria-label={`Show review ${dotIndex + 1}`} className={dotIndex === index ? "active" : ""} onClick={() => setIndex(dotIndex)} />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function AboutPage() {
  const [expanded, setExpanded] = useState<string | null>(instructors[0].name);
  const [slide, setSlide] = useState(0);
  const { showToast } = useAppState();
  const videoSlides = ["Forms practice", "Kids leadership", "Sparring rhythm"];

  return (
    <>
      <PageHero title="Where Tradition Meets Excellence" text="Cho's Martial Arts blends dedication and tradition to achieve martial excellence. We cultivate a community built on respect, discipline, and physical fitness." imageAlt="Great Grandmaster and instructors inside a martial arts studio" />
      <section className="section split">
        <div>
          <SectionHeader title="Our Founder" />
          <p>
            Great Grandmaster Chom Son Cho built a legacy of martial arts excellence. He trained from a young age, became an undefeated Heavyweight Champion winning over 250 matches from 1950 to 1972, trained elite police forces, the U.S. Army, and Green Berets, and was named International Grand Master Instructor by the WTF.
          </p>
          <p>
            A pioneer of Jidokwan known for the spin kick and Taekwondo innovations, he founded the Milwaukee school in 1973 and produced over 4,000 black belts, 500 champions, and 50 Master Instructors.
          </p>
        </div>
        <ImagePanel label="Great Grandmaster Chom Son Cho" alt="Founder portrait style panel for Great Grandmaster Chom Son Cho" tone="founder" />
      </section>
      <section className="section">
        <SectionHeader title="Achievements and Legacy" />
        <div className="card-grid five">
          {["9th-Degree Black Belt", "Undefeated Korean and Japanese Champion in Over 250 Matches", "Created Over 500 Champions and 50 Master Instructors", "International Master Instructor", "Member of the United States Olympic Committee"].map((achievement) => (
            <div className="stat-card" key={achievement}>
              <ShieldCheck />
              <strong>{achievement}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <SectionHeader title="Our Instructors" />
        <div className="card-grid instructor-grid">
          {instructors.map((instructor) => (
            <article className="profile-card" key={instructor.name}>
              <ImagePanel label={instructor.name} alt={instructor.imageAlt} compact tone="profile" />
              <h3>{instructor.name}</h3>
              <p className="eyebrow">{instructor.role}</p>
              <ul>
                {instructor.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
              <button className="btn btn-small btn-dark" onClick={() => setExpanded(expanded === instructor.name ? null : instructor.name)}>
                {expanded === instructor.name ? "Hide Bio" : "Read Bio"}
              </button>
              {expanded === instructor.name && <p className="bio">{instructor.bio}</p>}
            </article>
          ))}
        </div>
      </section>
      <section className="section info-panel">
        <SectionHeader title="Youth Leadership Team Training" />
        <ul className="check-list">
          <li>Team demonstrations.</li>
          <li>Peer mentorship and student support.</li>
          <li>Respect and anti-bullying education.</li>
          <li>Advanced techniques and competition training.</li>
        </ul>
      </section>
      <section className="section">
        <SectionHeader title="Video Highlights" />
        <div className="video-carousel">
          <button className="icon-button" aria-label="Previous video" onClick={() => setSlide((slide - 1 + videoSlides.length) % videoSlides.length)}>
            <ArrowLeft />
          </button>
          <ImagePanel label={videoSlides[slide]} alt={`${videoSlides[slide]} highlight video placeholder`} tone="video" />
          <button className="icon-button" aria-label="Next video" onClick={() => setSlide((slide + 1) % videoSlides.length)}>
            <ArrowRight />
          </button>
        </div>
        <button className="btn btn-gold" onClick={() => showToast(`Playing ${videoSlides[slide]} highlight in prototype mode.`)}>
          <Play size={18} /> Play Highlight
        </button>
      </section>
      <section className="section cta-band">
        <h2>Ready to compare programs?</h2>
        <Link className="btn btn-red" to="/programs">
          See Our Programs
        </Link>
      </section>
    </>
  );
}

function ProgramsPage() {
  const [params] = useSearchParams();
  const programFocus = params.get("program");
  const practiceFocused = params.get("section") === "practice";
  const [programDetail, setProgramDetail] = useState<(typeof programs)[number] | null>(null);
  const [benefit, setBenefit] = useState<(typeof benefits)[number] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const upcoming = demoEvents.filter((event) => event.date >= "2026-05-10").slice(0, 4);

  return (
    <StudentAppPage
      title="Programs"
      text="Pick the training path you want to learn about."
      action={{ label: "Start Free Trial", to: "/product/starter-program", icon: <Target size={18} /> }}
      className="programs-app-page"
    >
      <div className="student-card-grid program-choice-grid">
        {programs.map((program) => (
          <article className={`student-choice-card ${program.slug === programFocus ? "is-selected" : ""}`} key={program.slug}>
            <ImagePanel label={program.title} alt={program.imageAlt} tone={program.slug} compact />
            <div>
              <h2>{program.title}</h2>
              <p>{program.shortDescription}</p>
            </div>
            <div className="choice-actions">
              <Link className="btn btn-small btn-red" to={`/product/starter-program?program=${program.slug}`}>
                Start
              </Link>
              <button className="btn btn-small btn-ghost-dark" type="button" onClick={() => setProgramDetail(program)}>
                More Details
              </button>
            </div>
          </article>
        ))}
      </div>

      <section className={`student-compact-section ${practiceFocused ? "is-highlighted" : ""}`} aria-label="Practice goals">
        <SectionHeader title="Practice" text="Small goals students can understand before the next class." />
        <div className="student-card-grid practice-card-grid">
          {[
            ["Warm Up", "Stretch, bow in, and practice attention stance."],
            ["Forms", "Move slowly first, then add power after the pattern feels clear."],
            ["Respect", "Listen the first time and help keep training space safe."]
          ].map(([title, text]) => (
            <article className="compact-task-card" key={title}>
              <Target size={20} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="student-compact-section">
        <SectionHeader title="Skills Students Build" text="Tap a skill when you want the longer explanation." />
        <div className="card-grid three">
          {benefits.slice(0, 6).map((item) => (
            <button className="benefit-card" key={item.title} onClick={() => setBenefit(item)}>
              <strong>{item.title}</strong>
              <span>{item.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="student-compact-section">
        <SectionHeader title="Coming Up" text="A few nearby classes and training times." />
        <div className="event-list compact-events">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} onOpen={() => setSelectedEvent(event)} compact />
          ))}
        </div>
      </section>

      <details className="app-details-panel">
        <summary>More Details About Cho&apos;s Programs</summary>
        <div className="details-copy-grid">
          <article>
            <h3>Beginner&apos;s Program</h3>
            <p>Focused one-on-one instruction introduces fundamentals, builds connection with instructors, and prepares a confident transition into group classes.</p>
          </article>
          <article>
            <h3>Adult Martial Arts Programs</h3>
            <p>Adult programs build conditioning, coordination, flexibility, and a safe supportive training environment.</p>
          </article>
          <article>
            <h3>Money-Back Guarantee</h3>
            <p>Cho&apos;s offers a satisfaction guarantee for new students trying the program.</p>
          </article>
        </div>
        <div className="button-row">
          <Link className="btn btn-red" to="/product/starter-program">
            Start Free Trial
          </Link>
          <Link className="btn btn-dark" to="/classes">
            View Full Class Calendar
          </Link>
          <Link className="btn btn-ghost-dark" to="/contact-us">
            Contact Us
          </Link>
        </div>
      </details>
      {programDetail && (
        <InfoModal title={programDetail.title} onClose={() => setProgramDetail(null)}>
          <p>{programDetail.detail}</p>
          <Link className="btn btn-red" to="/product/starter-program">
            Start Free Trial
          </Link>
        </InfoModal>
      )}
      {benefit && (
        <InfoModal title={benefit.title} onClose={() => setBenefit(null)}>
          <p>{benefit.detail}</p>
        </InfoModal>
      )}
      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </StudentAppPage>
  );
}

function PrivateLessonsPage() {
  const { showToast } = useAppState();
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const [view, setView] = useState<"list" | "month" | "day">("list");
  const [cursor, setCursor] = useState(new Date(2026, 4, 11));
  const privateEvents = demoEvents.filter((event) => event.ruleId === "private-lessons");
  const nextTen = privateEvents.filter((event) => event.date >= "2026-05-11").slice(0, 10);
  const visible = filterEventsForView(privateEvents, view, cursor, "");

  const exportPrivate = () => {
    const ics = nextTen.map((event) => generateIcs(event)).join("\r\n");
    downloadTextFile("chos-private-lessons.ics", ics);
    showToast("Private lesson availability downloaded.");
  };

  return (
    <StudentAppPage
      title="Private Lessons"
      text="Ask for one-on-one help with an instructor."
      action={{ label: "Request a Lesson", onClick: () => setRequestOpen(true), icon: <Clock size={18} /> }}
      className="lessons-app-page"
    >
      <div className="student-card-grid class-glance-grid">
        <article className="compact-task-card">
          <Phone size={22} />
          <h2>Call</h2>
          <p>Talk with the studio about the best time.</p>
          <a className="btn btn-small btn-ghost-dark" href={studio.phoneHref}>
            Call Now
          </a>
        </article>
        <article className="compact-task-card">
          <Mail size={22} />
          <h2>Text</h2>
          <p>Send a quick message for scheduling help.</p>
          <a className="btn btn-small btn-ghost-dark" href={studio.smsHref}>
            Text Us
          </a>
        </article>
        <article className="compact-task-card">
          <CalendarDays size={22} />
          <h2>Typical Times</h2>
          <p>Monday-Saturday, 12:30 PM - 4:30 PM.</p>
        </article>
      </div>

      <details className="app-details-panel">
        <summary>Availability Calendar</summary>
        <SectionHeader title="Upcoming Private Lesson Availability" text="Monday-Saturday, 12:30 PM - 4:30 PM" />
        <CalendarControls view={view} setView={setView} cursor={cursor} setCursor={setCursor} />
        <div className="availability-grid">
          {nextTen.map((event) => (
            <article className="availability-card" key={event.id}>
              <Clock />
              <strong>{displayDate(event.date)}</strong>
              <span>{event.startTime} - {event.endTime}</span>
            </article>
          ))}
        </div>
        {view === "month" ? <MonthGrid events={visible} cursor={cursor} onEventClick={setSelectedEvent} /> : <EventList events={visible} onEventClick={setSelectedEvent} />}
        <div className="button-row">
          {["Google Calendar", "iCalendar", "Outlook 365", "Outlook Live"].map((label) => (
            <button key={label} className="btn btn-small btn-ghost-dark" onClick={() => showToast(`${label} subscription would open in the live app.`)}>
              {label}
            </button>
          ))}
          <button className="btn btn-small btn-dark" onClick={exportPrivate}>
            <Download size={16} /> Export .ics
          </button>
          <button className="btn btn-small btn-dark" onClick={exportPrivate}>
            <Download size={16} /> Export Outlook .ics
          </button>
        </div>
      </details>
      {requestOpen && <PrivateLessonModal onClose={() => setRequestOpen(false)} />}
      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </StudentAppPage>
  );
}

function ClassesPage() {
  const [view, setView] = useState<"list" | "month" | "day">("list");
  const [cursor, setCursor] = useState(new Date(2026, 4, 10));
  const [query, setQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ClassEvent | null>(null);
  const visible = filterEventsForView(demoEvents, view, cursor, query);
  const today = todayIso();
  const todayEvents = demoEvents.filter((event) => event.date === today);
  const upcoming = demoEvents.filter((event) => event.date >= today).slice(0, 12);
  const nextClass = upcoming[0];

  return (
    <StudentAppPage
      title="Classes"
      text="See what is happening today and this week."
      action={{ label: "Ask About Classes", to: "/contact-us?message=I%20would%20like%20help%20choosing%20a%20class.", icon: <Mail size={18} /> }}
      className="classes-app-page"
    >
      <div className="student-card-grid class-glance-grid">
        <article className="compact-task-card">
          <CalendarDays size={22} />
          <h2>Today</h2>
          <p>{todayEvents.length ? `${todayEvents.length} class${todayEvents.length === 1 ? "" : "es"} today.` : "No classes today. Check what is next."}</p>
        </article>
        <article className="compact-task-card">
          <Clock size={22} />
          <h2>Next Class</h2>
          <p>{nextClass ? `${nextClass.title} on ${displayDate(nextClass.date)} at ${nextClass.startTime}.` : "No class is scheduled yet."}</p>
        </article>
        <article className="compact-task-card">
          <User size={22} />
          <h2>Need 1-on-1?</h2>
          <p>Private lessons are by appointment.</p>
          <Link className="btn btn-small btn-ghost-dark" to="/private-lessons">
            Private Lessons
          </Link>
        </article>
      </div>

      <section className="student-compact-section">
        <SectionHeader title="This Week" text="Tap a class to see the time and details." />
        <EventList events={upcoming} onEventClick={setSelectedEvent} emptyText="No upcoming classes are listed." />
      </section>

      <details className="app-details-panel">
        <summary>Search and Calendar</summary>
        <div className="calendar-toolbar">
          <CalendarControls view={view} setView={setView} cursor={cursor} setCursor={setCursor} />
          <label className="search-inline">
            <span>Search classes</span>
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="MMA, Youth, Private..." />
          </label>
        </div>
        {view === "month" && <MonthGrid events={visible} cursor={cursor} onEventClick={setSelectedEvent} />}
        {view !== "month" && <EventList events={visible} onEventClick={setSelectedEvent} emptyText={view === "day" ? "There are no events on this day." : "No classes match this search."} />}
      </details>
      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </StudentAppPage>
  );
}

function ShopPage() {
  const { categorySlug } = useParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const category = categorySlug ? getCategory(categorySlug) : undefined;
  const baseProducts = category ? getProductsForCategory(category.slug) : products;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = baseProducts.filter((product) => !normalized || `${product.name} ${product.description} ${product.categories.join(" ")}`.toLowerCase().includes(normalized));
    return [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "category") return a.categories[0].localeCompare(b.categories[0]);
      return a.name.localeCompare(b.name);
    });
  }, [baseProducts, query, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 4));
  const visible = filtered.slice((page - 1) * 4, page * 4);

  useEffect(() => setPage(1), [categorySlug, query, sort]);

  return (
    <StudentAppPage
      title={category ? category.name : "Shop"}
      text="Find uniforms, gloves, and training gear for pickup at Cho's."
      action={{ label: "View Cart", to: "/cart", icon: <ShoppingCart size={18} /> }}
      className="shop-app-page"
    >
      <div className="shop-layout">
        <aside className="shop-sidebar">
          <h3>Categories</h3>
          <Link className={!category ? "active" : ""} to="/shop">
            All Products
          </Link>
          {categories.map((item) => (
            <Link className={item.slug === category?.slug ? "active" : ""} key={item.slug} to={`/shop/category/${item.slug}`}>
              {item.name}
            </Link>
          ))}
        </aside>
        <div className="shop-main">
          <div className="shop-controls">
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name">Sort by name</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="chip-list shop-chips">
            {categories.map((item) => (
              <Link className="chip" key={item.slug} to={`/shop/category/${item.slug}`}>
                {item.name}
              </Link>
            ))}
          </div>
          <div className="product-grid">
            {visible.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="pagination">
            <button className="btn btn-small btn-ghost-dark" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-small btn-ghost-dark" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </StudentAppPage>
  );
}

function ProductDetailPage() {
  const { productSlug } = useParams();
  const product = productSlug ? getProduct(productSlug) : undefined;
  const category = product ? getCategory(product.categories[0]) : undefined;
  const [quantity, setQuantity] = useState(1);
  const [persons, setPersons] = useState(1);
  const [date, setDate] = useState("2026-05-11");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const bookingRef = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const { addProductToCart, addBookingToCart, showToast } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    if (params.get("focus") === "booking") {
      window.setTimeout(() => bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }, [params]);

  if (!product) return <NotFoundPage />;

  const related = product.relatedSlugs.map((slug) => getProduct(slug)).filter((item): item is Product => Boolean(item));

  const add = () => {
    addProductToCart(product.slug, quantity);
    showToast(`${product.name} added to cart.`, "View Cart", () => navigate("/cart"));
  };

  const book = () => {
    if (!date || !time || persons < 1) {
      setError("Choose persons, date, and an available time.");
      return;
    }
    addBookingToCart({ persons, date, time, timezone: "America/Chicago" });
    showToast("Starter Program booking added to cart.", "View Cart", () => navigate("/cart"));
    setError("");
  };

  return (
    <section className="section product-detail-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        {category && <Link to={`/shop/category/${category.slug}`}>{category.name}</Link>}
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="product-detail">
        <ImagePanel label={product.name} alt={product.imageAlt} tone={product.categories[0]} />
        <div>
          <p className="eyebrow">{category?.name}</p>
          <h1>{product.name}</h1>
          <p className="price">{product.displayPrice}</p>
          <p>{product.description}</p>
          <p className="fitting-note">Pick up in person and try it on for the perfect fit.</p>
          <p className="muted">SKU: {product.sku}</p>
          {product.type === "booking" ? (
            <div className="booking-panel" ref={bookingRef}>
              <label>
                Persons
                <input className="input" type="number" min="1" value={persons} onChange={(event) => setPersons(Number(event.target.value))} />
              </label>
              <label>
                Date
                <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                Available time
                <select className="input" value={time} onChange={(event) => setTime(event.target.value)}>
                  <option value="">Select a time</option>
                  {starterTimes.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">Timezone: America/Chicago</p>
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-red" onClick={book}>
                Book now
              </button>
            </div>
          ) : (
            <div className="cart-actions">
              <Quantity value={quantity} setValue={setQuantity} />
              <button className="btn btn-red" onClick={add}>
                Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>
      <section className="related-products">
        <SectionHeader title="Related Products" />
        <div className="product-grid related">
          {related.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </section>
  );
}

function CartPage() {
  const { cart, totals, coupon, updateCartQuantity, removeCartItem, applyCartCoupon, showToast } = useAppState();
  const [code, setCode] = useState(coupon?.code ?? "");

  if (cart.length === 0) {
    return (
      <EmptyState title="Your cart is currently empty." actionLabel="Return to shop" actionTo="/shop" />
    );
  }

  return (
    <section className="section cart-page">
      <SectionHeader title="Cart" text="Review your student shop and booking items before checkout." />
      <div className="cart-layout">
        <div className="cart-list">
          {cart.map((item) => (
            <article className="cart-row" key={item.id}>
              <ImagePanel label={item.name} alt={`${item.name} item image`} compact tone="product" />
              <div>
                <h3>{item.name}</h3>
                <p>{formatMoney(item.unitPrice)}</p>
                {item.booking && <small>{item.booking.persons} person(s), {item.booking.date}, {item.booking.time}</small>}
              </div>
              <Quantity value={item.quantity} setValue={(value) => updateCartQuantity(item.id, value)} />
              <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
              <button className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => removeCartItem(item.id)}>
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </div>
        <aside className="summary-card">
          <label>
            Coupon code
            <div className="coupon-row">
              <input className="input" value={code} onChange={(event) => setCode(event.target.value)} placeholder="CHOS10" />
              <button
                className="btn btn-dark"
                onClick={() => {
                  const result = applyCartCoupon(code);
                  showToast(result.valid ? "CHOS10 coupon applied." : "Invalid coupon code.");
                }}
              >
                Apply Coupon
              </button>
            </div>
          </label>
          <button className="btn btn-ghost-dark full" onClick={() => showToast("Cart updated.")}>
            Update Cart
          </button>
          <SummaryRows />
          <p className="fitting-note">Pickup/fitting note: students can try shop items on in person at Cho&apos;s Martial Arts.</p>
          <Link className="btn btn-red full" to="/checkout">
            Proceed to Checkout
          </Link>
        </aside>
      </div>
    </section>
  );
}

function CheckoutPage() {
  const { cart, totals, placeOrder, showToast } = useAppState();
  const [confirmation, setConfirmation] = useState<ReturnType<typeof placeOrder> | null>(null);
  const [notes, setNotes] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "WI", zip: "", terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  if (confirmation) {
    return (
      <section className="section confirmation">
        <div className="content-card">
          <p className="eyebrow">Order placed</p>
          <h1>{confirmation.orderNumber}</h1>
          <p>Confirmation for {confirmation.customer.email}</p>
          <p>{confirmation.pickupOption}. We&apos;ll coordinate pickup and fitting details at the studio.</p>
          <div className="button-row">
            <button className="btn btn-dark" onClick={() => navigate("/my-account")}>
              Track Order
            </button>
            <Link className="btn btn-gold" to="/shop">
              Continue Shopping
            </Link>
            <Link className="btn btn-ghost-dark" to="/classes">
              View Classes
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (cart.length === 0) return <EmptyState title="Your cart is currently empty." actionLabel="Return to shop" actionTo="/shop" />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateCheckoutForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Please fix the checkout form fields.");
      return;
    }
    const order = placeOrder(form, notes);
    setConfirmation(order);
    showToast(`Order ${order.orderNumber} created.`);
  };

  return (
    <section className="section checkout-page">
      <SectionHeader title="Checkout" text="Mock checkout only. No real payment is processed." />
      <form className="checkout-layout" onSubmit={submit}>
        <div className="form-card">
          <div className="form-grid">
            {[
              ["firstName", "First name"],
              ["lastName", "Last name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["address", "Address"],
              ["city", "City"],
              ["state", "State"],
              ["zip", "ZIP"]
            ].map(([name, label]) => (
              <Field key={name} label={label} error={errors[name]}>
                <input className="input" value={String(form[name as keyof typeof form])} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
              </Field>
            ))}
          </div>
          <label className="field-label">
            Pickup option
            <input className="input" value="In-store pickup and fitting at Cho's Martial Arts" readOnly />
          </label>
          <label className="field-label">
            Order notes
            <textarea className="input" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.checked })} />
            <span>
              I agree to the <Link to="/terms-and-conditions">Terms and Conditions</Link>.
            </span>
          </label>
          {errors.terms && <p className="form-error">{errors.terms}</p>}
        </div>
        <aside className="summary-card">
          <h3>Order Summary</h3>
          {cart.map((item) => (
            <div className="summary-line" key={item.id}>
              <span>{item.name} × {item.quantity}</span>
              <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
            </div>
          ))}
          <SummaryRows />
          <button className="btn btn-red full" type="submit">
            Place Order
          </button>
        </aside>
      </form>
    </section>
  );
}

function AccountPage() {
  const { session, login, logout, register, orders, bookings, contacts, showToast } = useAppState();
  const navigate = useNavigate();
  const [accountParams] = useSearchParams();
  const [loginForm, setLoginForm] = useState({ email: "", password: "", remembered: true });
  const [registerEmail, setRegisterEmail] = useState("");
  const [track, setTrack] = useState({ orderId: "", email: "" });
  const [trackedOrder, setTrackedOrder] = useState<string>("");
  const [studentProgress, setStudentProgress] = useState<StudentProgressSettings>(() => loadStudentProgress());
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(() => {
    const fallback: ProfileSettings = { name: "", email: session?.email ?? "", phone: "", updates: true };
    if (typeof window === "undefined") return fallback;
    try {
      const saved = window.localStorage.getItem("chos.profile.v1");
      if (!saved) return fallback;
      const parsed = JSON.parse(saved) as Partial<ProfileSettings>;
      return { ...fallback, ...parsed, email: parsed.email || fallback.email };
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (session && !profileSettings.email) {
      setProfileSettings((current) => ({ ...current, email: session.email }));
    }
  }, [profileSettings.email, session]);

  const currentBeltIndex = Math.max(0, beltRanks.findIndex((rank) => rank.slug === studentProgress.currentBeltSlug));
  const currentBelt = beltRanks[currentBeltIndex] ?? beltRanks[0];
  const nextBelt = beltRanks[currentBeltIndex + 1];
  const targetClasses = nextBelt?.classesRequired ?? currentBelt.classesRequired;
  const classProgress = nextBelt ? Math.min(100, Math.round((studentProgress.classesAttended / targetClasses) * 100)) : 100;
  const readinessProgress = Math.round((studentProgress.completedRequirementIds.length / beltReadinessItems.length) * 100);
  const overallProgress = nextBelt ? Math.round((classProgress + readinessProgress) / 2) : 100;
  const classesRemaining = Math.max(0, targetClasses - studentProgress.classesAttended);
  const requestedTopic = accountParams.get("topic");
  const activeAccountTopic = requestedTopic === "progress" || requestedTopic === "orders" || requestedTopic === "bookings" || requestedTopic === "profile" ? requestedTopic : "overview";
  const accountTitle =
    activeAccountTopic === "progress"
      ? "My Progress"
      : activeAccountTopic === "orders"
        ? "Orders"
        : activeAccountTopic === "bookings"
          ? "Bookings"
          : activeAccountTopic === "profile"
            ? "Profile"
            : "My Account";

  const updateStudentProgress = (next: StudentProgressSettings, message: string) => {
    setStudentProgress(next);
    window.localStorage.setItem(studentProgressStorageKey, JSON.stringify(next));
    showToast(message);
  };

  const toggleRequirement = (id: string) => {
    const completed = studentProgress.completedRequirementIds.includes(id);
    updateStudentProgress(
      {
        ...studentProgress,
        completedRequirementIds: completed ? studentProgress.completedRequirementIds.filter((item) => item !== id) : [...studentProgress.completedRequirementIds, id]
      },
      completed ? "Readiness item marked open." : "Readiness item marked complete."
    );
  };

  const setCurrentBelt = (slug: string) => {
    const rank = beltRanks.find((belt) => belt.slug === slug);
    if (!rank) return;
    updateStudentProgress(
      {
        ...studentProgress,
        currentBeltSlug: slug,
        trainingGoal: beltRanks[beltRanks.findIndex((belt) => belt.slug === slug) + 1]?.name ? `Earn ${beltRanks[beltRanks.findIndex((belt) => belt.slug === slug) + 1].name} Belt` : "Continue Black Belt training"
      },
      `Current belt set to ${rank.name}.`
    );
  };

  const recordClass = () => {
    updateStudentProgress({ ...studentProgress, classesAttended: studentProgress.classesAttended + 1 }, "Class attendance added.");
  };

  const downloadProgressSummary = () => {
    const lines = [
      "Cho's Martial Arts - Student Progress Summary",
      `Student: ${profileSettings.name || session?.email || "Prototype student"}`,
      `Current belt: ${currentBelt.name}`,
      `Next goal: ${nextBelt ? nextBelt.name : "Continued black belt development"}`,
      `Classes attended: ${studentProgress.classesAttended}`,
      `Readiness: ${overallProgress}%`,
      `Last promotion: ${studentProgress.lastPromotionDate || "Not recorded"}`,
      "",
      "Completed readiness items:",
      ...beltReadinessItems.map((item) => `${studentProgress.completedRequirementIds.includes(item.id) ? "[x]" : "[ ]"} ${item.label}`)
    ];
    downloadTextFile("chos-student-progress.txt", lines.join("\n"), "text/plain");
    showToast("Progress summary downloaded.");
  };

  const accountPageAction: StudentPageAction =
    activeAccountTopic === "progress"
      ? { label: "Record Class", onClick: recordClass, icon: <Plus size={18} /> }
      : activeAccountTopic === "orders"
        ? { label: "Go to Shop", to: "/shop", icon: <Package size={18} /> }
        : activeAccountTopic === "bookings"
          ? { label: "Request Lesson", to: "/private-lessons", icon: <Clock size={18} /> }
          : { label: "Student Home", to: "/", icon: <Home size={18} /> };

  if (session) {
    return (
      <StudentAppPage
        title={accountTitle}
        text={`Welcome back, ${session.email}. Choose one account task at a time.`}
        action={accountPageAction}
        className="account-page"
      >
        <AccountTopicNav activeTopic={activeAccountTopic} />
        {(activeAccountTopic === "overview" || activeAccountTopic === "progress") && (
        <div className="student-progress-shell">
          <article className="content-card belt-collection-card" aria-label="Student belt progression">
            <div className="belt-board-top">
              <span className="belt-emblem" aria-hidden="true">
                <Award size={26} />
              </span>
              <div>
                <p className="eyebrow">Student Progress</p>
                <h2>Belt Progression</h2>
              </div>
            </div>
            <div className="belt-ladder">
              {beltRanks.map((rank, index) => {
                const isCurrent = rank.slug === currentBelt.slug;
                const isComplete = index < currentBeltIndex;
                return (
                  <button
                    className={`belt-row belt-${rank.slug} ${isCurrent ? "current" : ""} ${isComplete ? "complete" : ""}`}
                    key={rank.slug}
                    type="button"
                    onClick={() => setCurrentBelt(rank.slug)}
                    aria-pressed={isCurrent}
                  >
                    <span className="belt-wrap" style={{ "--belt-color": rank.color, "--belt-text": rank.textColor } as CSSProperties}>
                      <span className="belt-tail left"></span>
                      <span className="belt-bar"></span>
                      <span className="belt-knot"></span>
                      <span className="belt-tail right"></span>
                    </span>
                    <span className="belt-label">
                      <strong>{rank.name}</strong>
                      <small>{rank.level}</small>
                    </span>
                    {isComplete && <CheckCircle2 size={18} aria-label="Completed belt" />}
                  </button>
                );
              })}
            </div>
            <p className="belt-disclaimer">Prototype path based on common color-belt progression. Actual testing is always confirmed by Cho's instructors.</p>
          </article>

          <article className="content-card student-status-card">
            <div className="student-status-head">
              <div>
                <p className="eyebrow">Current Rank</p>
                <h2>{currentBelt.name} Belt</h2>
                <p>{currentBelt.meaning}</p>
              </div>
              <span className="current-belt-chip" style={{ "--belt-color": currentBelt.color, "--belt-text": currentBelt.textColor } as CSSProperties}>
                {currentBelt.name}
              </span>
            </div>
            <div className="rank-summary-grid">
              <div>
                <span>Next goal</span>
                <strong>{nextBelt ? `${nextBelt.name} Belt` : "Black Belt development"}</strong>
              </div>
              <div>
                <span>Classes logged</span>
                <strong>{studentProgress.classesAttended}</strong>
              </div>
              <div>
                <span>Readiness</span>
                <strong>{overallProgress}%</strong>
              </div>
            </div>
            <div className="progress-block">
              <div className="progress-row">
                <span>{nextBelt ? `Class progress toward ${nextBelt.name}` : "Continuing education"}</span>
                <strong>{nextBelt ? `${classesRemaining} left` : "Ongoing"}</strong>
              </div>
              <div className="progress-track" aria-label={`Class progress ${classProgress}%`}>
                <span style={{ width: `${classProgress}%` }}></span>
              </div>
            </div>
            <div className="progress-block">
              <div className="progress-row">
                <span>Testing readiness checklist</span>
                <strong>{studentProgress.completedRequirementIds.length}/{beltReadinessItems.length}</strong>
              </div>
              <div className="progress-track gold" aria-label={`Testing readiness ${readinessProgress}%`}>
                <span style={{ width: `${readinessProgress}%` }}></span>
              </div>
            </div>
            <p className="rank-focus"><Target size={18} /> {currentBelt.focus}</p>
            <details className="app-details-panel readiness-details">
              <summary>Testing Checklist</summary>
              <div className="readiness-list">
                {beltReadinessItems.map((item) => {
                  const complete = studentProgress.completedRequirementIds.includes(item.id);
                  return (
                    <button className={`readiness-item ${complete ? "complete" : ""}`} key={item.id} type="button" onClick={() => toggleRequirement(item.id)} aria-pressed={complete}>
                      <span>{complete ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}</span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </button>
                  );
                })}
              </div>
            </details>
            <div className="student-progress-actions">
              <button className="btn btn-red" type="button" onClick={recordClass}>
                <Plus size={18} /> Record Class
              </button>
              <button className="btn btn-gold" type="button" onClick={() => navigate("/classes")}>
                <CalendarDays size={18} /> View Classes
              </button>
              <button className="btn btn-dark" type="button" onClick={downloadProgressSummary}>
                <Download size={18} /> Download Summary
              </button>
            </div>
          </article>
        </div>
        )}
        {activeAccountTopic !== "progress" && (
        <div className={`dashboard-grid ${activeAccountTopic !== "overview" ? "account-topic-single" : ""}`}>
          {(activeAccountTopic === "overview" || activeAccountTopic === "orders") && <DashboardPanel title="Saved Orders" items={orders.map((order) => `${order.orderNumber} - ${formatMoney(order.total)} - ${order.status}`)} empty="No saved orders yet." />}
          {(activeAccountTopic === "overview" || activeAccountTopic === "bookings") && <DashboardPanel title="Saved Bookings" items={bookings.map((booking) => `${booking.date} ${booking.time} for ${booking.persons} person(s)`)} empty="No saved bookings yet." />}
          {activeAccountTopic === "overview" && <DashboardPanel title="Saved Contact Requests" items={contacts.map((contact) => `${contact.name}: ${contact.message}`)} empty="No saved contact requests yet." />}
          {(activeAccountTopic === "overview" || activeAccountTopic === "profile") && (
            <form
            className="content-card profile-settings-card"
            onSubmit={(event) => {
              event.preventDefault();
              if (!validateEmail(profileSettings.email)) {
                showToast("Enter a valid profile email.");
                return;
              }
              window.localStorage.setItem("chos.profile.v1", JSON.stringify(profileSettings));
              showToast("Profile settings saved.");
            }}
          >
            <div className="profile-card-head">
              <User />
              <div>
                <h3>Profile Details</h3>
                <p>Update the details used for this local demo account.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field-label">
                Display name
                <input className="input" value={profileSettings.name} onChange={(event) => setProfileSettings({ ...profileSettings, name: event.target.value })} placeholder="Your name" />
              </label>
              <label className="field-label">
                Email address
                <input className="input" value={profileSettings.email} onChange={(event) => setProfileSettings({ ...profileSettings, email: event.target.value })} />
              </label>
              <label className="field-label">
                Phone number
                <input className="input" value={profileSettings.phone} onChange={(event) => setProfileSettings({ ...profileSettings, phone: event.target.value })} placeholder="(262) 555-0100" />
              </label>
              <label className="checkbox-row profile-checkbox">
                <input type="checkbox" checked={profileSettings.updates} onChange={(event) => setProfileSettings({ ...profileSettings, updates: event.target.checked })} />
                Send class and pickup updates
              </label>
            </div>
            <div className="profile-actions">
              <button className="btn btn-red" type="submit">
                Save Profile Settings
              </button>
              <button className="btn btn-dark" type="button" onClick={logout}>
                Log out
              </button>
            </div>
            </form>
          )}
        </div>
        )}
      </StudentAppPage>
    );
  }

  return (
    <section className="section account-page">
      <SectionHeader title="My Account" />
      <div className="account-grid">
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (!loginForm.email.trim() || !loginForm.password.trim()) {
              showToast("Enter username/email and password.");
              return;
            }
            login(loginForm.email, loginForm.remembered);
            showToast("Logged in to prototype account.");
          }}
        >
          <h2>Log in</h2>
          <label className="field-label">Username or email <input className="input" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} /></label>
          <label className="field-label">Password <input className="input" type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={loginForm.remembered} onChange={(event) => setLoginForm({ ...loginForm, remembered: event.target.checked })} /> Remember me</label>
          <button className="btn btn-red" type="submit">Log in</button>
          <button className="text-button left" type="button" onClick={() => showToast("Prototype password reset link sent.")}>Lost your password?</button>
        </form>
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validateEmail(registerEmail)) {
              showToast("Enter a valid email address.");
              return;
            }
            register(registerEmail);
            showToast("Prototype account registered.");
          }}
        >
          <h2>Register</h2>
          <label className="field-label">Email address <input className="input" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} /></label>
          <p>A link to set a new password will be sent to your email address.</p>
          <p><Link to="/terms-and-conditions">Privacy policy</Link></p>
          <button className="btn btn-dark" type="submit">Register</button>
        </form>
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            const found = orders.find((order) => order.orderNumber.toLowerCase() === track.orderId.trim().toLowerCase() && order.customer.email.toLowerCase() === track.email.trim().toLowerCase());
            setTrackedOrder(found ? `${found.orderNumber}: ${found.status} (${formatMoney(found.total)})` : "No prototype order found. Try an order created during this demo session.");
          }}
        >
          <h2>Order Tracking</h2>
          <label className="field-label">Order ID <input className="input" value={track.orderId} onChange={(event) => setTrack({ ...track, orderId: event.target.value })} /></label>
          <label className="field-label">Billing email <input className="input" value={track.email} onChange={(event) => setTrack({ ...track, email: event.target.value })} /></label>
          <button className="btn btn-gold" type="submit">Track</button>
          {trackedOrder && <p className="tracking-result">{trackedOrder}</p>}
        </form>
      </div>
    </section>
  );
}

function ContactPage() {
  const { saveContact, showToast } = useAppState();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: params.get("message") ?? "", captcha: false, url: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateContactForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast(nextErrors.url ? "Submission blocked." : "Please complete the contact form.");
      return;
    }
    saveContact(makeContactSubmission(form));
    setForm({ name: "", email: "", phone: "", message: "", captcha: false, url: "" });
    showToast("Message saved. Cho's would follow up from the live site.");
  };

  return (
    <StudentAppPage title="Ask for Help" text="Send a question or contact the studio." action={{ label: "Call Cho's", href: studio.phoneHref, icon: <Phone size={18} /> }} className="contact-app-page">
      <div className="contact-layout">
        <div className="content-card">
          <MapPin />
          <h2>Visit Cho&apos;s</h2>
          <p>{studio.address}</p>
          <p><a href={studio.phoneHref}>{studio.phone}</a></p>
          <div className="button-row">
            <a className="btn btn-dark" href={studio.mapsUrl} target="_blank" rel="noreferrer">Open in Maps</a>
            <a className="btn btn-ghost-dark" href={studio.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>
            <a className="btn btn-ghost-dark" href={studio.yelpUrl} target="_blank" rel="noreferrer">Yelp</a>
            <a className="btn btn-ghost-dark" href={studio.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>
          </div>
          <div className="map-placeholder" role="img" aria-label="Map placeholder for Cho's Martial Arts in Menomonee Falls">
            <span>N89W16863 Appleton Ave.</span>
          </div>
        </div>
        <form className="form-card" onSubmit={submit}>
          <h2>Send Us a Message</h2>
          <label className="honeypot">Validation field <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} tabIndex={-1} autoComplete="off" /></label>
          <div className="quick-message-row">
            {["Ask about youth classes", "Ask about private lessons", "Ask about starter program"].map((message) => (
              <button key={message} type="button" className="chip" onClick={() => setForm({ ...form, message })}>
                {message}
              </button>
            ))}
          </div>
          {[
            ["name", "Name"],
            ["email", "Email"],
            ["phone", "Phone Number"]
          ].map(([name, label]) => (
            <Field key={name} label={label} error={errors[name]}>
              <input className="input" value={String(form[name as keyof typeof form])} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
            </Field>
          ))}
          <Field label="Message" error={errors.message}>
            <textarea className="input" rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
          </Field>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.captcha} onChange={(event) => setForm({ ...form, captcha: event.target.checked })} />
            I&apos;m not a robot
          </label>
          {errors.captcha && <p className="form-error">{errors.captcha}</p>}
          <button className="btn btn-red" type="submit">Submit</button>
        </form>
      </div>
    </StudentAppPage>
  );
}

function TermsPage() {
  const [open, setOpen] = useState(0);
  return (
    <>
      <PageHero title="Terms and Conditions" text="Readable prototype summary of Cho's Martial Arts website terms." imageAlt="Terms and conditions document panel" />
      <section className="section narrow">
        <div className="accordion-list">
          {termsSections.map((section, index) => (
            <Accordion key={section.title} title={section.title} open={open === index} onToggle={() => setOpen(open === index ? -1 : index)}>
              {section.content}
            </Accordion>
          ))}
        </div>
      </section>
    </>
  );
}

function NotFoundPage() {
  return <EmptyState title="This prototype page could not be found." actionLabel="Go Home" actionTo="/" />;
}

function ProductCard({ product }: { product: Product }) {
  const { addProductToCart, showToast } = useAppState();
  const navigate = useNavigate();
  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`}>
        <ImagePanel label={product.name} alt={product.imageAlt} compact tone={product.categories[0]} />
      </Link>
      <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
      <p className="price">{product.displayPrice}</p>
      <p>{product.description}</p>
      <div className="product-actions">
        {product.type === "booking" ? (
          <Link className="btn btn-small btn-red" to={`/product/${product.slug}`}>Read more</Link>
        ) : (
          <button
            className="btn btn-small btn-red"
            onClick={() => {
              addProductToCart(product.slug, 1);
              showToast(`${product.name} added to cart.`, "View Cart", () => navigate("/cart"));
            }}
          >
            Add to Cart
          </button>
        )}
        <Link className="btn btn-small btn-ghost-dark" to={`/product/${product.slug}`}>Details</Link>
      </div>
    </article>
  );
}

function EventDetailModal({ event, onClose }: { event: ClassEvent; onClose: () => void }) {
  const { showToast } = useAppState();
  const navigate = useNavigate();
  const addCalendar = () => {
    downloadTextFile(`${event.id}.ics`, generateIcs(event));
    showToast("Calendar file downloaded.");
  };
  const share = async () => {
    const link = `${window.location.origin}/classes?event=${event.id}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Prototype class link copied.");
    } catch {
      showToast(link);
    }
  };
  return (
    <InfoModal title={event.title} onClose={onClose}>
      <p><strong>{displayDate(event.date)}</strong></p>
      <p>{event.startTime} - {event.endTime}</p>
      {event.ageNote && <p>{event.ageNote}</p>}
      <p>{event.description}</p>
      <div className="button-row">
        <button className="btn btn-red" onClick={() => navigate(`/contact-us?message=${encodeURIComponent(`I would like information about ${event.title} on ${displayDate(event.date)}.`)}`)}>Request Info</button>
        <button className="btn btn-dark" onClick={addCalendar}>Add to Calendar</button>
        <button className="btn btn-ghost-dark" onClick={share}><Share2 size={16} /> Share</button>
        <button className="btn btn-ghost-dark" onClick={onClose}>Close</button>
      </div>
    </InfoModal>
  );
}

function PrivateLessonModal({ onClose }: { onClose: () => void }) {
  const { saveBooking, showToast } = useAppState();
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "2026-05-11", time: "12:30 PM", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!validateEmail(form.email)) nextErrors.email = "Valid email is required.";
    if (!form.phone.trim()) nextErrors.phone = "Phone is required.";
    if (!form.date) nextErrors.date = "Preferred date is required.";
    if (!form.time) nextErrors.time = "Preferred time is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveBooking({ persons: 1, date: form.date, time: form.time, timezone: "America/Chicago" });
    showToast("Private lesson request saved.");
    onClose();
  };
  return (
    <InfoModal title="Request a Private Lesson" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        {[
          ["name", "Name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["date", "Preferred date"],
          ["time", "Preferred time"]
        ].map(([name, label]) => (
          <Field key={name} label={label} error={errors[name]}>
            <input className="input" type={name === "date" ? "date" : "text"} value={String(form[name as keyof typeof form])} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
          </Field>
        ))}
        <label className="field-label">Message <textarea className="input" rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        <button className="btn btn-red" type="submit">Submit Request</button>
      </form>
    </InfoModal>
  );
}

function VideoModal({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState(true);
  return (
    <InfoModal title="Training Highlight" onClose={onClose}>
      <div className={`mock-video ${playing ? "playing" : ""}`} role="img" aria-label="Mock embedded training highlight with martial arts motion panels">
        <span>Forms</span><span>Bag Work</span><span>Sparring</span>
      </div>
      <button className="btn btn-gold" onClick={() => setPlaying(!playing)}>
        {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? "Pause" : "Play"}
      </button>
    </InfoModal>
  );
}

function CalendarControls({ view, setView, cursor, setCursor }: { view: "list" | "month" | "day"; setView: (view: "list" | "month" | "day") => void; cursor: Date; setCursor: (date: Date) => void }) {
  const move = (direction: number) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (view === "day" ? 1 : 7));
    setCursor(next);
  };
  return (
    <div className="calendar-controls">
      <div className="segmented small">
        {(["list", "month", "day"] as const).map((mode) => (
          <button key={mode} className={view === mode ? "active" : ""} onClick={() => setView(mode)}>
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      <button className="btn btn-small btn-ghost-dark" onClick={() => setCursor(new Date())}>Today</button>
      <button className="icon-button" aria-label="Previous events" onClick={() => move(-1)}><ArrowLeft /></button>
      <button className="icon-button" aria-label="Next events" onClick={() => move(1)}><ArrowRight /></button>
      <input className="input date-input" type="date" value={cursor.toISOString().slice(0, 10)} onChange={(event) => setCursor(new Date(`${event.target.value}T00:00:00`))} aria-label="Select date" />
    </div>
  );
}

function filterEventsForView(events: ClassEvent[], view: "list" | "month" | "day", cursor: Date, query: string) {
  const q = query.trim().toLowerCase();
  return events.filter((event) => {
    const matchesSearch = !q || `${event.title} ${event.description} ${event.ageNote ?? ""}`.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (view === "month") return event.date.startsWith(monthKey(cursor));
    if (view === "day") return event.date === cursor.toISOString().slice(0, 10);
    return event.date >= "2026-05-01";
  });
}

function EventList({ events, onEventClick, emptyText = "No events found." }: { events: ClassEvent[]; onEventClick: (event: ClassEvent) => void; emptyText?: string }) {
  const grouped = groupEventsByDate(events);
  const dates = Object.keys(grouped).sort();
  if (!dates.length) return <p className="empty-note">{emptyText}</p>;
  return (
    <div className="event-list">
      {dates.map((date) => (
        <div className="event-date-group" key={date}>
          <h3>{displayDate(date)}</h3>
          {grouped[date].map((event) => (
            <EventCard key={event.id} event={event} onOpen={() => onEventClick(event)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MonthGrid({ events, cursor, onEventClick }: { events: ClassEvent[]; cursor: Date; onEventClick: (event: ClassEvent) => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = first.getDay();
  const cells = [...Array.from({ length: blanks }, (_, index) => ({ key: `blank-${index}`, day: 0 })), ...Array.from({ length: daysInMonth }, (_, index) => ({ key: String(index + 1), day: index + 1 }))];
  return (
    <div className="month-grid" aria-label={`${first.toLocaleString("default", { month: "long" })} ${year} events`}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
      {cells.map((cell) => {
        const date = cell.day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}` : "";
        const dayEvents = events.filter((event) => event.date === date);
        return (
          <div className={`month-cell ${!cell.day ? "blank" : ""}`} key={cell.key}>
            {cell.day ? <span className="month-day">{cell.day}</span> : null}
            {dayEvents.slice(0, 3).map((event) => (
              <button className="event-chip" key={event.id} onClick={() => onEventClick(event)}>{event.title}</button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function EventCard({ event, onOpen, compact = false }: { event: ClassEvent; onOpen: () => void; compact?: boolean }) {
  return (
    <button className={`event-card ${compact ? "compact" : ""}`} onClick={onOpen}>
      <span>{event.startTime} - {event.endTime}</span>
      <strong>{event.title}</strong>
      {event.ageNote && <small>{event.ageNote}</small>}
    </button>
  );
}

function SummaryRows() {
  const { totals, coupon } = useAppState();
  return (
    <div className="summary-rows">
      <div><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
      <div><span>Discount{coupon?.valid ? ` (${coupon.code})` : ""}</span><strong>-{formatMoney(totals.discount)}</strong></div>
      <div><span>Estimated tax</span><strong>{formatMoney(totals.tax)}</strong></div>
      <div className="total"><span>Total</span><strong>{formatMoney(totals.total)}</strong></div>
    </div>
  );
}

function DashboardPanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="content-card">
      <h3>{title}</h3>
      {items.length ? items.map((item) => <p key={item}>{item}</p>) : <p className="muted">{empty}</p>}
    </div>
  );
}

function AccountTopicNav({ activeTopic }: { activeTopic: string }) {
  const topics = [
    { topic: "overview", label: "Overview", path: "/my-account" },
    { topic: "progress", label: "Progress", path: "/my-account?topic=progress" },
    { topic: "orders", label: "Orders", path: "/my-account?topic=orders" },
    { topic: "bookings", label: "Bookings", path: "/my-account?topic=bookings" },
    { topic: "profile", label: "Profile", path: "/my-account?topic=profile" }
  ];

  return (
    <nav className="account-topic-nav" aria-label="Account topics">
      {topics.map((topic) => (
        <Link className={activeTopic === topic.topic ? "active" : ""} key={topic.topic} to={topic.path}>
          {topic.label}
        </Link>
      ))}
    </nav>
  );
}

function Quantity({ value, setValue }: { value: number; setValue: (value: number) => void }) {
  return (
    <div className="quantity-control" aria-label="Quantity selector">
      <button aria-label="Decrease quantity" onClick={() => setValue(Math.max(1, value - 1))}><Minus size={16} /></button>
      <input aria-label="Quantity" value={value} type="number" min="1" onChange={(event) => setValue(Math.max(1, Number(event.target.value)))} />
      <button aria-label="Increase quantity" onClick={() => setValue(value + 1)}><Plus size={16} /></button>
    </div>
  );
}

function Accordion({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <article className="accordion">
      <button onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown className={open ? "open" : ""} />
      </button>
      {open && <p>{children}</p>}
    </article>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field-label">
      {label}
      {children}
      {error && <span className="form-error">{error}</span>}
    </label>
  );
}

function EmptyState({ title, actionLabel, actionTo }: { title: string; actionLabel: string; actionTo: string }) {
  return (
    <section className="section empty-state">
      <Package size={42} />
      <h1>{title}</h1>
      <Link className="btn btn-red" to={actionTo}>{actionLabel}</Link>
    </section>
  );
}

function PageHero({ title, text, imageAlt }: { title: string; text: string; imageAlt: string }) {
  return (
    <section className="page-hero app-band">
      <div>
        <p className="eyebrow">Cho&apos;s Martial Arts</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <ImagePanel label={title} alt={imageAlt} tone="hero" />
    </section>
  );
}

function SectionHeader({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="section-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

function ImagePanel({ label, alt, compact = false, tone = "default" }: { label: string; alt: string; compact?: boolean; tone?: string }) {
  return (
    <div className={`image-panel ${compact ? "compact" : ""} tone-${tone.replaceAll(" ", "-")}`} role="img" aria-label={alt}>
      <span>{label}</span>
    </div>
  );
}

function InfoModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <ModalShell label={title} onClose={onClose} panelClass="modal-card">
      <div className="drawer-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button>
      </div>
      <div className="modal-content">{children}</div>
    </ModalShell>
  );
}

function ModalShell({ label, onClose, panelClass, children }: { label: string; onClose: () => void; panelClass: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={panelClass} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panelRef}>
        {children}
      </div>
    </div>
  );
}

export default App;
