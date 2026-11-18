/**
 * The demo agency: a small UK studio with eight clients. Names are
 * invented; each client has a personality (growing, slipping, slow site,
 * flaky host) so every part of the report has something real to show.
 */

export type ReportStatus = "collecting" | "draft" | "in_review" | "approved" | "sent" | "failed";

export interface DemoOrg {
  id: string;
  name: string;
  senderName: string;
  senderEmail: string;
  primary: string;
  accent: string;
  footer: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "viewer";
  initials: string;
}

export interface DemoSiteProfile {
  /** Monthly click growth, e.g. 0.04 = +4% a month. */
  growth: number;
  /** Clicks per day at the start of the 16-month history. */
  baseClicks: number;
  /** Field LCP in ms; drives the speed story. */
  lcp: number;
  inp: number;
  cls: number;
  /** Probability of an outage on any day. */
  outageRate: number;
  certDays: number;
  domainDays: number;
  /** Optional one-off dip in the reporting month (algorithm update, migration). */
  shock?: number;
}

export interface DemoSite {
  id: string;
  clientId: string;
  url: string;
  gscProperty: string;
  brandedRegex: string;
  keyPages: string[];
  uptimeKeyword: string;
  topic: { services: string[]; places: string[]; brand: string[] };
  profile: DemoSiteProfile;
}

export interface DemoClient {
  id: string;
  name: string;
  initials: string;
  sector: string;
  contact: { name: string; email: string };
  timezone: string;
  reportDay: number;
  manager: string; // user id
  autoSend: boolean;
  aiEnabled: boolean;
  reportStatus: ReportStatus;
  since: string;
}

export const ORG: DemoOrg = {
  id: "org_northfold",
  name: "Northfold Studio",
  senderName: "Northfold Studio",
  senderEmail: "reports@northfold.studio",
  primary: "#1f4d3f",
  accent: "#c8763b",
  footer: "Northfold Studio · 14 Mill Lane, Hebden Bridge HX7 8AD",
};

export const USERS: DemoUser[] = [
  { id: "usr_amara", name: "Amara Osei", email: "amara@northfold.studio", role: "owner", initials: "AO" },
  { id: "usr_tom", name: "Tom Haverley", email: "tom@northfold.studio", role: "manager", initials: "TH" },
  { id: "usr_priya", name: "Priya Lal", email: "priya@northfold.studio", role: "manager", initials: "PL" },
  { id: "usr_finn", name: "Finn Doyle", email: "finn@northfold.studio", role: "viewer", initials: "FD" },
];

export const CLIENTS: DemoClient[] = [
  {
    id: "cli_harlow", name: "Harlow & Finch Dental", initials: "HF", sector: "Dental practice",
    contact: { name: "Dr Ruth Harlow", email: "ruth@harlowfinch-dental.test" },
    timezone: "Europe/London", reportDay: 3, manager: "usr_tom", autoSend: false, aiEnabled: true,
    reportStatus: "in_review", since: "2024-03",
  },
  {
    id: "cli_pennine", name: "Pennine Trail Outfitters", initials: "PT", sector: "Outdoor retail",
    contact: { name: "Gareth Molloy", email: "gareth@pennine-trail.test" },
    timezone: "Europe/London", reportDay: 3, manager: "usr_priya", autoSend: false, aiEnabled: true,
    reportStatus: "draft", since: "2023-11",
  },
  {
    id: "cli_marlowe", name: "Marlowe Quay Solicitors", initials: "MQ", sector: "Law firm",
    contact: { name: "Helen Marlowe", email: "h.marlowe@marlowequay.test" },
    timezone: "Europe/London", reportDay: 4, manager: "usr_tom", autoSend: false, aiEnabled: false,
    reportStatus: "approved", since: "2024-06",
  },
  {
    id: "cli_kestrel", name: "Kestrel Physiotherapy", initials: "KP", sector: "Healthcare",
    contact: { name: "Imran Siddiqui", email: "imran@kestrelphysio.test" },
    timezone: "Europe/London", reportDay: 3, manager: "usr_priya", autoSend: true, aiEnabled: true,
    reportStatus: "sent", since: "2025-01",
  },
  {
    id: "cli_brightwater", name: "Brightwater Heating", initials: "BH", sector: "Trades",
    contact: { name: "Dean Ashworth", email: "dean@brightwater-heating.test" },
    timezone: "Europe/London", reportDay: 3, manager: "usr_tom", autoSend: false, aiEnabled: true,
    reportStatus: "draft", since: "2024-09",
  },
  {
    id: "cli_oakridge", name: "Oakridge Bakehouse", initials: "OB", sector: "Food & drink",
    contact: { name: "Sofia Brandt", email: "sofia@oakridgebakehouse.test" },
    timezone: "Europe/London", reportDay: 5, manager: "usr_priya", autoSend: true, aiEnabled: true,
    reportStatus: "sent", since: "2025-04",
  },
  {
    id: "cli_calder", name: "Calder Valley Vets", initials: "CV", sector: "Veterinary",
    contact: { name: "Owen Pritchard", email: "owen@caldervets.test" },
    timezone: "Europe/London", reportDay: 3, manager: "usr_tom", autoSend: false, aiEnabled: true,
    reportStatus: "failed", since: "2024-01",
  },
  {
    id: "cli_thornbury", name: "Thornbury Interiors", initials: "TI", sector: "Interior design",
    contact: { name: "Lucy Abara", email: "lucy@thornbury-interiors.test" },
    timezone: "Europe/Dublin", reportDay: 3, manager: "usr_priya", autoSend: false, aiEnabled: false,
    reportStatus: "collecting", since: "2025-08",
  },
];

export const SITES: DemoSite[] = [
  {
    id: "site_harlow", clientId: "cli_harlow", url: "https://www.harlowfinch-dental.test/",
    gscProperty: "sc-domain:harlowfinch-dental.test", brandedRegex: "harlow|finch",
    keyPages: ["/", "/treatments/invisalign/", "/treatments/dental-implants/", "/emergency-dentist/", "/book/"],
    uptimeKeyword: "Harlow & Finch",
    topic: {
      services: ["dentist", "dental implants", "invisalign", "teeth whitening", "emergency dentist", "composite bonding", "hygienist", "root canal treatment", "private dentist", "nhs dentist"],
      places: ["leeds", "headingley", "horsforth", "roundhay", "near me"],
      brand: ["harlow finch dental", "harlow and finch", "harlow finch headingley"],
    },
    profile: { growth: 0.028, baseClicks: 118, lcp: 2100, inp: 160, cls: 0.04, outageRate: 0.01, certDays: 64, domainDays: 211 },
  },
  {
    id: "site_pennine", clientId: "cli_pennine", url: "https://www.pennine-trail.test/",
    gscProperty: "sc-domain:pennine-trail.test", brandedRegex: "pennine trail",
    keyPages: ["/", "/collections/walking-boots/", "/collections/waterproof-jackets/", "/sale/", "/stores/"],
    uptimeKeyword: "Pennine Trail",
    topic: {
      services: ["walking boots", "waterproof jackets", "hiking backpacks", "camping stoves", "trail running shoes", "merino base layers", "gaiters", "trekking poles", "down jackets", "tents"],
      places: ["uk", "mens", "womens", "sale", "best"],
      brand: ["pennine trail", "pennine trail outfitters", "pennine trail discount code"],
    },
    profile: { growth: 0.012, baseClicks: 640, lcp: 3350, inp: 290, cls: 0.14, outageRate: 0.015, certDays: 41, domainDays: 400, shock: -0.21 },
  },
  {
    id: "site_marlowe", clientId: "cli_marlowe", url: "https://www.marlowequay.test/",
    gscProperty: "sc-domain:marlowequay.test", brandedRegex: "marlowe",
    keyPages: ["/", "/family-law/divorce/", "/conveyancing/", "/wills-and-probate/", "/contact/"],
    uptimeKeyword: "Marlowe Quay",
    topic: {
      services: ["divorce solicitor", "conveyancing", "will writing", "probate solicitor", "lasting power of attorney", "employment solicitor", "family law", "child arrangements", "no win no fee", "fixed fee divorce"],
      places: ["bristol", "clifton", "bath", "near me", "cost"],
      brand: ["marlowe quay", "marlowe quay solicitors", "marlowe solicitors bristol"],
    },
    profile: { growth: 0.019, baseClicks: 205, lcp: 2350, inp: 140, cls: 0.06, outageRate: 0.004, certDays: 17, domainDays: 96 },
  },
  {
    id: "site_kestrel", clientId: "cli_kestrel", url: "https://kestrelphysio.test/",
    gscProperty: "sc-domain:kestrelphysio.test", brandedRegex: "kestrel",
    keyPages: ["/", "/sports-massage/", "/back-pain/", "/book-online/"],
    uptimeKeyword: "Kestrel Physiotherapy",
    topic: {
      services: ["physiotherapist", "sports massage", "back pain treatment", "knee physio", "shoulder pain", "acupuncture", "running injury clinic", "neck pain", "sciatica treatment", "post surgery rehab"],
      places: ["york", "acomb", "near me", "private", "cost"],
      brand: ["kestrel physio", "kestrel physiotherapy york"],
    },
    profile: { growth: 0.051, baseClicks: 58, lcp: 1850, inp: 120, cls: 0.02, outageRate: 0.003, certDays: 77, domainDays: 330 },
  },
  {
    id: "site_brightwater", clientId: "cli_brightwater", url: "https://www.brightwater-heating.test/",
    gscProperty: "sc-domain:brightwater-heating.test", brandedRegex: "brightwater",
    keyPages: ["/", "/boiler-installation/", "/boiler-repair/", "/heat-pumps/", "/quote/"],
    uptimeKeyword: "Brightwater",
    topic: {
      services: ["boiler installation", "boiler repair", "boiler service", "new boiler cost", "combi boiler", "air source heat pump", "power flush", "central heating", "gas engineer", "emergency plumber"],
      places: ["manchester", "stockport", "salford", "near me", "price"],
      brand: ["brightwater heating", "brightwater boilers"],
    },
    profile: { growth: 0.036, baseClicks: 172, lcp: 2900, inp: 230, cls: 0.09, outageRate: 0.045, certDays: 52, domainDays: 22 },
  },
  {
    id: "site_oakridge", clientId: "cli_oakridge", url: "https://oakridgebakehouse.test/",
    gscProperty: "sc-domain:oakridgebakehouse.test", brandedRegex: "oakridge",
    keyPages: ["/", "/menu/", "/celebration-cakes/", "/visit/"],
    uptimeKeyword: "Oakridge",
    topic: {
      services: ["sourdough bakery", "celebration cakes", "birthday cakes", "brunch", "bakery cafe", "wedding cakes", "pastries", "gluten free cakes", "coffee shop", "cinnamon buns"],
      places: ["harrogate", "knaresborough", "near me", "best", "order"],
      brand: ["oakridge bakehouse", "oakridge bakery harrogate"],
    },
    profile: { growth: 0.022, baseClicks: 96, lcp: 2250, inp: 175, cls: 0.07, outageRate: 0.006, certDays: 88, domainDays: 180 },
  },
  {
    id: "site_calder", clientId: "cli_calder", url: "https://www.caldervets.test/",
    gscProperty: "sc-domain:caldervets.test", brandedRegex: "calder",
    keyPages: ["/", "/services/vaccinations/", "/emergency-vet/", "/register/"],
    uptimeKeyword: "Calder Valley Vets",
    topic: {
      services: ["vet", "emergency vet", "puppy vaccinations", "cat neutering", "dog dentistry", "pet insurance", "rabbit vet", "vet appointment", "exotic vet", "dog microchipping"],
      places: ["halifax", "hebden bridge", "todmorden", "near me", "24 hour"],
      brand: ["calder valley vets", "calder vets halifax"],
    },
    profile: { growth: -0.006, baseClicks: 230, lcp: 4400, inp: 380, cls: 0.21, outageRate: 0.02, certDays: 5, domainDays: 150 },
  },
  {
    id: "site_thornbury", clientId: "cli_thornbury", url: "https://thornbury-interiors.test/",
    gscProperty: "sc-domain:thornbury-interiors.test", brandedRegex: "thornbury",
    keyPages: ["/", "/portfolio/", "/kitchen-design/", "/consultation/"],
    uptimeKeyword: "Thornbury",
    topic: {
      services: ["interior designer", "kitchen design", "home renovation", "interior design consultation", "bathroom design", "living room ideas", "bespoke joinery", "colour consultation", "period home renovation", "boot room design"],
      places: ["dublin", "cork", "near me", "cost", "ideas"],
      brand: ["thornbury interiors", "thornbury design dublin"],
    },
    profile: { growth: 0.043, baseClicks: 44, lcp: 2650, inp: 190, cls: 0.11, outageRate: 0.004, certDays: 120, domainDays: 260 },
  },
];

/** The month the demo treats as "last month", given today's date in the spec. */
export const DEMO_PERIOD = "2026-10";
/** Fixed "now" so expiry countdowns are stable in screenshots. */
export const DEMO_NOW = new Date("2026-11-19T09:30:00Z");
