import type { CaseStudy, FaqItem, ProcessStep, Service } from "./types";

// SAMPLE / DRAFT CONTENT. Replace with real content (see CONTENT_NEEDED.md). Delete `isDemo: true` only when real.

export const services: Service[] = [
  {
    slug: "web-applications",
    title: "Web applications",
    summary: "Custom web apps for business workflows, customer portals and internal operations.",
    description:
      "We design and build web applications around how your business actually works: the people involved, the data they handle and the decisions they need to make. Scope, assumptions and timeline are agreed in writing before the build starts.",
    deliverables: [
      "Requirements and scope document",
      "User interface design",
      "Working, tested application",
      "Deployment and handover",
    ],
    isDemo: true,
  },
  {
    slug: "business-websites",
    title: "Business websites",
    summary: "Fast, search-friendly websites that explain what you do and make it easy to get in touch.",
    description:
      "Clear structure, readable content and solid technical foundations: good performance, accessible pages and sensible search metadata, so the site is easy to use and easy to find.",
    deliverables: ["Page structure and copy review", "Responsive design", "Contact and inquiry forms", "Launch checklist"],
    isDemo: true,
  },
  {
    slug: "mobile-apps",
    title: "Mobile apps",
    summary: "Apps for phones and tablets that connect to your systems and your customers.",
    description:
      "We help you decide what belongs in a mobile app, then build and release it with a focus on reliability and a clear upgrade path.",
    deliverables: ["Feature prioritisation", "App design", "Build and testing", "Store release support"],
    isDemo: true,
  },
  {
    slug: "e-commerce",
    title: "E-commerce",
    summary: "Online stores with catalogue, checkout and order management suited to your market.",
    description:
      "We build stores around your products, delivery rules and payment options, and keep the buying flow simple for customers and the order flow manageable for your team.",
    deliverables: ["Catalogue and checkout design", "Order management", "Payment integration plan", "Launch support"],
    isDemo: true,
  },
  {
    slug: "internal-tools",
    title: "Internal tools and dashboards",
    summary: "Replace spreadsheets and manual steps with tools your team actually uses.",
    description:
      "We turn repetitive manual work into focused tools with the right permissions, so the right people see the right information.",
    deliverables: ["Workflow mapping", "Role-based access", "Reports and dashboards", "Team onboarding"],
    isDemo: true,
  },
  {
    slug: "apis-and-integrations",
    title: "APIs and integrations",
    summary: "Connect the systems you already use so data flows without re-typing.",
    description:
      "We design and build integrations between your applications, payment providers and third-party services, with clear error handling and documentation.",
    deliverables: ["Integration design", "API development", "Error handling and monitoring", "Documentation"],
    isDemo: true,
  },
];

export const caseStudies: CaseStudy[] = [
  {
    slug: "sample-booking-platform",
    title: "Sample project: appointment booking platform",
    category: "Web application",
    summary: "A placeholder case study showing how real projects will be presented here.",
    challenge:
      "Placeholder: describe the business problem the client faced, in plain language and without confidential details.",
    approach:
      "Placeholder: explain how the problem was scoped, what trade-offs were made and how the work was delivered.",
    features: ["Placeholder feature one", "Placeholder feature two", "Placeholder feature three"],
    stack: ["Next.js", "MongoDB", "TypeScript"],
    outcomes: [],
    serviceSlug: "web-applications",
    isDemo: true,
  },
  {
    slug: "sample-inventory-dashboard",
    title: "Sample project: inventory dashboard",
    category: "Internal tool",
    summary: "A second placeholder showing an internal tool case study layout.",
    challenge: "Placeholder: what was slow, error-prone or invisible before this tool existed?",
    approach: "Placeholder: how the workflow was mapped and what was built first.",
    features: ["Placeholder feature one", "Placeholder feature two"],
    stack: ["Next.js", "MongoDB"],
    outcomes: [],
    serviceSlug: "internal-tools",
    isDemo: true,
  },
];

export const processSteps: ProcessStep[] = [
  { title: "Discovery", description: "We learn the problem, the users and the constraints before proposing anything." },
  { title: "Proposal", description: "You receive written scope, assumptions, deliverables, timeline and terms." },
  { title: "Design", description: "Key screens and flows are designed and reviewed with you before development." },
  { title: "Build", description: "We build in small increments so you can see real progress." },
  { title: "QA", description: "We test the important flows, on real devices where it matters, and fix what we find." },
  { title: "Deployment", description: "We release carefully and confirm everything works in production." },
  { title: "Support", description: "After launch we fix issues and agree what ongoing support you need." },
];

export const faqs: FaqItem[] = [
  {
    question: "How do I start a project?",
    answer:
      "Send an inquiry through the contact page or email us. Describe the problem you are solving and who will use the software, and we will reply by email to discuss next steps.",
    isDemo: true,
  },
  {
    question: "What should I include in my inquiry?",
    answer:
      "What the software should do, who will use it, any systems it must connect to, and your rough timeframe and budget if you have them. Nothing needs to be final.",
    isDemo: true,
  },
  {
    question: "How do you give estimates?",
    answer:
      "After understanding your needs we share a written proposal with scope, assumptions, deliverables and a timeline. We aim for realistic estimates and say clearly where there is uncertainty.",
    isDemo: true,
  },
  {
    question: "Where are you based?",
    answer: "We are based in Peshawar, Pakistan. You can reach us by email, phone or WhatsApp.",
    isDemo: true,
  },
];