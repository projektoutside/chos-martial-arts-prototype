import type { AppTopic, BeltRank, BeltReadinessItem, Benefit, ClassRule, Instructor, Product, ProductCategory, Program, TermSection, Testimonial } from "./types";

export const studio = {
  name: "Cho's Martial Arts",
  address: "N89W16863 Appleton Ave. Menomonee Falls, Wisconsin 53051",
  phone: "(262) 251-6333",
  phoneHref: "tel:2622516333",
  smsHref: "sms:2622516333",
  mapsUrl: "https://maps.app.goo.gl/X6WJh1rQo967j1fC7",
  facebookUrl: "https://www.facebook.com/chosmenomoneefalls/",
  yelpUrl: "https://www.yelp.com/biz/chos-martial-arts-menomonee-falls",
  instagramUrl: "https://www.instagram.com/chos.mefalls/",
  reviewUrl: "https://search.google.com/local/writereview?placeid=ChIJk-txRaT_BIgRExORFyt9fh8"
};

export const navLinks = [
  { label: "Home", path: "/" },
  { label: "About Us", path: "/about-us" },
  { label: "Programs", path: "/programs" },
  { label: "Private Lessons", path: "/private-lessons" },
  { label: "Classes", path: "/classes" },
  { label: "Shop", path: "/shop" },
  { label: "Contact Us", path: "/contact-us" }
];

export const studentTopics: AppTopic[] = [
  { slug: "today", label: "Today", summary: "See what to do next.", path: "/", tone: "today", group: "student" },
  { slug: "classes", label: "Classes", summary: "Find today and this week.", path: "/classes", tone: "schedule", group: "student" },
  { slug: "progress", label: "My Progress", summary: "Check belt rank and goals.", path: "/my-account?topic=progress", tone: "progress", group: "student" },
  { slug: "practice", label: "Practice", summary: "Review simple training goals.", path: "/programs?section=practice", tone: "practice", group: "student" },
  { slug: "programs", label: "Programs", summary: "Pick a training path.", path: "/programs", tone: "training", group: "student" },
  { slug: "help", label: "Ask for Help", summary: "Send a quick question.", path: "/contact-us", tone: "contact", group: "student" }
];

export const parentTopics: AppTopic[] = [
  { slug: "shop", label: "Shop", summary: "Uniforms and gear.", path: "/shop", tone: "shop", group: "parent" },
  { slug: "bookings", label: "Bookings", summary: "Saved class requests.", path: "/my-account?topic=bookings", tone: "bookings", group: "parent" },
  { slug: "orders", label: "Orders", summary: "Pickup and order history.", path: "/my-account?topic=orders", tone: "orders", group: "parent" },
  { slug: "profile", label: "Profile", summary: "Student contact settings.", path: "/my-account?topic=profile", tone: "profile", group: "parent" }
];

export const moreTopics: AppTopic[] = [
  ...parentTopics,
  { slug: "private-lessons", label: "Private Lessons", summary: "Request one-on-one instructor time.", path: "/private-lessons", tone: "lesson", group: "parent" },
  { slug: "about", label: "About Cho's", summary: "Studio story and instructors.", path: "/about-us", tone: "about", group: "parent" },
  { slug: "contact", label: "Contact", summary: "Call, message, or visit Cho's.", path: "/contact-us", tone: "contact", group: "parent" },
  { slug: "terms", label: "Terms", summary: "Policies and prototype terms.", path: "/terms-and-conditions", tone: "terms", group: "parent" }
];

export const appTopics: AppTopic[] = [...studentTopics, ...parentTopics];

export const beltRanks: BeltRank[] = [
  {
    slug: "white",
    name: "White",
    color: "#f4f4ef",
    textColor: "#151515",
    level: "Foundation",
    focus: "Beginner etiquette, stance, attention, basic blocks, and first kicks.",
    meaning: "A clean start: the student is learning how to train safely and respectfully.",
    classesRequired: 8
  },
  {
    slug: "yellow",
    name: "Yellow",
    color: "#f3c400",
    textColor: "#161109",
    level: "Early Growth",
    focus: "Stronger front kicks, basic combinations, balance, and class confidence.",
    meaning: "Like sunlight on new growth, fundamentals begin to take root.",
    classesRequired: 14
  },
  {
    slug: "orange",
    name: "Orange",
    color: "#ef7a16",
    textColor: "#1b0b03",
    level: "Building Power",
    focus: "Timing, turning kicks, stance transitions, and basic self-defense patterns.",
    meaning: "Energy increases as the student learns to connect movement with intent.",
    classesRequired: 20
  },
  {
    slug: "green",
    name: "Green",
    color: "#1f7a3b",
    textColor: "#ffffff",
    level: "Growth",
    focus: "Cleaner forms, controlled partner work, stronger chambers, and improved flexibility.",
    meaning: "Skills are growing into dependable habits.",
    classesRequired: 28
  },
  {
    slug: "blue",
    name: "Blue",
    color: "#075bb8",
    textColor: "#ffffff",
    level: "Expansion",
    focus: "Higher kicks, sparring control, footwork, and faster combinations.",
    meaning: "The student reaches upward with broader skill and discipline.",
    classesRequired: 38
  },
  {
    slug: "purple",
    name: "Purple",
    color: "#6531a3",
    textColor: "#ffffff",
    level: "Refinement",
    focus: "Precision, rhythm, reaction drills, and leadership through example.",
    meaning: "A transition rank where technical details become more visible.",
    classesRequired: 48
  },
  {
    slug: "brown",
    name: "Brown",
    color: "#7a4a2a",
    textColor: "#ffffff",
    level: "Maturity",
    focus: "Advanced basics, stronger self-defense, endurance, and steady testing habits.",
    meaning: "Training has taken root and starts to mature.",
    classesRequired: 62
  },
  {
    slug: "red",
    name: "Red",
    color: "#c51625",
    textColor: "#ffffff",
    level: "Control",
    focus: "Power with restraint, advanced combinations, and calm decision-making under pressure.",
    meaning: "A reminder that power must be controlled with discipline.",
    classesRequired: 78
  },
  {
    slug: "dark-brown",
    name: "Dark Brown",
    color: "#352315",
    textColor: "#f5d38a",
    level: "Black Belt Prep",
    focus: "Testing readiness, leadership habits, advanced forms, and instructor review.",
    meaning: "The student is preparing to transition from color-belt training to black-belt standards.",
    classesRequired: 96
  },
  {
    slug: "black",
    name: "Black",
    color: "#111111",
    textColor: "#f5d38a",
    level: "Black Belt",
    focus: "Consistent mastery, mentorship, humility, and continued lifelong learning.",
    meaning: "Not an endpoint: a new beginning with higher responsibility.",
    classesRequired: 120
  }
];

export const beltReadinessItems: BeltReadinessItem[] = [
  {
    id: "attendance",
    label: "Attendance rhythm",
    detail: "Consistent class attendance and active participation."
  },
  {
    id: "basics",
    label: "Basics and kicks",
    detail: "Stances, blocks, punches, chambers, and kicks performed with control."
  },
  {
    id: "forms",
    label: "Forms or poomsae",
    detail: "Memory, rhythm, focus, and clean transitions through the assigned pattern."
  },
  {
    id: "self-defense",
    label: "Self-defense",
    detail: "Age-appropriate escapes, distancing, assertiveness, and practical responses."
  },
  {
    id: "sparring-control",
    label: "Partner control",
    detail: "Safe sparring habits, respect for partners, and controlled contact."
  },
  {
    id: "character",
    label: "Respect and leadership",
    detail: "Discipline, courtesy, effort, and helping the class culture stay strong."
  },
  {
    id: "instructor-review",
    label: "Instructor review",
    detail: "Final readiness check by an instructor before promotion testing."
  }
];

export const programs: Program[] = [
  {
    slug: "youth-taekwondo",
    title: "Youth Taekwondo",
    shortDescription:
      "Develop leadership by leading; respect by modeling; social skills through interaction; teamwork via collaboration; self-esteem with success; and bully-proofing through assertiveness and understanding.",
    detail:
      "Youth Taekwondo blends discipline, confidence, and age-appropriate technical training. Students learn to lead, listen, work with others, and respond to pressure with calm assertiveness.",
    imageAlt: "Kids in uniforms practicing taekwondo in a bright dojo"
  },
  {
    slug: "mma-kickboxing",
    title: "MMA Kickboxing",
    shortDescription:
      "Master powerful kicks, punches, and proper stances alongside enhanced cardio, flexibility, and speed, while also dominating ground fighting through grappling and submissions, seamlessly blending striking arts like boxing and taekwondo.",
    detail:
      "MMA Kickboxing combines striking fundamentals, stance work, conditioning, and controlled ground concepts for adults who want fitness with practical technique.",
    imageAlt: "Martial artists training kicks and punches on heavy bags"
  },
  {
    slug: "self-defense-courses",
    title: "Self-Defense Courses",
    shortDescription:
      "Empower yourself with practical self-defense skills by mastering effective joint locks, pressure point techniques, and takedown maneuvers.",
    detail:
      "Self-defense courses focus on practical choices under pressure, vital target awareness, joint locks, escapes, pressure points, and safe takedown concepts.",
    imageAlt: "Instructor demonstrating self-defense with a student"
  },
  {
    slug: "cardio-kickboxing",
    title: "Cardio Kickboxing",
    shortDescription:
      "Experience an electrifying, full-body workout fusing dynamic martial arts moves with intense strength and endurance conditioning.",
    detail:
      "Cardio Kickboxing is a high-energy conditioning class using martial arts movement patterns, bag work, intervals, and strength circuits.",
    imageAlt: "Boxing gloves and wraps beside a studio heavy bag"
  }
];

export const apartCards = [
  {
    title: "Comprehensive, Realistic Self-Defense Training",
    content:
      "Training is rooted in authentic Jidokwan tradition and practical real-world self-defense. Students learn how to strike vital targets including the head, legs, and body with elbows, knees, punches, and kicks, while practicing realistic sparring and situational defense so they can avoid freezing under pressure."
  },
  {
    title: "Expert, Hands-On Instruction",
    content:
      "Classes are led by highly experienced instructors, former champions, and seasoned black belts who provide direct guidance, correction, and mentorship."
  },
  {
    title: "A Culture of Respect and Growth",
    content:
      "Cho's builds respect, discipline, and personal development in a supportive but challenging environment where students grow in confidence and character."
  }
];

export const benefits: Benefit[] = [
  { title: "Self-Defense", summary: "Practical awareness and response skills.", detail: "Students learn distance, timing, escape choices, and confident responses to common pressure situations." },
  { title: "Self-Confidence", summary: "Confidence through earned progress.", detail: "Structured practice, public effort, and belt goals help students become more comfortable trying hard things." },
  { title: "Belts and Ranking", summary: "Visible goals and achievement.", detail: "Ranking milestones give students a clear path, accountability, and pride in steady improvement." },
  { title: "Discipline", summary: "Focus, consistency, and respect.", detail: "Class etiquette and repeated practice build habits that carry into school, work, and family life." },
  { title: "Individual Achievement: No One Sits on the Bench", summary: "Every student participates.", detail: "Martial arts lets each student progress from their own starting point without waiting for playing time." },
  { title: "Gender Equality", summary: "Shared standards and respect.", detail: "Students train side by side with the same expectations for focus, safety, and effort." },
  { title: "Weight Control", summary: "Conditioning with purpose.", detail: "Classes combine movement, strength, cardio, and coordination in a way that feels purposeful and repeatable." },
  { title: "You Can Do It With Them", summary: "Families can train together.", detail: "Parents and children can share goals, practice outside class, and support each other's progress." },
  { title: "The Never-Ending Season", summary: "A year-round path.", detail: "Training is not limited to a short season, so students keep building skills and friendships all year." }
];

export const instructors: Instructor[] = [
  {
    name: "Grandmaster Ung Cho",
    role: "7th-Degree Black Belt",
    highlights: [
      "Former Korean and U.S. National Champion",
      "Over 55 Years of Martial Arts Experience",
      "Specializes in Mental and Physical Health",
      "Trained Many State and U.S. Champions",
      "Personally Teaches Classes"
    ],
    bio:
      "Grandmaster Ung Cho continues the family tradition with personal instruction rooted in championship-level technique, wellness, discipline, and long-term student development.",
    imageAlt: "Grandmaster instructor in a martial arts uniform"
  },
  {
    name: "Master John Kim",
    role: "5th Degree Black Belt",
    highlights: [
      "Former Canadian champion",
      "Certified Personal Trainer and Fitness Conditioning Specialist",
      "Over 20 Years of Martial Arts Experience",
      "Personally Teaches All Youth Classes",
      "Specializes in Children's Rehabilitation"
    ],
    bio:
      "Master John Kim brings patient, focused instruction to youth classes, combining martial arts experience with fitness conditioning and developmental support.",
    imageAlt: "Youth class instructor supporting a student"
  },
  {
    name: "Youth Instructor Hailey Tilkens",
    role: "Third Degree Black Belt Instructor",
    highlights: ["Part of Cho's family over 15 years", "Values self-pride, worldwide experience, and friendships"],
    bio:
      "Hailey Tilkens describes martial arts as an exhilarating workout and a source of self-pride, travel, experience, and lasting friendships.",
    imageAlt: "Youth instructor leading students through forms"
  },
  {
    name: "Youth Instructor Bennet Finnern",
    role: "Youth Instructor",
    highlights: ["Trained at Cho's for 10 years", "Instructing over 5 years", "Started for confidence"],
    bio:
      "Bennet Finnern gained confidence and lifelong friendships through training and now shares that knowledge with younger students.",
    imageAlt: "Youth instructor coaching basic stance"
  },
  {
    name: "Youth Instructor Major Artis",
    role: "2nd Degree Black Belt",
    highlights: ["Began training at 22", "Earned medals and trophies", "Earned 2nd Degree Black Belt at 55 in 2025"],
    bio:
      "Major Artis continued training at Menomonee Falls in 2018 and sees martial arts as a way of life first and defense second.",
    imageAlt: "Adult instructor standing in a training room"
  }
];

export const testimonials: Testimonial[] = [
  { name: "Davonte Jackson", excerpt: "My first introductory lesson was comfortable, welcoming, and left me excited to keep learning martial arts." },
  { name: "Toya Mosby", excerpt: "We are new at Cho's. Sir John is patient and my son's confidence and discipline are already improving." },
  { name: "Meredith Fairly", excerpt: "My 7-year-old daughter has progressed from white belt with better strength, coordination, and confidence. Instructor John Kim is very supportive." },
  { name: "Paul Mackey", excerpt: "Cho's is transforming my son's life. His confidence is growing, and Master John is patient, focused, and steady." },
  { name: "Tony Esparza", excerpt: "After 8 years at Cho's, I can say Grandmaster Cho and Master John are true experts. Sparring is balanced and high belts help teach." },
  { name: "Vanessa Melendez", excerpt: "My kids have attended for 7 years. Cho's teaches discipline, perseverance, work ethic, and feels like a welcoming family." }
];

export const products: Product[] = [
  { slug: "starter-program", name: "Starter Program", categories: ["starter-program"], price: 29.95, displayPrice: "From: $29.95", type: "booking", description: "Once you've completed your first startup private class, we'll be happy to help you schedule your second private class. Just let us know when you're ready, and we'll take care of the rest!", sku: "CHOS-START", imageAlt: "Beginner student training one-on-one in the dojo", relatedSlugs: ["leadership-uniform", "white-basic-uniform-w-patches-and-logo", "chos-combat-shirt"] },
  { slug: "leadership-uniform", name: "Leadership uniform", categories: ["uniforms"], price: 125, displayPrice: "$125.00", description: "Premium leadership uniform for dedicated students. Pick up in person and try it on for the perfect fit.", sku: "UNI-LEAD", imageAlt: "Premium martial arts leadership uniform", relatedSlugs: ["uniform-black-cross-over-w-patches-and-logo", "upgraded-red-blk-v-neck", "white-basic-uniform-w-patches-and-logo"] },
  { slug: "chos-combat-shirt", name: "Cho's combat shirt", categories: ["chos-apparel"], price: 20, displayPrice: "$20.00", description: "Comfortable Cho's apparel for training days and casual wear. Pick up in person and try it on for the perfect fit.", sku: "APP-COMBAT", imageAlt: "Black Cho's combat shirt", relatedSlugs: ["leadership-uniform", "mma-duffle-bag", "basic-hand-wraps-black"] },
  { slug: "basic-hand-wraps-black", name: "Basic hand wraps Black", categories: ["adult-sparring-equipment"], price: 10, displayPrice: "$10.00", description: "Basic black hand wraps for adult striking classes.", sku: "AWRAP-BLK", imageAlt: "Black hand wraps for boxing and kickboxing", relatedSlugs: ["basic-hand-wraps-red", "c2-16oz-boxing-gloves", "c2-black-blue-16oz-sparring-gloves"] },
  { slug: "mma-elbow-pads-l-xl-red", name: "MMA Elbow Pads L/XL Red", categories: ["adult-sparring-equipment"], price: 32, displayPrice: "$32.00", description: "Red L/XL elbow pads for controlled MMA training.", sku: "ELB-RED-LXL", imageAlt: "Red MMA elbow pads", relatedSlugs: ["mma-elbow-pads-l-xl-black", "krbn-mma-shin-guards-l-xl", "c2-mma-sparring-head-guard-l-xl"] },
  { slug: "mma-duffle-bag", name: "MMA Duffle Bag", categories: ["youth-sparring-equipment", "adult-sparring-equipment"], price: 45, displayPrice: "$45.00", description: "Durable MMA duffle bag for carrying uniforms, gloves, and sparring gear.", sku: "BAG-MMA", imageAlt: "MMA duffle bag with training gear", relatedSlugs: ["mouth-piece-case", "chos-combat-shirt", "leadership-uniform"] },
  { slug: "mouth-piece-case", name: "Mouth piece + Case", categories: ["youth-sparring-equipment", "adult-sparring-equipment"], price: 7, displayPrice: "$7.00", description: "Mouth piece with protective case for youth and adult sparring.", sku: "MOUTH-CASE", imageAlt: "Mouth guard and protective case", relatedSlugs: ["mma-duffle-bag", "tkd-head-guard-w-logo", "adult-inside-groin-cup"] },
  { slug: "upgraded-red-blk-v-neck", name: "Upgraded Red/blk V-neck", categories: ["uniforms"], price: 65, displayPrice: "$65.00", description: "Upgraded red and black V-neck uniform. Pick up in person and try it on for the perfect fit.", sku: "UNI-RED-BLK", imageAlt: "Red and black V-neck martial arts uniform", relatedSlugs: ["leadership-uniform", "uniform-black-cross-over-w-patches-and-logo", "white-basic-uniform-w-patches-and-logo"] },
  { slug: "youth-groin-cup", name: "Youth Groin Cup", categories: ["youth-sparring-equipment"], price: 15, displayPrice: "$15.00", description: "Youth protective groin cup for sparring safety.", sku: "Y-CUP", imageAlt: "Youth protective sparring cup", relatedSlugs: ["tkd-head-guard-w-logo", "youth-6oz-boxing-gloves", "krbn-mma-shin-guard"] },
  { slug: "youth-6oz-boxing-gloves", name: "Youth 6oz boxing gloves", categories: ["gloves"], price: 39, displayPrice: "$39.00", description: "Youth 6oz boxing gloves for beginner striking and bag training.", sku: "GLOVE-Y-6OZ", imageAlt: "Youth boxing gloves", relatedSlugs: ["c2-16oz-boxing-gloves", "c2-black-blue-16oz-sparring-gloves", "mouth-piece-case"] },
  { slug: "white-basic-uniform-w-patches-and-logo", name: "White Basic Uniform w/ patches and logo", categories: ["uniforms"], price: 39, displayPrice: "$39.00", description: "White basic uniform with patches and logo. Pick up in person and try it on for the perfect fit.", sku: "UNI-WHITE", imageAlt: "White basic martial arts uniform with patches", relatedSlugs: ["leadership-uniform", "uniform-black-cross-over-w-patches-and-logo", "upgraded-red-blk-v-neck"] },
  { slug: "uniform-black-cross-over-w-patches-and-logo", name: "Uniform (Black cross-over w/ patches and logo)", categories: ["uniforms"], price: 70, displayPrice: "$70.00", description: "Black cross-over uniform with patches and logo. Pick up in person and try it on for the perfect fit.", sku: "UNI-BLACK-X", imageAlt: "Black cross-over martial arts uniform", relatedSlugs: ["leadership-uniform", "upgraded-red-blk-v-neck", "white-basic-uniform-w-patches-and-logo"] },
  { slug: "adult-inside-groin-cup", name: "Adult inside groin cup", categories: ["adult-sparring-equipment"], price: 15, displayPrice: "$15.00", description: "Adult inside groin cup for sparring protection.", sku: "A-CUP", imageAlt: "Adult protective sparring cup", relatedSlugs: ["mouth-piece-case", "krbn-mma-shin-guards-l-xl", "c2-mma-sparring-head-guard-l-xl"] },
  { slug: "tkd-head-guard-w-logo", name: "TKD head guard w/ Logo", categories: ["youth-sparring-equipment"], price: 29, displayPrice: "$29.00", description: "Youth TKD head guard with Cho's logo for controlled sparring.", sku: "Y-HEAD-TKD", imageAlt: "Taekwondo head guard with logo", relatedSlugs: ["youth-groin-cup", "mouth-piece-case", "krbn-mma-shin-guard"] },
  { slug: "mma-elbow-pads-l-xl-black", name: "MMA Elbow Pads L/XL Black", categories: ["adult-sparring-equipment"], price: 32, displayPrice: "$32.00", description: "Black L/XL elbow pads for adult MMA technique training.", sku: "ELB-BLK-LXL", imageAlt: "Black MMA elbow pads", relatedSlugs: ["mma-elbow-pads-l-xl-red", "krbn-mma-shin-guards-l-xl", "c2-mma-sparring-head-guard-l-xl"] },
  { slug: "krbn-mma-shin-guards-l-xl", name: "KRBN MMA Shin Guards L/XL", categories: ["adult-sparring-equipment"], price: 82, displayPrice: "$82.00", description: "Adult L/XL KRBN MMA shin guards for sparring.", sku: "SHIN-A-LXL", imageAlt: "Adult MMA shin guards", relatedSlugs: ["mma-elbow-pads-l-xl-black", "c2-mma-sparring-head-guard-l-xl", "mma-duffle-bag"] },
  { slug: "krbn-mma-shin-guard", name: "KRBN MMA Shin guard", categories: ["youth-sparring-equipment"], price: 82, displayPrice: "$82.00", description: "Youth KRBN MMA shin guard for sparring training.", sku: "SHIN-Y", imageAlt: "Youth MMA shin guard", relatedSlugs: ["tkd-head-guard-w-logo", "youth-6oz-boxing-gloves", "mma-duffle-bag"] },
  { slug: "c2-black-blue-16oz-sparring-gloves", name: "C2 black/blue 16oz sparring gloves", categories: ["gloves"], price: 53, displayPrice: "$53.00", description: "Black and blue 16oz sparring gloves for controlled striking.", sku: "GLOVE-C2-BB-16", imageAlt: "Black and blue 16oz sparring gloves", relatedSlugs: ["c2-16oz-boxing-gloves", "youth-6oz-boxing-gloves", "basic-hand-wraps-black"] },
  { slug: "c2-mma-sparring-head-guard-l-xl", name: "C2 MMA Sparring head guard L/XL", categories: ["adult-sparring-equipment"], price: 53, displayPrice: "$53.00", description: "Adult L/XL MMA sparring head guard.", sku: "HEAD-C2-LXL", imageAlt: "Adult MMA sparring head guard", relatedSlugs: ["krbn-mma-shin-guards-l-xl", "mma-elbow-pads-l-xl-black", "mouth-piece-case"] },
  { slug: "c2-16oz-boxing-gloves", name: "C2 16oz Boxing gloves", categories: ["gloves"], price: 53, displayPrice: "$53.00", description: "C2 16oz boxing gloves for adult striking and bag work.", sku: "GLOVE-C2-16", imageAlt: "C2 16oz boxing gloves", relatedSlugs: ["c2-black-blue-16oz-sparring-gloves", "youth-6oz-boxing-gloves", "basic-hand-wraps-red"] },
  { slug: "basic-hand-wraps-red", name: "Basic hand wraps red", categories: ["adult-sparring-equipment"], price: 10, displayPrice: "$10.00", description: "Basic red hand wraps for striking classes.", sku: "AWRAP-RED", imageAlt: "Red hand wraps for boxing and kickboxing", relatedSlugs: ["basic-hand-wraps-black", "c2-16oz-boxing-gloves", "c2-black-blue-16oz-sparring-gloves"] }
];

export const categories: ProductCategory[] = [
  { slug: "starter-program", name: "Starter Program", productSlugs: ["starter-program"] },
  { slug: "uniforms", name: "Uniforms", productSlugs: ["leadership-uniform", "uniform-black-cross-over-w-patches-and-logo", "upgraded-red-blk-v-neck", "white-basic-uniform-w-patches-and-logo"] },
  { slug: "gloves", name: "Gloves", productSlugs: ["c2-16oz-boxing-gloves", "c2-black-blue-16oz-sparring-gloves", "youth-6oz-boxing-gloves"] },
  { slug: "youth-sparring-equipment", name: "Youth Sparring Equipment", productSlugs: ["krbn-mma-shin-guard", "mma-duffle-bag", "mouth-piece-case", "tkd-head-guard-w-logo", "youth-groin-cup"] },
  { slug: "adult-sparring-equipment", name: "Adult Sparring Equipment", productSlugs: ["adult-inside-groin-cup", "basic-hand-wraps-black", "basic-hand-wraps-red", "c2-mma-sparring-head-guard-l-xl", "krbn-mma-shin-guards-l-xl", "mma-duffle-bag", "mma-elbow-pads-l-xl-black", "mma-elbow-pads-l-xl-red", "mouth-piece-case"] },
  { slug: "chos-apparel", name: "Cho's Apparel", productSlugs: ["chos-combat-shirt"] }
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProductsForCategory(slug: string) {
  const category = getCategory(slug);
  if (!category) return [];
  return category.productSlugs.map((productSlug) => getProduct(productSlug)).filter((product): product is Product => Boolean(product));
}

export const classRules: ClassRule[] = [
  { id: "private-lessons", title: "Private Lessons", weekdays: [1, 2, 3, 4, 5, 6], startTime: "12:30 PM", endTime: "4:30 PM", description: "Appointment only, call (262) 251-6333 to book." },
  { id: "youth-beginners", title: "Youth Beginners Martial Training", weekdays: [1, 3], startTime: "5:00 PM", endTime: "5:40 PM", description: "Beginner youth martial arts fundamentals and confidence building." },
  { id: "youth-advanced", title: "Youth Advanced Martial arts Training", weekdays: [1, 3], startTime: "5:50 PM", endTime: "6:50 PM", description: "Advanced youth training for students ready for more technical work." },
  { id: "mma-advanced", title: "MMA Advanced Technique Training", weekdays: [1, 3], startTime: "7:00 PM", endTime: "8:00 PM", ageNote: "Age 18 - up", description: "Advanced MMA technique training for adult students." },
  { id: "little-dragons", title: "Little Dragons (4-6 years old)", weekdays: [2, 4], startTime: "5:20 PM", endTime: "6:00 PM", description: "Age-appropriate fundamentals for young students." },
  { id: "youth-blackbelt", title: "Youth Advance Blackbelt Class", weekdays: [2, 4], startTime: "6:00 PM", endTime: "6:50 PM", description: "Advanced youth blackbelt preparation and leadership training." },
  { id: "mma-fitness", title: "MMA Martial Arts and Fitness Training", weekdays: [2, 4], startTime: "7:00 PM", endTime: "8:00 PM", ageNote: "Age 18 - up", description: "Adult MMA fitness and martial arts conditioning." },
  { id: "youth-makeup", title: "Youth Makeup Class", weekdays: [5], startTime: "5:00 PM", endTime: "5:40 PM", description: "Makeup session for youth students." },
  { id: "mma-sparring", title: "MMA Sparring", weekdays: [5], startTime: "6:00 PM", endTime: "7:00 PM", ageNote: "Age 18 - up", description: "Controlled adult MMA sparring with safety-focused coaching." }
];

export const termsSections: TermSection[] = [
  { title: "Legal Notice", content: "Notices from Cho's Martial Arts may be posted on the website and are deemed delivered within thirty days. Notices from the user should be made by regular or first-class mail to the provided address." },
  { title: "Copyright Notice", content: "All content is property of Cho's Martial Arts. Copyright © 2026. Users may view, copy, print, and distribute documents for informational purposes when the copyright notice is retained." },
  { title: "Trademarks", content: "Brand, product, service, and process names belong to their respective holders. Nothing on this prototype implies a license or right to use those marks." },
  { title: "Terms of Use", content: "Information may contain inaccuracies or change without notice. Product pricing and availability may change. Cho's Martial Arts reserves the right to refuse service, terminate accounts, or cancel orders." },
  { title: "Privacy Policy", content: "Personal data supports the site experience, account access, order handling, booking requests, and related prototype purposes." },
  { title: "Shipping and Delivery", content: "Merchandise may ship within the United States and U.S. territories, plus Canada and Mexico, but not other international locations." },
  { title: "International", content: "Customs and import duties are the recipient's responsibility. Users should verify local shipping laws before ordering." },
  { title: "Sales Tax", content: "Sales tax is charged based on applicable state sales tax and shipping or pickup location." },
  { title: "Warranties", content: "Content is provided as-is without warranties. Cho's Martial Arts is not liable for special, indirect, incidental, or consequential damages." },
  { title: "Return Policy", content: "Purchases may be made using available payment options. Payment procedures may change without notice." },
  { title: "Miscellaneous", content: "Offers are void where prohibited. Governing law and jurisdiction terms apply. These terms constitute the entire agreement." }
];
