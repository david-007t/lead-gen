import { useState, useRef, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────
const INDUSTRIES = {
  construction: {
    label: "Construction", icon: "🏗", typeName: "Project Type", leadNoun: "project",
    searchTerms: "construction project opportunities, RFPs, building permits, development projects",
    types: [
      { id: "commercial", label: "Commercial", icon: "🏢" },
      { id: "residential", label: "Residential", icon: "🏠" },
      { id: "industrial", label: "Industrial", icon: "🏭" },
      { id: "renovation", label: "Renovation", icon: "🔨" },
      { id: "infrastructure", label: "Infrastructure", icon: "🌉" },
      { id: "mixed_use", label: "Mixed Use", icon: "🏗" },
      { id: "government", label: "Government", icon: "🏛" },
    ],
    defaultTypes: ["commercial", "residential", "industrial", "renovation", "infrastructure"],
    defaultBudget: [50000, 10000000],
    demoLeads: [
      { name: "Marcus Chen", company: "Pacific Ridge Developments", email: "mchen@pacificridge.com", phone: "(415) 555-0188", projectType: "commercial", budget: "2500000", location: "San Francisco", zipCode: "94102", timeline: "6-12", description: "New 8-story mixed commercial building downtown. Looking for full GC services.", source: "Website", followUp: "new" },
      { name: "Sarah Williams", company: "Homestead Living", email: "sarah@homesteadliving.com", phone: "(408) 555-0234", projectType: "residential", budget: "180000", location: "San Jose", zipCode: "95112", timeline: "3-6", description: "Custom home addition — 2 bedrooms + bathroom, second floor.", source: "Referral", followUp: "contacted" },
      { name: "David Park", company: "Park & Associates", email: "dpark@parkassoc.com", phone: "(510) 555-0091", projectType: "renovation", budget: "75000", location: "Oakland", zipCode: "94612", timeline: "0-3", description: "Office space renovation. 3,000 sq ft, needs new HVAC and electrical.", source: "Google Ads", followUp: "new" },
      { name: "Linda Torres", company: "Torres Family Trust", email: "linda.torres@gmail.com", phone: "(650) 555-0377", projectType: "residential", budget: "35000", location: "Palo Alto", zipCode: "94301", timeline: "0-3", description: "Kitchen remodel — countertops, cabinets, flooring.", source: "Yelp", followUp: "new" },
      { name: "James O'Brien", company: "Metro Industrial LLC", email: "jobrien@metroindustrial.com", phone: "(925) 555-0142", projectType: "industrial", budget: "5000000", location: "Concord", zipCode: "94520", timeline: "12-24", description: "120,000 sq ft warehouse build-out with cold storage.", source: "Trade Show", followUp: "meeting" },
      { name: "Priya Sharma", company: "Bay Area Schools District", email: "psharma@bayareasd.org", phone: "(408) 555-0456", projectType: "government", budget: "8000000", location: "Sunnyvale", zipCode: "94086", timeline: "12-24", description: "New elementary school campus — full design-build.", source: "RFP", followUp: "new" },
    ],
  },
  gov_contracting: {
    label: "Government Contracting", icon: "🏛", typeName: "Contract Type", leadNoun: "contract",
    searchTerms: "government RFPs, procurement solicitations, contract opportunities, bid announcements, SAM.gov opportunities",
    types: [
      { id: "federal", label: "Federal", icon: "🇺🇸" },
      { id: "state", label: "State", icon: "🏛" },
      { id: "local", label: "Local / Municipal", icon: "🏘" },
      { id: "defense", label: "Defense", icon: "🛡" },
      { id: "healthcare", label: "Healthcare", icon: "🏥" },
      { id: "education", label: "Education", icon: "🎓" },
      { id: "technology", label: "Technology / IT", icon: "💻" },
      { id: "facilities", label: "Facilities / Maintenance", icon: "🔧" },
    ],
    defaultTypes: ["federal", "state", "local", "technology"],
    defaultBudget: [25000, 50000000],
    demoLeads: [
      { name: "GSA Region 9", company: "General Services Administration", email: "", phone: "", projectType: "federal", budget: "2400000", location: "San Francisco", zipCode: "94102", timeline: "6-12", description: "IT modernization services for federal office buildings. Full stack development and cloud migration.", source: "SAM.gov", followUp: "new" },
      { name: "CA Dept of Transportation", company: "Caltrans", email: "procure@dot.ca.gov", phone: "", projectType: "state", budget: "8500000", location: "Sacramento", zipCode: "95814", timeline: "12-24", description: "Highway signage replacement program — 200+ signs across Northern California.", source: "CaleProcure", followUp: "new" },
      { name: "City of Oakland", company: "Public Works Dept", email: "", phone: "(510) 555-0300", projectType: "local", budget: "750000", location: "Oakland", zipCode: "94612", timeline: "3-6", description: "Park facility upgrades — ADA compliance improvements across 12 city parks.", source: "City Portal", followUp: "contacted" },
    ],
  },
  marketing: {
    label: "Marketing / Creative", icon: "📣", typeName: "Service Type", leadNoun: "engagement",
    searchTerms: "marketing RFPs, agency of record searches, creative services solicitations, branding projects, digital marketing opportunities",
    types: [
      { id: "branding", label: "Branding", icon: "🎨" },
      { id: "digital", label: "Digital Marketing", icon: "📱" },
      { id: "content", label: "Content / SEO", icon: "✍" },
      { id: "social", label: "Social Media", icon: "📢" },
      { id: "pr", label: "PR / Comms", icon: "📰" },
      { id: "web_design", label: "Web Design", icon: "🌐" },
      { id: "video", label: "Video / Production", icon: "🎬" },
      { id: "strategy", label: "Strategy / Consulting", icon: "📊" },
    ],
    defaultTypes: ["branding", "digital", "content", "web_design"],
    defaultBudget: [5000, 500000],
    demoLeads: [
      { name: "Jessica Torres", company: "Bloom Organics", email: "jess@bloomorganics.com", phone: "(512) 555-0188", projectType: "branding", budget: "45000", location: "Austin", zipCode: "78701", timeline: "3-6", description: "Full rebrand for organic skincare DTC brand. Logo, packaging, brand guidelines.", source: "RFP Database", followUp: "new" },
      { name: "Mike Chang", company: "NovaTech Solutions", email: "mchang@novatech.io", phone: "(415) 555-0291", projectType: "digital", budget: "120000", location: "San Francisco", zipCode: "94105", timeline: "6-12", description: "Agency of record search — lead gen, PPC, SEO for B2B SaaS.", source: "LinkedIn", followUp: "contacted" },
      { name: "City of Denver", company: "Tourism Board", email: "marketing@visitdenver.org", phone: "", projectType: "content", budget: "200000", location: "Denver", zipCode: "80202", timeline: "3-6", description: "Tourism campaign — content creation, social, and influencer strategy.", source: "Gov RFP", followUp: "new" },
    ],
  },
  it_consulting: {
    label: "IT / Software Consulting", icon: "💻", typeName: "Project Type", leadNoun: "project",
    searchTerms: "IT consulting RFPs, software development solicitations, technology services opportunities, digital transformation projects, cybersecurity contracts",
    types: [
      { id: "dev", label: "Software Dev", icon: "⌨" },
      { id: "cloud", label: "Cloud / Infra", icon: "☁" },
      { id: "cyber", label: "Cybersecurity", icon: "🔒" },
      { id: "data", label: "Data / Analytics", icon: "📊" },
      { id: "consulting", label: "IT Consulting", icon: "💡" },
      { id: "managed", label: "Managed Services", icon: "🖥" },
      { id: "ai_ml", label: "AI / ML", icon: "🤖" },
      { id: "integration", label: "Integration", icon: "🔗" },
    ],
    defaultTypes: ["dev", "cloud", "cyber", "data", "consulting"],
    defaultBudget: [25000, 5000000],
    demoLeads: [
      { name: "State of Oregon", company: "Dept of Admin Services", email: "", phone: "", projectType: "dev", budget: "1200000", location: "Salem", zipCode: "97301", timeline: "6-12", description: "Legacy system modernization — migrate mainframe applications to cloud-native architecture.", source: "State Procurement", followUp: "new" },
      { name: "Rachel Kim", company: "MedFirst Health System", email: "rkim@medfirst.org", phone: "(503) 555-0144", projectType: "cyber", budget: "350000", location: "Portland", zipCode: "97204", timeline: "3-6", description: "HIPAA compliance audit and security hardening for 40+ clinic network.", source: "Referral", followUp: "meeting" },
    ],
  },
  real_estate: {
    label: "Real Estate / Development", icon: "🏠", typeName: "Opportunity Type", leadNoun: "opportunity",
    searchTerms: "real estate development opportunities, commercial property listings, land sales, zoning changes, development proposals, investment properties",
    types: [
      { id: "commercial_re", label: "Commercial", icon: "🏢" },
      { id: "residential_re", label: "Residential", icon: "🏘" },
      { id: "land", label: "Land / Lots", icon: "🌄" },
      { id: "mixed_use_re", label: "Mixed Use", icon: "🏙" },
      { id: "multifamily", label: "Multifamily", icon: "🏬" },
      { id: "retail", label: "Retail", icon: "🛍" },
      { id: "industrial_re", label: "Industrial", icon: "🏭" },
    ],
    defaultTypes: ["commercial_re", "residential_re", "multifamily", "land"],
    defaultBudget: [100000, 50000000],
    demoLeads: [
      { name: "Greenfield Capital", company: "Greenfield Capital LLC", email: "deals@greenfieldcap.com", phone: "(303) 555-0210", projectType: "multifamily", budget: "12000000", location: "Denver", zipCode: "80205", timeline: "12-24", description: "48-unit apartment complex approved for construction. Seeking development partners.", source: "LoopNet", followUp: "new" },
      { name: "City of Boise Planning", company: "City of Boise", email: "", phone: "", projectType: "mixed_use_re", budget: "25000000", location: "Boise", zipCode: "83702", timeline: "24+", description: "Downtown redevelopment zone — 4 blocks rezoned for mixed-use. Developer proposals welcome.", source: "City Website", followUp: "new" },
    ],
  },
  landscaping: {
    label: "Landscaping / Trades", icon: "🌿", typeName: "Job Type", leadNoun: "job",
    searchTerms: "landscaping bids, grounds maintenance contracts, commercial landscaping RFPs, municipal landscaping solicitations, HOA landscaping opportunities",
    types: [
      { id: "commercial_ls", label: "Commercial", icon: "🏢" },
      { id: "residential_ls", label: "Residential", icon: "🏡" },
      { id: "municipal", label: "Municipal", icon: "🏛" },
      { id: "hoa", label: "HOA / Community", icon: "🏘" },
      { id: "maintenance", label: "Maintenance", icon: "🔄" },
      { id: "design_build", label: "Design / Build", icon: "📐" },
      { id: "irrigation", label: "Irrigation", icon: "💧" },
    ],
    defaultTypes: ["commercial_ls", "municipal", "hoa", "design_build"],
    defaultBudget: [5000, 500000],
    demoLeads: [
      { name: "Sunnydale HOA", company: "Sunnydale Community Mgmt", email: "board@sunnydalehoa.com", phone: "(480) 555-0133", projectType: "hoa", budget: "85000", location: "Scottsdale", zipCode: "85254", timeline: "0-3", description: "Annual grounds maintenance contract — 340 homes, common areas, pool landscaping.", source: "HOA Board Posting", followUp: "new" },
      { name: "City of Tempe", company: "Parks & Rec Dept", email: "", phone: "(480) 555-0400", projectType: "municipal", budget: "220000", location: "Tempe", zipCode: "85281", timeline: "3-6", description: "Streetscape beautification project — 2 miles of median planting and irrigation.", source: "City Procurement", followUp: "new" },
    ],
  },
  cleaning: {
    label: "Cleaning / Facilities", icon: "🧹", typeName: "Service Type", leadNoun: "contract",
    searchTerms: "commercial cleaning contracts, janitorial services RFPs, facilities maintenance bids, cleaning service solicitations",
    types: [
      { id: "office", label: "Office / Corporate", icon: "🏢" },
      { id: "medical", label: "Medical / Healthcare", icon: "🏥" },
      { id: "industrial_cl", label: "Industrial", icon: "🏭" },
      { id: "retail_cl", label: "Retail", icon: "🛍" },
      { id: "education_cl", label: "Schools / Education", icon: "🎓" },
      { id: "government_cl", label: "Government", icon: "🏛" },
      { id: "residential_cl", label: "Residential / Property Mgmt", icon: "🏘" },
    ],
    defaultTypes: ["office", "medical", "education_cl", "government_cl"],
    defaultBudget: [10000, 1000000],
    demoLeads: [
      { name: "HealthPoint Clinics", company: "HealthPoint Medical Group", email: "facilities@healthpoint.com", phone: "(206) 555-0187", projectType: "medical", budget: "180000", location: "Seattle", zipCode: "98101", timeline: "0-3", description: "Janitorial services for 8-clinic network. Must be ISSA CIMS certified.", source: "RFP Portal", followUp: "new" },
      { name: "Portland Public Schools", company: "PPS Facilities", email: "", phone: "", projectType: "education_cl", budget: "450000", location: "Portland", zipCode: "97204", timeline: "3-6", description: "Annual custodial contract for 12 elementary schools. Summer deep clean included.", source: "District Procurement", followUp: "new" },
    ],
  },
  events: {
    label: "Events / Catering", icon: "🎪", typeName: "Event Type", leadNoun: "event",
    searchTerms: "event planning RFPs, catering bid opportunities, venue management contracts, corporate event solicitations, conference planning opportunities",
    types: [
      { id: "corporate", label: "Corporate", icon: "💼" },
      { id: "wedding", label: "Weddings", icon: "💒" },
      { id: "conference", label: "Conferences", icon: "🎤" },
      { id: "nonprofit", label: "Nonprofit / Gala", icon: "🎗" },
      { id: "government_ev", label: "Government", icon: "🏛" },
      { id: "festival", label: "Festivals", icon: "🎪" },
      { id: "catering_only", label: "Catering Only", icon: "🍽" },
    ],
    defaultTypes: ["corporate", "conference", "nonprofit", "catering_only"],
    defaultBudget: [5000, 500000],
    demoLeads: [
      { name: "TechCrunch Events", company: "TechCrunch / Yahoo", email: "events@techcrunch.com", phone: "", projectType: "conference", budget: "350000", location: "San Francisco", zipCode: "94105", timeline: "6-12", description: "Seeking catering + event production for 2-day tech conference. 2,000 attendees.", source: "Event Planner Network", followUp: "new" },
      { name: "SF Arts Foundation", company: "SFAF", email: "gala@sfaf.org", phone: "(415) 555-0366", projectType: "nonprofit", budget: "95000", location: "San Francisco", zipCode: "94102", timeline: "3-6", description: "Annual fundraising gala — 400 guests, plated dinner, full bar, entertainment coordination.", source: "Nonprofit Directory", followUp: "contacted" },
    ],
  },
};

const INDUSTRY_LIST = Object.entries(INDUSTRIES).map(([id, ind]) => ({ id, ...ind }));

const TIMELINE_OPTIONS = [
  { value: "0-3", label: "0–3 mo", months: 3 },
  { value: "3-6", label: "3–6 mo", months: 6 },
  { value: "6-12", label: "6–12 mo", months: 12 },
  { value: "12-24", label: "12–24 mo", months: 24 },
  { value: "24+", label: "24+ mo", months: 36 },
];

const FOLLOWUP_STATUSES = [
  { id: "new", label: "New", color: "#a8a29e" },
  { id: "contacted", label: "Contacted", color: "#60a5fa" },
  { id: "meeting", label: "Meeting Set", color: "#a78bfa" },
  { id: "won", label: "Won", color: "#34d399" },
  { id: "lost", label: "Lost", color: "#f87171" },
];

const EMPTY_LEAD = {
  name: "", company: "", email: "", phone: "",
  projectType: "", budget: "", location: "", zipCode: "",
  timeline: "", description: "", source: "", followUp: "new",
};

const INDEED_ROLES = [
  { id: "appointment_setter", label: "Appointment Setter", icon: "📅" },
  { id: "receptionist", label: "Receptionist", icon: "📞" },
  { id: "virtual_assistant", label: "Virtual Assistant", icon: "💻" },
  { id: "inbound_call", label: "Inbound Call Specialist", icon: "☎" },
  { id: "secretary", label: "Secretary", icon: "📋" },
  { id: "office_manager", label: "Office Manager", icon: "🏢" },
  { id: "dispatcher", label: "Dispatcher", icon: "🚗" },
  { id: "customer_service", label: "Customer Service Rep", icon: "🎧" },
  { id: "admin_assistant", label: "Admin Assistant", icon: "📁" },
  { id: "scheduler", label: "Scheduler / Coordinator", icon: "🗓" },
];

function getDefaultCriteria(industryId) {
  const ind = INDUSTRIES[industryId] || INDUSTRIES.construction;
  return {
    minBudget: ind.defaultBudget[0],
    maxBudget: ind.defaultBudget[1],
    acceptedProjectTypes: [...ind.defaultTypes],
    serviceAreaZips: "",
    maxTimelineMonths: 24,
    minTimelineMonths: 0,
    requiredFields: ["name", "budget", "projectType"],
  };
}

// ─── QUALIFICATION ENGINE ─────────────────────────────────────
function qualifyLead(lead, criteria, typeName = "Category") {
  const results = { criteria: [], score: 0, total: 0, qualified: false };
  const budget = parseFloat(lead.budget);
  if (!isNaN(budget)) {
    const pass = budget >= criteria.minBudget && budget <= criteria.maxBudget;
    results.criteria.push({ name: "Budget Range", pass, detail: pass ? `$${budget.toLocaleString()} within range` : `$${budget.toLocaleString()} outside $${criteria.minBudget.toLocaleString()}–$${criteria.maxBudget.toLocaleString()}` });
    results.total++; if (pass) results.score++;
  } else if (lead.budget) {
    results.criteria.push({ name: "Budget Range", pass: false, detail: "Invalid budget value" }); results.total++;
  }
  if (lead.projectType) {
    const pass = criteria.acceptedProjectTypes.includes(lead.projectType.toLowerCase().replace(/\s+/g, "_"));
    results.criteria.push({ name: typeName, pass, detail: pass ? `${lead.projectType} accepted` : `${lead.projectType} not accepted` });
    results.total++; if (pass) results.score++;
  }
  if (criteria.serviceAreaZips && criteria.serviceAreaZips.trim()) {
    const allowed = criteria.serviceAreaZips.split(",").map(z => z.trim());
    const zip = (lead.zipCode || "").trim();
    if (zip) {
      const pass = allowed.some(z => zip.startsWith(z));
      results.criteria.push({ name: "Service Area", pass, detail: pass ? `ZIP ${zip} in service area` : `ZIP ${zip} outside service area` });
      results.total++; if (pass) results.score++;
    }
  }
  if (lead.timeline) {
    const m = { "0-3": 3, "3-6": 6, "6-12": 12, "12-24": 24, "24+": 36 }[lead.timeline] || 0;
    const pass = m >= criteria.minTimelineMonths && m <= criteria.maxTimelineMonths;
    results.criteria.push({ name: "Timeline", pass, detail: pass ? "Timeline within range" : "Timeline outside range" });
    results.total++; if (pass) results.score++;
  }
  const missing = criteria.requiredFields.filter(f => !lead[f] || lead[f].toString().trim() === "");
  if (criteria.requiredFields.length > 0) {
    const pass = missing.length === 0;
    results.criteria.push({ name: "Required Fields", pass, detail: pass ? "All required fields present" : `Missing: ${missing.join(", ")}` });
    results.total++; if (pass) results.score++;
  }
  results.qualified = results.total > 0 && results.score === results.total;
  return results;
}

function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[\s_]+/g, ""));
  const map = { name: "name", contactname: "name", leadname: "name", fullname: "name", company: "company", companyname: "company", email: "email", emailaddress: "email", phone: "phone", phonenumber: "phone", projecttype: "projectType", type: "projectType", budget: "budget", projectvalue: "budget", value: "budget", location: "location", city: "location", zipcode: "zipCode", zip: "zipCode", postalcode: "zipCode", timeline: "timeline", timeframe: "timeline", description: "description", notes: "description", source: "source", leadsource: "source" };
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
    const lead = { ...EMPTY_LEAD };
    headers.forEach((h, i) => { const m2 = map[h]; if (m2 && vals[i]) lead[m2] = vals[i]; });
    return lead;
  });
}

// ─── PROSPECT CLASSIFICATION ──────────────────────────────────
function classifyProspect(prospect) {
  const hasOwner = !!(prospect.ownerName && prospect.ownerName.trim());
  const hasDirectContact = !!(prospect.email && prospect.email.trim()) || !!(prospect.phone && prospect.phone.trim());
  const signalCount = (prospect.buyingSignals || []).length;

  if (hasOwner && hasDirectContact && signalCount >= 2) {
    return { tier: "WARM", emoji: "🟢", color: "#34d399" };
  } else if (hasDirectContact && signalCount >= 1) {
    return { tier: "COOL", emoji: "🟡", color: "#f59e0b" };
  } else {
    return { tier: "COLD", emoji: "🔴", color: "#f87171" };
  }
}

// ─── THEME DEFINITIONS ────────────────────────────────────────
const themes = {
  dark: {
    bg: "#0c0a09", bgAlt: "#151311", bgHover: "#1c1917",
    border: "#1c1917", borderLight: "#292524", borderInput: "#3a3631",
    text: "#fafaf9", textMuted: "#a8a29e", textDim: "#78716c", textFaint: "#57534e",
    accent: "#f59e0b", accentHover: "#d97706", accentBg: "#0c0a09",
    green: "#34d399", greenBg: "#0a2e1a", greenBorder: "#166534",
    red: "#f87171", redBg: "#2e0a0a", redBorder: "#7f1d1d",
    cardBg: "#151311",
  },
  light: {
    bg: "#faf9f7", bgAlt: "#ffffff", bgHover: "#f5f3f0",
    border: "#e7e5e4", borderLight: "#d6d3d1", borderInput: "#c4c0bc",
    text: "#1c1917", textMuted: "#57534e", textDim: "#78716c", textFaint: "#a8a29e",
    accent: "#d97706", accentHover: "#b45309", accentBg: "#fffbeb",
    green: "#16a34a", greenBg: "#f0fdf4", greenBorder: "#86efac",
    red: "#dc2626", redBg: "#fef2f2", redBorder: "#fca5a5",
    cardBg: "#ffffff",
  },
};

// ─── STORAGE HELPERS ──────────────────────────────────────────
const SK = { leads: "lq-leads-v2", criteria: "lq-criteria-v2", settings: "lq-settings-v2" };

async function loadData(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
async function saveData(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error("Storage save error:", e); }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function LeadQualifier() {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("construction");
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState(0);

  const [tab, setTab] = useState("dashboard");
  const [criteria, setCriteria] = useState(getDefaultCriteria("construction"));
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_LEAD });
  const [expandedLead, setExpandedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState(null);
  const [settingsEdited, setSettingsEdited] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [inlineEdit, setInlineEdit] = useState(null); // { id, field, value }

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFollowUp, setFilterFollowUp] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Prospect search state (replaces finder)
  const [prospectCity, setProspectCity] = useState("");
  const [prospectNiche, setProspectNiche] = useState("");
  const [prospectCount, setProspectCount] = useState(10);
  const [prospectFilters, setProspectFilters] = useState({
    hiringOnIndeed: true,
    badWebsite: true,
    lowReviews: true,
    noSocial: true,
    runningAds: true,
    recentlyStarted: true,
  });
  const [prospects, setProspects] = useState([]);
  const [prospectLoading, setProspectLoading] = useState(false);
  const [prospectError, setProspectError] = useState(null);
  const [expandedProspect, setExpandedProspect] = useState(null);
  const [draftingEmail, setDraftingEmail] = useState(null);
  const [emailDrafts, setEmailDrafts] = useState({});

  // Joe's Queue state
  const [queueActions, setQueueActions] = useState({});

  // Indeed Leads state
  const [indeedCity, setIndeedCity] = useState("");
  const [indeedSelectedRoles, setIndeedSelectedRoles] = useState(["appointment_setter", "receptionist", "inbound_call"]);
  const [indeedCustomRole, setIndeedCustomRole] = useState("");
  const [indeedCount, setIndeedCount] = useState(10);
  const [indeedResults, setIndeedResults] = useState([]);
  const [indeedLoading, setIndeedLoading] = useState(false);
  const [indeedError, setIndeedError] = useState(null);
  const [indeedEmailDrafts, setIndeedEmailDrafts] = useState({});
  const [draftingIndeedEmail, setDraftingIndeedEmail] = useState(null);
  const [indeedQueueActions, setIndeedQueueActions] = useState({});

  // Indeed — Outreach Options state
  const [indeedOutreachOpen, setIndeedOutreachOpen] = useState({}); // { [id]: boolean }
  const [indeedApplyPitch, setIndeedApplyPitch] = useState({});     // { [id]: string }
  const [generatingApplyPitch, setGeneratingApplyPitch] = useState(null);
  const [indeedContactInfo, setIndeedContactInfo] = useState({});   // { [id]: { name, email, phone, website } | 'not_found' }
  const [searchingContact, setSearchingContact] = useState(null);
  const [indeedContactDraft, setIndeedContactDraft] = useState({}); // { [id]: string }
  const [generatingContactDraft, setGeneratingContactDraft] = useState(null);
  const [indeedLinkedInMsg, setIndeedLinkedInMsg] = useState({});   // { [id]: { connectionNote, followUpDm } }
  const [generatingLinkedInMsg, setGeneratingLinkedInMsg] = useState(null);

  // Ship List state
  const [shipListResults, setShipListResults] = useState([]);
  const [shipListLoading, setShipListLoading] = useState(false);
  const [shipListError, setShipListError] = useState(null);
  const [shipListCount, setShipListCount] = useState(15);
  const [shipListCompanyType, setShipListCompanyType] = useState("all");
  const [shipListCity, setShipListCity] = useState("San Francisco");
  const [shipListProgress, setShipListProgress] = useState(null);

  const fileRef = useRef();
  const t = themes[theme];
  const ind = INDUSTRIES[industry] || INDUSTRIES.construction;
  const PROJECT_TYPES = ind.types;

  // ─── LOAD PERSISTED DATA ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const [savedLeads, savedCriteria, savedSettings] = await Promise.all([
        loadData(SK.leads), loadData(SK.criteria), loadData(SK.settings),
      ]);
      if (savedLeads) setLeads(savedLeads);
      if (savedCriteria) setCriteria(savedCriteria);
      if (savedSettings) {
        if (savedSettings.companyName) setCompanyName(savedSettings.companyName);
        if (savedSettings.theme) setTheme(savedSettings.theme);
        if (savedSettings.industry) {
          setIndustry(savedSettings.industry);
        }
        if (savedSettings.setupComplete) { setSetupComplete(true); setTab("dashboard"); }
      }
      setLoading(false);
    })();
  }, []);

  // ─── PERSIST ON CHANGE ────────────────────────────────────
  useEffect(() => { if (!loading) saveData(SK.leads, leads); }, [leads, loading]);
  useEffect(() => { if (!loading) saveData(SK.criteria, criteria); }, [criteria, loading]);
  useEffect(() => { if (!loading) saveData(SK.settings, { companyName, theme, industry, setupComplete }); }, [companyName, theme, industry, setupComplete, loading]);

  // ─── KEYBOARD SHORTCUTS ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (inlineEdit) { setInlineEdit(null); return; }
        if (confirmAction) { setConfirmAction(null); return; }
        if (editingLead) { setEditingLead(null); setEditForm(null); return; }
        if (expandedLead) { setExpandedLead(null); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmAction, editingLead, expandedLead, inlineEdit]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── LEAD OPERATIONS ─────────────────────────────────────
  const handleAddLead = () => {
    if (!form.name.trim()) { showToast("Lead name is required", "error"); return; }
    const result = qualifyLead(form, criteria, ind.typeName);
    const newLead = { ...form, id: Date.now() + Math.random(), createdAt: Date.now(), result };
    setLeads(prev => [newLead, ...prev]);
    setForm({ ...EMPTY_LEAD });
    showToast(`Lead "${form.name}" added & qualified`);
  };

  const handleDeleteLead = (id) => {
    setConfirmAction({
      title: "Delete Lead",
      message: "Are you sure? This can't be undone.",
      onConfirm: () => {
        setLeads(prev => prev.filter(l => l.id !== id));
        if (expandedLead === id) setExpandedLead(null);
        if (editingLead === id) { setEditingLead(null); setEditForm(null); }
        showToast("Lead deleted");
        setConfirmAction(null);
      },
    });
  };

  const handleSaveEdit = (id) => {
    if (!editForm) return;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...editForm, result: qualifyLead(editForm, criteria, ind.typeName) } : l));
    setEditingLead(null); setEditForm(null);
    showToast("Lead updated");
  };

  const handleFollowUpChange = (id, status) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, followUp: status } : l));
  };

  const handleInlineSave = () => {
    if (!inlineEdit) return;
    const { id, field, value } = inlineEdit;
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      return { ...updated, result: qualifyLead(updated, criteria, ind.typeName) };
    }));
    setInlineEdit(null);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length === 0) { showToast("No valid leads found in CSV", "error"); return; }
      const qualified = parsed.map(l => ({ ...l, id: Date.now() + Math.random(), createdAt: Date.now(), result: qualifyLead(l, criteria, ind.typeName) }));
      setLeads(prev => [...qualified, ...prev]);
      showToast(`${parsed.length} leads imported & qualified`);
      setShowUpload(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const loadDemoData = () => {
    const DEMO_LEADS = ind.demoLeads || [];
    if (DEMO_LEADS.length === 0) { showToast("No demo data for this industry", "error"); return; }
    const demoLeads = DEMO_LEADS.map((l, i) => ({
      ...l, id: Date.now() + i + Math.random(), createdAt: Date.now() - i * 86400000,
      result: qualifyLead(l, criteria, ind.typeName),
    }));
    setLeads(prev => [...demoLeads, ...prev]);
    showToast(`${DEMO_LEADS.length} demo leads loaded`);
  };

  const requalifyAll = () => {
    setLeads(prev => prev.map(l => ({ ...l, result: qualifyLead(l, criteria, ind.typeName) })));
    showToast("All leads re-qualified with new criteria");
    setSettingsEdited(false);
  };

  // ─── PROSPECT SEARCH (Multi-pass deep search) ────────────
  const handleProspectSearch = async () => {
    if (!prospectCity.trim()) { showToast("Enter a city or region", "error"); return; }
    if (!prospectNiche.trim()) { showToast("Enter a business niche", "error"); return; }
    setProspectLoading(true);
    setProspectError(null);
    setProspects([]);

    const filterList = [];
    if (prospectFilters.hiringOnIndeed) filterList.push("Hiring on Indeed (growth signal)");
    if (prospectFilters.badWebsite) filterList.push("No website or bad website");
    if (prospectFilters.lowReviews) filterList.push("Low/few Google reviews (<20 reviews or <4.0 stars)");
    if (prospectFilters.noSocial) filterList.push("No social media presence");
    if (prospectFilters.runningAds) filterList.push("Running ads (Google/Facebook)");
    if (prospectFilters.recentlyStarted) filterList.push("Recently started business");

    const prompt = `You are helping Ascend Solutions (a digital agency offering AI automation, web development, and advertising services) find ${prospectNiche} businesses in ${prospectCity.trim()} that need their services.

MULTI-STEP SEARCH PROCESS:

Step 1: Search for "${prospectNiche} companies in ${prospectCity.trim()}" — find ${prospectCount} real businesses with names, addresses, phone numbers, websites.

Step 2: For each business found, search for:
- Their Indeed job postings (hiring = growth signal)
- Google reviews (rating and count)
- Facebook/Instagram presence
- Website quality (modern vs outdated, has online booking/lead capture?)
- Any signs they're running ads

Step 3: Identify buying signals based on these filters: ${filterList.join(", ")}

RESPOND WITH A JSON ARRAY ONLY. No markdown, no explanation. Each object must have:

{
  "businessName": "Summit HVAC Services",
  "ownerName": "Mike Rivera",
  "phone": "(512) 555-0188",
  "email": "mike@summithvac.com",
  "website": "summithvac.com",
  "websiteQuality": "outdated, no online booking",
  "address": "1234 Main St, Austin TX 78701",
  "googleReviews": { "rating": 4.2, "count": 47 },
  "socialMedia": { "facebook": "active", "instagram": "none", "linkedin": "none" },
  "indeedHiring": ["HVAC Technician", "Office Manager"],
  "estimatedRevenue": "$500K-1M",
  "yearEstablished": "2019",
  "niche": "${prospectNiche}",
  "buyingSignals": [
    "Hiring 2 positions on Indeed — scaling fast",
    "Website has no online booking or lead capture",
    "No Instagram presence"
  ],
  "opportunities": [
    "Needs lead capture automation",
    "Website rebuild opportunity",
    "Could benefit from review management"
  ],
  "sourceUrls": ["https://indeed.com/...", "https://yelp.com/..."]
}

Return ${prospectCount} businesses. Use real data from your search. If you can't find a field, use empty string or empty array.`;

    try {
      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: "You are a business research assistant for a digital agency. Search the web thoroughly for real businesses. Respond with ONLY a raw JSON array. No markdown, no explanation — just [ ... ]. This is critical.",
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await response.json();
      if (data.error) { setFinderError(data.error.message || "API error. Please try again."); setFinderLoading(false); return; }
      
      // Extract all text from response blocks (web search responses have many block types)
      const textParts = [];
      (data.content || []).forEach(block => {
        if (block.type === "text" && block.text) textParts.push(block.text);
      });
      const fullText = textParts.join("\n");
      
      // Try multiple strategies to extract JSON array
      let parsed = null;
      
      // Strategy 1: Find JSON array in code fences
      const fenceMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (fenceMatch) {
        try { parsed = JSON.parse(fenceMatch[1]); } catch {}
      }
      
      // Strategy 2: Find the last JSON array in the text (most likely to be the final answer)
      if (!parsed) {
        const allArrays = [...fullText.matchAll(/\[[\s\S]*?\](?=\s*$|\s*```|\s*\n\n)/g)];
        for (let i = allArrays.length - 1; i >= 0; i--) {
          try { const candidate = JSON.parse(allArrays[i][0]); if (Array.isArray(candidate) && candidate.length > 0 && candidate[0].name !== undefined) { parsed = candidate; break; } } catch {}
        }
      }
      
      // Strategy 3: Greedy — find anything that looks like a JSON array with objects
      if (!parsed) {
        const greedyMatch = fullText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (greedyMatch) {
          try { parsed = JSON.parse(greedyMatch[0]); } catch {
            // Try fixing common issues: trailing commas, etc
            try { parsed = JSON.parse(greedyMatch[0].replace(/,\s*(?=[}\]])/g, '')); } catch {}
          }
        }
      }
      
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        setProspectError("No businesses found. Try a larger city or different niche.");
        setProspectLoading(false);
        return;
      }

      const results = parsed.map((r, i) => ({
        id: Date.now() + i + Math.random(),
        businessName: r.businessName || "Unknown Business",
        ownerName: r.ownerName || "",
        phone: r.phone || "",
        email: r.email || "",
        website: r.website || "",
        websiteQuality: r.websiteQuality || "",
        address: r.address || "",
        googleReviews: r.googleReviews || { rating: 0, count: 0 },
        socialMedia: r.socialMedia || { facebook: "none", instagram: "none", linkedin: "none" },
        indeedHiring: r.indeedHiring || [],
        estimatedRevenue: r.estimatedRevenue || "",
        yearEstablished: r.yearEstablished || "",
        niche: r.niche || prospectNiche,
        buyingSignals: r.buyingSignals || [],
        opportunities: r.opportunities || [],
        sourceUrls: r.sourceUrls || [],
        classification: null,
      }));

      // Auto-classify each prospect
      results.forEach(p => { p.classification = classifyProspect(p); });

      setProspects(results);
      showToast(`Found ${results.length} prospects`);
    } catch (err) {
      console.error("Prospect search error:", err);
      setProspectError("Search failed — please try again.");
    }
    setProspectLoading(false);
  };

  // ─── EMAIL DRAFT GENERATION ──────────────────────────────
  const handleDraftEmail = async (prospect) => {
    setDraftingEmail(prospect.id);
    try {
      const signals = prospect.buyingSignals.slice(0, 2).join(", ");
      const opportunity = prospect.opportunities[0] || "improve their digital presence";

      const prompt = `Write a short, personalized cold email to ${prospect.businessName}${prospect.ownerName ? ` (owner: ${prospect.ownerName})` : ""}, a ${prospect.niche} business in ${prospect.address.split(",").slice(-2).join(",").trim()}.

Context:
- Buying signals: ${signals || "growing business"}
- Opportunity: ${opportunity}
- You represent Ascend Solutions, a digital agency offering AI automation, web development, and advertising services.

Framework:
- Hook: Reference something specific about their business
- Pain point: Connect it to a problem they likely have
- Offer: One simple thing you can help with (not a full pitch)
- CTA: Low-friction ask (quick call or reply)

Keep it 4-5 sentences max. No fluff. Sound like a real person, not a salesperson.`;

      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      if (data.error) {
        showToast("Failed to generate email", "error");
        setDraftingEmail(null);
        return;
      }

      const emailText = (data.content || []).find(b => b.type === "text")?.text || "";
      setEmailDrafts(prev => ({ ...prev, [prospect.id]: emailText }));
      showToast("Email draft generated");
    } catch (err) {
      console.error("Email draft error:", err);
      showToast("Failed to generate email", "error");
    }
    setDraftingEmail(null);
  };

  // ─── SHIP LIST SEARCH ────────────────────────────────────
  const handleShipListSearch = async () => {
    setShipListLoading(true);
    setShipListError(null);
    setShipListResults([]);
    setShipListProgress(null);

    const cityFilter = shipListCity.trim() || "San Francisco, San Jose, Oakland, Palo Alto";
    const typeFilter = shipListCompanyType === "saas"
      ? "SaaS companies (Series B or later, or well-funded startups)"
      : shipListCompanyType === "professional_services"
      ? "established professional services firms (law, finance, consulting, recruiting)"
      : "SaaS companies (Series B+) and established professional services firms";

    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(shipListCount / BATCH_SIZE);
    const allResults = [];

    const parseShipListResponse = (fullText) => {
      let parsed = null;
      const fenceMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (fenceMatch) { try { parsed = JSON.parse(fenceMatch[1]); } catch {} }
      if (!parsed) {
        const allArrays = [...fullText.matchAll(/\[[\s\S]*?\](?=\s*$|\s*```|\s*\n\n)/g)];
        for (let i = allArrays.length - 1; i >= 0; i--) {
          try { const c = JSON.parse(allArrays[i][0]); if (Array.isArray(c) && c.length > 0 && c[0].companyName) { parsed = c; break; } } catch {}
        }
      }
      if (!parsed) {
        const greedyMatch = fullText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (greedyMatch) {
          try { parsed = JSON.parse(greedyMatch[0]); } catch {
            try { parsed = JSON.parse(greedyMatch[0].replace(/,\s*(?=[}\]])/g, '')); } catch {}
          }
        }
      }
      return parsed;
    };

    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        setShipListProgress({ current: batchIndex + 1, total: totalBatches });

        const excludeList = allResults.map(r => r.companyName);
        const excludeClause = excludeList.length > 0
          ? `\nEXCLUSION LIST (do NOT return these companies — already found): ${excludeList.join(", ")}\n`
          : "";

        const prompt = `You are a content agency researcher building a "Ship List" — a list of Bay Area companies that have a CONTENT GAP (underutilized or missing social video presence).

TARGET CRITERIA:
- Geography: ${cityFilter}
- Company size: 100+ employees
- Financial profile: ${typeFilter}
- Content gap definition: NO YouTube channel, OR Instagram/TikTok with less than 1 post per month
${excludeClause}
SEARCH PROCESS:
Step 1: Search for well-funded / established companies in ${cityFilter} matching the profile above.
Step 2: For each company found, search for their YouTube channel, Instagram, and TikTok presence. Look at posting frequency.
Step 3: Keep ONLY companies with a content gap (missing YouTube, or Instagram/TikTok < 1 post/month).
Step 4: Return exactly 5 qualifying companies that are NOT in the exclusion list above.

RESPOND WITH A JSON ARRAY ONLY. No markdown, no explanation. Each object:
{
  "companyName": "Acme Corp",
  "website": "https://acmecorp.com",
  "city": "San Francisco",
  "employeeCount": "250-500",
  "fundingStage": "Series C",
  "estimatedRevenue": "$20M-50M ARR",
  "companyType": "SaaS",
  "youtube": "",
  "instagram": "https://instagram.com/acmecorp",
  "instagramPostsPerMonth": 0.5,
  "tiktok": "",
  "tiktokPostsPerMonth": 0,
  "linkedIn": "https://linkedin.com/company/acmecorp",
  "contentGap": ["No YouTube channel", "Instagram: 0.5 posts/month (below threshold)"]
}

Return 5 companies. Only include companies WITH a content gap.`;

        const response = await fetch("/api/anthropic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4000,
            system: "You are a business research assistant. Search the web for real companies. Respond with ONLY a raw JSON array. No markdown, no explanation — just [ ... ].",
            messages: [{ role: "user", content: prompt }],
            tools: [{ type: "web_search_20250305", name: "web_search" }],
          }),
        });
        const data = await response.json();
        if (data.error) { setShipListError(data.error.message || "API error."); setShipListLoading(false); setShipListProgress(null); return; }

        const textParts = [];
        (data.content || []).forEach(block => { if (block.type === "text" && block.text) textParts.push(block.text); });
        const fullText = textParts.join("\n");

        const parsed = parseShipListResponse(fullText);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          const batchResults = parsed.map((r, i) => ({
            id: Date.now() + batchIndex * 100 + i + Math.random(),
            companyName: r.companyName || "Unknown Company",
            website: r.website || "",
            city: r.city || "",
            employeeCount: r.employeeCount || "",
            fundingStage: r.fundingStage || "",
            estimatedRevenue: r.estimatedRevenue || "",
            companyType: r.companyType || "",
            youtube: r.youtube || "",
            instagram: r.instagram || "",
            instagramPostsPerMonth: r.instagramPostsPerMonth ?? 0,
            tiktok: r.tiktok || "",
            tiktokPostsPerMonth: r.tiktokPostsPerMonth ?? 0,
            linkedIn: r.linkedIn || "",
            contentGap: r.contentGap || [],
          }));
          allResults.push(...batchResults);
          setShipListResults(prev => [...prev, ...batchResults]);
        }
      }

      if (allResults.length === 0) {
        setShipListError("No qualifying companies found. Try adjusting your filters.");
      } else {
        showToast(`Found ${allResults.length} companies for the Ship List`);
      }
    } catch (err) {
      console.error("Ship List search error:", err);
      setShipListError("Search failed — please try again.");
    }
    setShipListLoading(false);
    setShipListProgress(null);
  };

  // ─── INDEED LEAD SEARCH ──────────────────────────────────
  const handleIndeedSearch = async () => {
    // Problem 1 fixed: city is optional — no validation block
    const rolesToSearch = [
      ...indeedSelectedRoles.map(id => INDEED_ROLES.find(r => r.id === id)?.label).filter(Boolean),
      ...(indeedCustomRole.trim() ? [indeedCustomRole.trim()] : []),
    ];
    if (rolesToSearch.length === 0) { showToast("Select at least one role to search for", "error"); return; }

    setIndeedLoading(true);
    setIndeedError(null);
    setIndeedResults([]);

    // Problem 3 fixed: batch roles into groups of 3 to avoid overwhelming the AI
    const batches = [];
    for (let i = 0; i < rolesToSearch.length; i += 3) {
      batches.push(rolesToSearch.slice(i, i + 3));
    }

    const allRaw = [];

    for (const batch of batches) {
      // 3 query variations per role for broader coverage
      const searchQueries = batch.flatMap(role => [
        indeedCity.trim()
          ? `"${role}" remote job hiring ${indeedCity.trim()}`
          : `"${role}" remote job hiring 2025 OR 2026`,
        `"${role}" remote hiring site:indeed.com OR site:linkedin.com/jobs OR site:ziprecruiter.com`,
        `"${role}" remote position open site:glassdoor.com OR site:careerbuilder.com`,
      ]);

      const countForBatch = Math.max(3, Math.ceil(indeedCount / batches.length));

      const prompt = `Search for companies currently hiring for these remote roles: ${batch.join(", ")}.

Use simple search queries like: '[role]' remote job hiring

For each search result that is an actual job listing, extract:
- jobTitle: the exact job title from the search result
- company: the exact company name from the search result
- pay: salary or hourly rate if shown in the snippet
- location: Remote or location listed
- source: which site the listing is on (Indeed, LinkedIn, ZipRecruiter, Glassdoor, etc)
- postingUrl: the EXACT URL from the search result. Copy it character for character. Do NOT modify it.
- description: brief description from the search snippet
- postedDate: when it was posted if visible

RULES:
1. The postingUrl MUST be the actual URL returned by the search. Do not construct URLs.
2. The company name MUST appear in the search result snippet or title. If you can't confirm the company name, skip it.
3. Only include listings that appear to be from the last 30 days.
4. If a search result is a job board search results page (not a specific listing), skip it.
5. Return ONLY a JSON array. No other text.

Return fewer results if needed. Quality over quantity.`;

      try {
        console.log("=== SEARCH START ===");
        console.log("Selected roles:", rolesToSearch);
        console.log("City:", indeedCity);
        console.log("Batch:", batch);
        console.log("Request body:", JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 12000,
          system: "(see source)",
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }, null, 2));

        const response = await fetch("/api/anthropic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 12000,
            system: "You are a job listing researcher. You use web search to find real job postings. ABSOLUTE RULE: You may ONLY include a listing in your results if the URL came directly from a search result you received. You must NEVER construct, guess, or modify a URL. If a search result gives you a URL, use that exact URL. If the company name in the search result snippet does not match the company name in the URL destination, do NOT include it. Accuracy is everything — returning 2 real listings is better than 10 fake ones.",
            messages: [{ role: "user", content: prompt }],
            tools: [{ type: "web_search_20250305", name: "web_search" }],
          }),
        });

        console.log("=== API RESPONSE ===");
        console.log("HTTP Status:", response.status);
        const data = await response.json();
        console.log("Response has content:", !!data.content);
        console.log("Content blocks:", data.content?.length);
        data.content?.forEach((block, i) => {
          console.log(`Block ${i}: type=${block.type}, length=${block.type === "text" ? block.text?.length : "n/a"}`);
          if (block.type === "text") {
            console.log(`Block ${i} text preview:`, block.text?.substring(0, 300));
          }
        });
        if (data.error) {
          console.log("API ERROR:", JSON.stringify(data.error));
          console.error("API error for batch:", batch, data.error);
          continue;
        }

        const textParts = [];
        (data.content || []).forEach(block => { if (block.type === "text" && block.text) textParts.push(block.text); });
        const fullText = textParts.join("\n");

        console.log("=== PARSING ===");
        console.log("Full text to parse (first 500 chars):", fullText?.substring(0, 500));
        console.log("Full text length:", fullText?.length);

        let parsed = null;
        let jsonMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[1]); } catch {} }
        if (!parsed) {
          jsonMatch = fullText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch {
              try { parsed = JSON.parse(jsonMatch[0].replace(/,\s*(?=[}\]])/g, "")); } catch {}
            }
          }
        }

        console.log("=== PARSE RESULT ===");
        console.log("Parsed successfully:", !!parsed);
        console.log("Is array:", Array.isArray(parsed));
        console.log("Result count:", parsed?.length);
        if (parsed?.length > 0) {
          console.log("First result:", JSON.stringify(parsed[0], null, 2));
        }

        if (parsed && Array.isArray(parsed)) {
          // Filter out any listings where the URL doesn't contain some form of the company name
          // or doesn't look like a real job listing URL
          const validated = parsed.filter(listing => {
            if (!listing.postingUrl || listing.postingUrl.trim() === '') return false;

            // Must be a real URL
            try { new URL(listing.postingUrl); } catch { return false; }

            // Must be from a known job board or company site
            const validDomains = ['indeed.com', 'linkedin.com', 'ziprecruiter.com', 'glassdoor.com', 'careerbuilder.com', 'monster.com', 'simplyhired.com'];
            const url = listing.postingUrl.toLowerCase();
            const isJobBoard = validDomains.some(d => url.includes(d));
            const isCompanySite = listing.company && url.includes(listing.company.toLowerCase().split(' ')[0]);

            if (!isJobBoard && !isCompanySite) return false;

            return true;
          });

          console.log("=== FILTERING (URL validation) ===");
          console.log("Before filter:", parsed.length);
          console.log("After filter:", validated.length);
          console.log("Filtered out:", parsed.length - validated.length, "listings (no valid postingUrl or not from known job board)");
          parsed.forEach((listing, i) => {
            const kept = validated.includes(listing);
            if (!kept) {
              const hasUrl = !!(listing.postingUrl && listing.postingUrl.trim());
              let validUrl = false;
              if (hasUrl) { try { new URL(listing.postingUrl); validUrl = true; } catch {} }
              const validDomains = ['indeed.com', 'linkedin.com', 'ziprecruiter.com', 'glassdoor.com', 'careerbuilder.com', 'monster.com', 'simplyhired.com'];
              const url = (listing.postingUrl || "").toLowerCase();
              const isJobBoard = validDomains.some(d => url.includes(d));
              const isCompanySite = listing.company && url.includes(listing.company.toLowerCase().split(' ')[0]);
              console.log(`  Dropped [${i}] "${listing.company}" — hasUrl:${hasUrl}, validUrl:${validUrl}, isJobBoard:${isJobBoard}, isCompanySite:${isCompanySite}, url:"${listing.postingUrl}"`);
            }
          });

          // Map new prompt field names to the field names the rest of the code expects
          const normalized = validated.map(l => ({
            companyName: l.company || l.companyName || "",
            jobTitle: l.jobTitle || "",
            jobPayRate: l.pay || l.jobPayRate || "",
            location: l.location || "",
            jobUrl: l.postingUrl || l.jobUrl || "",
            postingDate: l.postedDate || l.postingDate || "",
            industry: l.source || l.industry || "",
            website: l.website || "",
            phone: l.phone || "",
            email: l.email || "",
            companySize: l.companySize || "",
            googleReviews: l.googleReviews || { rating: 0, count: 0 },
            automationAngle: l.automationAngle || l.description || "",
            automationUseCase: l.automationUseCase || "",
            pitchHook: l.pitchHook || "",
            urgency: l.urgency || "medium",
            buyingSignals: l.buyingSignals || [],
            opportunities: l.opportunities || [],
            annualCost: l.annualCost || "",
          }));

          allRaw.push(...normalized);
        }
      } catch (err) {
        console.error("Search error for batch:", batch, err);
      }
    }

    if (allRaw.length === 0) {
      setIndeedError("No results returned. Check the browser console for details, or try selecting fewer roles.");
      setIndeedLoading(false);
      return;
    }

    // Deduplicate within allRaw by company+jobTitle
    const seenKeys = new Set();
    const dedupedRaw = allRaw.filter(r => {
      const key = `${(r.companyName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")}|${(r.jobTitle || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // Fix 1: Filter out listings with no confirmed job URL
    const withLinks = dedupedRaw.filter(r => r.jobUrl && r.jobUrl.trim() !== "");
    console.log("=== FILTERING (jobUrl gate) ===");
    console.log("Before filter:", dedupedRaw.length);
    console.log("After filter:", withLinks.length);
    console.log("Filtered out:", dedupedRaw.length - withLinks.length, "listings with empty jobUrl");
    dedupedRaw.forEach((r, i) => {
      if (!r.jobUrl || r.jobUrl.trim() === "") {
        console.log(`  Dropped [${i}] "${r.companyName}" — jobUrl is empty`);
      }
    });

    // Fix 4: Build pipeline lead map — normalizedCompany → array of followUp statuses
    const normalizeName = (s) => (s || "").toLowerCase().trim().replace(/[™®©]/g, "").replace(/[^a-z0-9]/g, "");
    const pipelineLeadMap = {};
    leads.forEach(l => {
      const norm = normalizeName(l.company);
      if (!pipelineLeadMap[norm]) pipelineLeadMap[norm] = [];
      pipelineLeadMap[norm].push(l.followUp || "new");
    });

    const results = withLinks.map((r, i) => {
      const normCompany = normalizeName(r.companyName);
      const statuses = pipelineLeadMap[normCompany] || [];
      const isActedOn = statuses.some(s => s === "contacted" || s === "replied");
      const isInPipeline = statuses.length > 0;
      return {
        id: Date.now() + i + Math.random(),
        companyName: r.companyName || "Unknown Company",
        industry: r.industry || "",
        location: r.location || (indeedCity.trim() || "Remote"),
        website: r.website || "",
        phone: r.phone || "",
        email: r.email || "",
        jobTitle: r.jobTitle || "",
        jobPayRate: r.jobPayRate || "",
        annualCost: r.annualCost || "",
        postingDate: r.postingDate || "",
        jobUrl: r.jobUrl || "",
        companySize: r.companySize || "",
        googleReviews: r.googleReviews || { rating: 0, count: 0 },
        automationAngle: r.automationAngle || "",
        automationUseCase: r.automationUseCase || "",
        pitchHook: r.pitchHook || "",
        urgency: r.urgency || "medium",
        buyingSignals: r.buyingSignals || [],
        opportunities: r.opportunities || [],
        // Only hide if already acted on (contacted/replied); new pipeline leads still show
        skipRender: isActedOn,
        pipelineTag: isInPipeline && !isActedOn ? "✓ Already in Pipeline" : null,
      };
    }).filter(r => !r.skipRender);

    setIndeedResults(results);
    showToast(`Found ${results.length} companies hiring`);
    setIndeedLoading(false);
  };

  // ─── ADD INDEED LISTING TO PIPELINE ───────────────────────
  const handleAddIndeedToPipeline = (r) => {
    const newLead = {
      id: Date.now() + Math.random(),
      createdAt: Date.now(),
      name: r.companyName,
      company: r.companyName,
      email: r.email || "",
      phone: r.phone || "",
      projectType: "inbound_call",
      budget: "",
      location: r.location || "Remote",
      zipCode: "",
      timeline: "",
      source: "LeadGen",
      description: `${r.jobTitle}${r.jobPayRate ? ` — ${r.jobPayRate}` : ""}. ${r.automationAngle || ""}`.trim().replace(/\.$/, ""),
      followUp: "new",
      result: { qualified: true, score: 1, total: 1, criteria: [] },
    };
    setLeads(prev => [newLead, ...prev]);
    showToast(`Added ${r.companyName} to Pipeline`);
  };

  // ─── INDEED EMAIL DRAFT ───────────────────────────────────
  const handleIndeedDraftEmail = async (result) => {
    setDraftingIndeedEmail(result.id);
    try {
      const prompt = `Write a short, punchy cold outreach message to ${result.companyName}, a ${result.industry} business in ${result.location} that posted for a ${result.jobTitle} on Indeed at ${result.jobPayRate}.

You represent Ascend Solutions, an AI automation agency.

The angle: They're about to spend ${result.annualCost}/year on a human for ${result.jobTitle} work. You have AI automation that handles this 24/7 for a fraction of the cost.

Pitch hook: "${result.pitchHook}"
Automation use case: ${result.automationUseCase}

Framework:
- Open by referencing their specific job posting (shows you did research)
- Flip it: position automation as the smarter alternative to hiring
- One concrete advantage (24/7, instant response, scales, no salary/benefits)
- CTA: Low-friction — "worth a quick 10-min call?" or "want to see a demo?"

Under 5 sentences. Sound like a real person, not a sales pitch. No fluff.`;

      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      if (data.error) { showToast("Failed to generate outreach", "error"); setDraftingIndeedEmail(null); return; }
      const emailText = (data.content || []).find(b => b.type === "text")?.text || "";
      setIndeedEmailDrafts(prev => ({ ...prev, [result.id]: emailText }));
      showToast("Outreach draft ready");
    } catch (err) {
      console.error("Indeed email draft error:", err);
      showToast("Failed to generate outreach", "error");
    }
    setDraftingIndeedEmail(null);
  };

  // ─── OUTREACH OPTION 1: APPLY DIRECT PITCH ────────────────
  const handleIndeedGenerateApplyPitch = async (r) => {
    setGeneratingApplyPitch(r.id);
    try {
      const prompt = `Write a 3-4 sentence pitch message formatted for pasting into a job application "Why are you a good fit?" or cover note field.

Job listing: ${r.jobTitle} at ${r.companyName}
Pay: ${r.jobPayRate}
Description: ${r.automationUseCase || r.pitchHook}

Frame it as: you're not applying as a person — you're pitching an AI system that does this job better. Reference the specific role and pay rate. Show the math on annual cost vs AI. End with a call to action to reply.

Keep it under 4 sentences. Direct, confident, no fluff.`;

      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: "You are writing cold pitches for an AI automation agency. The goal is to hijack a job application form to pitch AI services instead of a resume. Be direct, reference the pay rate, show the math. Under 4 sentences.",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).find(b => b.type === "text")?.text || "";
      setIndeedApplyPitch(prev => ({ ...prev, [r.id]: text }));
      showToast("Pitch ready");
    } catch (err) {
      console.error("Apply pitch error:", err);
      showToast("Failed to generate pitch", "error");
    }
    setGeneratingApplyPitch(null);
  };

  // ─── OUTREACH OPTION 2: FIND CONTACT INFO ─────────────────
  const handleIndeedFindContact = async (r) => {
    setSearchingContact(r.id);
    try {
      const prompt = `Find the contact information for the decision maker at ${r.companyName}.

Job listing context:
- Company: ${r.companyName}
- Industry: ${r.industry}
- Location: ${r.location}
- Job they posted: ${r.jobTitle}
- Their website (if known): ${r.website || "unknown"}

IMPORTANT: Verify this is the correct company by cross-referencing industry and location with what you find. If there are multiple companies with similar names, pick the one that matches ${r.industry} in ${r.location}.

Search for:
1. The owner, founder, or hiring manager's name
2. Their direct email address
3. Phone number
4. Company website

Respond with ONLY a JSON object:
{
  "name": "John Smith",
  "title": "Owner",
  "email": "john@company.com",
  "phone": "(555) 123-4567",
  "website": "company.com",
  "confidence": "high",
  "notes": "Verified via LinkedIn and company website"
}

If you genuinely cannot find contact info after searching, respond with:
{ "notFound": true }`;

      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are a contact research assistant. Search the web to find real contact info for business decision makers. Cross-reference industry and location to confirm you have the right company. Respond with ONLY a JSON object.",
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });
      const data = await response.json();
      const textParts = [];
      (data.content || []).forEach(b => { if (b.type === "text" && b.text) textParts.push(b.text); });
      const fullText = textParts.join("\n");

      let parsed = null;
      const fenceMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (fenceMatch) { try { parsed = JSON.parse(fenceMatch[1]); } catch {} }
      if (!parsed) {
        const objMatch = fullText.match(/\{[\s\S]*\}/);
        if (objMatch) { try { parsed = JSON.parse(objMatch[0]); } catch {} }
      }

      if (parsed?.notFound) {
        setIndeedContactInfo(prev => ({ ...prev, [r.id]: "not_found" }));
        showToast("No contact info found");
      } else if (parsed) {
        setIndeedContactInfo(prev => ({ ...prev, [r.id]: parsed }));
        showToast("Contact found!");
      } else {
        setIndeedContactInfo(prev => ({ ...prev, [r.id]: "not_found" }));
        showToast("Could not parse contact info", "error");
      }
    } catch (err) {
      console.error("Find contact error:", err);
      setIndeedContactInfo(prev => ({ ...prev, [r.id]: "not_found" }));
      showToast("Search failed", "error");
    }
    setSearchingContact(null);
  };

  // ─── OUTREACH OPTION 2b: EMAIL TO FOUND CONTACT ───────────
  const handleIndeedGenerateContactEmail = async (r) => {
    const contact = indeedContactInfo[r.id];
    if (!contact || contact === "not_found") return;
    setGeneratingContactDraft(r.id);
    try {
      const prompt = `Write a cold outreach email to ${contact.name || "the hiring manager"} (${contact.title || "owner"}) at ${r.companyName}.

They posted a job for: ${r.jobTitle} at ${r.jobPayRate}
My pitch: AI automation can do this job 24/7 for a fraction of what they'd pay a human.

Personalize this to ${contact.name || "them"} specifically. Reference the job posting and pay rate. Show the math. Under 5 sentences. No fluff.`;

      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system: "You are writing cold outreach emails for an AI automation agency. The recipient posted a job listing for a role AI can replace. Reference their name, company, job title, and pay rate. Show the annual cost math. Be direct, not salesy. The math sells itself.",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).find(b => b.type === "text")?.text || "";
      setIndeedContactDraft(prev => ({ ...prev, [r.id]: text }));
      showToast("Email draft ready");
    } catch (err) {
      console.error("Contact email error:", err);
      showToast("Failed to generate email", "error");
    }
    setGeneratingContactDraft(null);
  };

  // ─── OUTREACH OPTION 3: LINKEDIN MESSAGES ─────────────────
  const handleIndeedGenerateLinkedInMsg = async (r) => {
    setGeneratingLinkedInMsg(r.id);
    try {
      const prompt = `Generate two LinkedIn messages for outreach to ${r.companyName} who posted for a ${r.jobTitle} at ${r.jobPayRate}.

Message 1 — Connection request note (STRICT 300 character max, LinkedIn's limit):
Reference their job posting briefly. Hook them to accept.

Message 2 — Follow-up DM (after they accept, short and conversational, 3-4 sentences):
Reference the job posting, show the AI cost comparison, end with a soft CTA.

Respond with ONLY a JSON object:
{
  "connectionNote": "...",
  "followUpDm": "..."
}`;

      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: "You are writing LinkedIn outreach messages for an AI automation agency targeting companies that posted job listings for roles AI can replace. Respond with ONLY a JSON object with connectionNote and followUpDm fields.",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const textParts = [];
      (data.content || []).forEach(b => { if (b.type === "text" && b.text) textParts.push(b.text); });
      const fullText = textParts.join("\n");

      let parsed = null;
      const fenceMatch = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (fenceMatch) { try { parsed = JSON.parse(fenceMatch[1]); } catch {} }
      if (!parsed) {
        const objMatch = fullText.match(/\{[\s\S]*\}/);
        if (objMatch) { try { parsed = JSON.parse(objMatch[0]); } catch {} }
      }
      if (parsed?.connectionNote) {
        setIndeedLinkedInMsg(prev => ({ ...prev, [r.id]: parsed }));
        showToast("LinkedIn messages ready");
      } else {
        showToast("Failed to generate messages", "error");
      }
    } catch (err) {
      console.error("LinkedIn msg error:", err);
      showToast("Failed to generate messages", "error");
    }
    setGeneratingLinkedInMsg(null);
  };

  const handleClearAll = () => {
    setConfirmAction({
      title: "Clear All Leads",
      message: `Delete all ${leads.length} leads? This can't be undone.`,
      onConfirm: () => { setLeads([]); setExpandedLead(null); setEditingLead(null); setConfirmAction(null); showToast("All leads cleared"); },
    });
  };

  const handleResetApp = () => {
    setConfirmAction({
      title: "Reset Everything",
      message: "This will delete all leads, criteria, and settings. Start fresh?",
      onConfirm: async () => {
        setLeads([]); setCriteria(getDefaultCriteria("construction")); setCompanyName(""); setIndustry("construction"); setProspects([]); setEmailDrafts({}); setQueueActions({}); setIndeedResults([]); setIndeedEmailDrafts({}); setIndeedQueueActions({}); setSetupComplete(false); setSetupStep(0); setTab("dashboard");
        try { localStorage.removeItem(SK.leads); localStorage.removeItem(SK.criteria); localStorage.removeItem(SK.settings); } catch {}
        setConfirmAction(null); showToast("App reset complete");
      },
    });
  };

  // ─── FILTERED & SORTED LEADS ─────────────────────────────
  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.name || "").toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) || (l.projectType || "").toLowerCase().includes(q) ||
        (l.location || "").toLowerCase().includes(q) || (l.zipCode || "").includes(q)
      );
    }
    if (filterStatus === "qualified") result = result.filter(l => l.result.qualified);
    if (filterStatus === "unqualified") result = result.filter(l => !l.result.qualified);
    if (filterFollowUp !== "all") result = result.filter(l => l.followUp === filterFollowUp);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = (a.createdAt || 0) - (b.createdAt || 0);
      else if (sortBy === "name") cmp = (a.name || "").localeCompare(b.name || "");
      else if (sortBy === "budget") cmp = (parseFloat(a.budget) || 0) - (parseFloat(b.budget) || 0);
      else if (sortBy === "score") cmp = (a.result.score / (a.result.total || 1)) - (b.result.score / (b.result.total || 1));
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [leads, searchQuery, filterStatus, filterFollowUp, sortBy, sortDir]);

  // ─── ANALYTICS DATA ──────────────────────────────────────
  const analytics = useMemo(() => {
    if (leads.length === 0) return null;
    const qualified = leads.filter(l => l.result.qualified).length;
    const unqualified = leads.length - qualified;
    const qualRate = Math.round((qualified / leads.length) * 100);
    const byType = {}; leads.forEach(l => { const tp = l.projectType || "unknown"; byType[tp] = (byType[tp] || 0) + 1; });
    const typeData = Object.entries(byType).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })).sort((a, b) => b.value - a.value);
    const bySource = {}; leads.forEach(l => { const s = l.source || "Unknown"; bySource[s] = (bySource[s] || 0) + 1; });
    const sourceData = Object.entries(bySource).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const budgets = leads.map(l => parseFloat(l.budget)).filter(b => !isNaN(b));
    const totalPipeline = budgets.reduce((a, b) => a + b, 0);
    const qualifiedPipeline = leads.filter(l => l.result.qualified).map(l => parseFloat(l.budget)).filter(b => !isNaN(b)).reduce((a, b) => a + b, 0);
    const avgDeal = budgets.length > 0 ? totalPipeline / budgets.length : 0;
    const budgetBrackets = [
      { label: "<$50K", min: 0, max: 50000 },
      { label: "$50K–250K", min: 50000, max: 250000 },
      { label: "$250K–1M", min: 250000, max: 1000000 },
      { label: "$1M–5M", min: 1000000, max: 5000000 },
      { label: "$5M+", min: 5000000, max: Infinity },
    ];
    const budgetDistribution = budgetBrackets.map(b => ({
      name: b.label,
      count: budgets.filter(v => v >= b.min && v < b.max).length,
    })).filter(b => b.count > 0);
    const disqualReasons = {};
    leads.forEach(l => { l.result.criteria.filter(c => !c.pass).forEach(c => { disqualReasons[c.name] = (disqualReasons[c.name] || 0) + 1; }); });
    const topDisqualReasons = Object.entries(disqualReasons).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const byFollowUp = {}; leads.forEach(l => { const f = l.followUp || "new"; byFollowUp[f] = (byFollowUp[f] || 0) + 1; });
    return { qualified, unqualified, qualRate, typeData, sourceData, totalPipeline, qualifiedPipeline, avgDeal, budgetDistribution, topDisqualReasons, byFollowUp };
  }, [leads]);

  // ─── STYLES ───────────────────────────────────────────────
  const inputStyle = { width: "100%", padding: "10px 14px", background: t.bgAlt, border: `1px solid ${t.borderInput}`, borderRadius: 6, color: t.text, fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.textDim, marginBottom: 6 };
  const cardStyle = { background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 };
  const btnPrimary = { padding: "10px 24px", background: t.accent, border: "none", borderRadius: 8, color: "#0c0a09", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" };
  const btnSecondary = { padding: "8px 16px", background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 6, color: t.text, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" };
  const CHART_COLORS = ["#f59e0b", "#60a5fa", "#34d399", "#a78bfa", "#f87171", "#fb923c", "#2dd4bf"];

  const InlineCell = ({ lead, field, children, type = "text", options, style: cellStyle = {} }) => {
    const isEditing = inlineEdit?.id === lead.id && inlineEdit?.field === field;
    if (isEditing) {
      if (options) {
        return (
          <select className="inline-input" value={inlineEdit.value || ""} autoFocus
            onChange={e => setInlineEdit(p => ({ ...p, value: e.target.value }))}
            onBlur={handleInlineSave}
            onKeyDown={e => { if (e.key === "Enter") handleInlineSave(); if (e.key === "Escape") { e.stopPropagation(); setInlineEdit(null); } }}
            onClick={e => e.stopPropagation()}
          >
            <option value="">Select…</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      return (
        <input className="inline-input" type={type} value={inlineEdit.value || ""} autoFocus
          onChange={e => setInlineEdit(p => ({ ...p, value: e.target.value }))}
          onBlur={handleInlineSave}
          onKeyDown={e => { if (e.key === "Enter") handleInlineSave(); if (e.key === "Escape") { e.stopPropagation(); setInlineEdit(null); } }}
          onClick={e => e.stopPropagation()}
          style={cellStyle}
        />
      );
    }
    return (
      <span className="editable-cell" onClick={e => { e.stopPropagation(); setInlineEdit({ id: lead.id, field, value: lead[field] || "" }); }} title="Click to edit" style={cellStyle}>
        {children}
      </span>
    );
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0c0a09", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#f59e0b", fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, animation: "pulse 1.2s infinite" }}>Loading…</div>
    </div>
  );

  // ─── SETUP WIZARD ─────────────────────────────────────────
  if (!setupComplete) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Outfit:wght@400;600;700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
          input:focus, select:focus { border-color: #f59e0b !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
        `}</style>
        <div style={{ minHeight: "100vh", background: "#0c0a09", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
          <div style={{ maxWidth: 620, width: "100%", animation: "fadeIn 0.5s ease" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 40, justifyContent: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 60, height: 4, borderRadius: 2, background: i <= setupStep ? "#f59e0b" : "#292524", transition: "background 0.3s" }} />
              ))}
            </div>

            {setupStep === 0 && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
                <div style={{ width: 64, height: 64, background: "#f59e0b", borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#0c0a09", fontFamily: "'Outfit', sans-serif", marginBottom: 24 }}>LQ</div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fafaf9", fontFamily: "'Outfit', sans-serif", marginBottom: 12 }}>Lead Qualifier</h1>
                <p style={{ color: "#a8a29e", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>Automatically find, score, and qualify leads in seconds. Let's set up your profile.</p>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ ...labelStyle, color: "#78716c", textAlign: "left" }}>Your Company Name</label>
                  <input style={{ ...inputStyle, background: "#1c1917", borderColor: "#3a3631", textAlign: "center", fontSize: 18, padding: "14px 20px" }} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" autoFocus />
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label style={{ ...labelStyle, color: "#78716c", textAlign: "left" }}>Your Industry</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 4 }}>
                    {INDUSTRY_LIST.map(i => (
                      <button key={i.id} onClick={() => { setIndustry(i.id); setCriteria(getDefaultCriteria(i.id)); }}
                        style={{ padding: "14px 12px", background: industry === i.id ? "#f59e0b" : "#1c1917", border: `2px solid ${industry === i.id ? "#f59e0b" : "#292524"}`, borderRadius: 12, color: industry === i.id ? "#0c0a09" : "#a8a29e", cursor: "pointer", fontSize: 13, fontWeight: industry === i.id ? 700 : 500, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", textAlign: "center", lineHeight: 1.3 }}>
                        <span style={{ fontSize: 22, display: "block", marginBottom: 6 }}>{i.icon}</span>
                        {i.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setSetupStep(1)} style={{ ...btnPrimary, padding: "14px 40px", fontSize: 16, width: "100%" }}>Continue →</button>
              </div>
            )}

            {setupStep === 1 && (
              <div style={{ animation: "fadeIn 0.4s ease" }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fafaf9", fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>Set Your Criteria</h2>
                <p style={{ color: "#a8a29e", fontSize: 14, marginBottom: 28 }}>Leads that match all criteria will be marked as qualified. You can always change these later.</p>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#fafaf9" }}>💰 Budget Range</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div><label style={labelStyle}>Minimum ($)</label><input style={inputStyle} type="number" value={criteria.minBudget} onChange={e => setCriteria(p => ({ ...p, minBudget: parseInt(e.target.value) || 0 }))} /></div>
                    <div><label style={labelStyle}>Maximum ($)</label><input style={inputStyle} type="number" value={criteria.maxBudget} onChange={e => setCriteria(p => ({ ...p, maxBudget: parseInt(e.target.value) || 0 }))} /></div>
                  </div>
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#fafaf9" }}>{ind.icon} Accepted {ind.typeName}s</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {PROJECT_TYPES.map(pt => {
                      const active = criteria.acceptedProjectTypes.includes(pt.id);
                      return (<button key={pt.id} onClick={() => setCriteria(p => ({ ...p, acceptedProjectTypes: active ? p.acceptedProjectTypes.filter(x => x !== pt.id) : [...p.acceptedProjectTypes, pt.id] }))} style={{ padding: "8px 16px", background: active ? "#f59e0b" : "#1c1917", border: `1px solid ${active ? "#f59e0b" : "#3a3631"}`, borderRadius: 20, color: active ? "#0c0a09" : "#a8a29e", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>{pt.icon} {pt.label}</button>);
                    })}
                  </div>
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#fafaf9" }}>📍 Service Area (Optional)</h3>
                  <p style={{ fontSize: 12, color: "#57534e", marginBottom: 12 }}>ZIP code prefixes, comma-separated. Leave empty to skip.</p>
                  <input style={inputStyle} value={criteria.serviceAreaZips} onChange={e => setCriteria(p => ({ ...p, serviceAreaZips: e.target.value }))} placeholder="e.g. 941, 940, 950" />
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#fafaf9" }}>⏱ Timeline Range</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div><label style={labelStyle}>Min Months</label><input style={inputStyle} type="number" value={criteria.minTimelineMonths} onChange={e => setCriteria(p => ({ ...p, minTimelineMonths: parseInt(e.target.value) || 0 }))} /></div>
                    <div><label style={labelStyle}>Max Months</label><input style={inputStyle} type="number" value={criteria.maxTimelineMonths} onChange={e => setCriteria(p => ({ ...p, maxTimelineMonths: parseInt(e.target.value) || 0 }))} /></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setSetupStep(0)} style={{ ...btnSecondary, flex: 1, background: "#1c1917" }}>← Back</button>
                  <button onClick={() => setSetupStep(2)} style={{ ...btnPrimary, flex: 2 }}>Continue →</button>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fafaf9", fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>You're All Set!</h2>
                <p style={{ color: "#a8a29e", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>{companyName ? `${companyName} is` : "Your qualifier is"} ready to go. Want to load some sample leads to see how it works?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button onClick={() => { setSetupComplete(true); setTab("prospects"); }} style={{ ...btnPrimary, width: "100%", padding: "14px 40px", fontSize: 15 }}>⚡ Find Prospects →</button>
                  <button onClick={() => { setSetupComplete(true); setTab("dashboard"); loadDemoData(); }} style={{ ...btnSecondary, width: "100%", padding: "12px 40px", background: "#1c1917" }}>Load Demo Leads & Explore</button>
                  <button onClick={() => { setSetupComplete(true); setTab("add"); }} style={{ ...btnSecondary, width: "100%", padding: "12px 40px", background: "#1c1917" }}>Start Empty — I'll Add My Own</button>
                  <button onClick={() => setSetupStep(1)} style={{ background: "transparent", border: "none", color: "#78716c", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", padding: 8 }}>← Back to Criteria</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── MAIN APP ─────────────────────────────────────────────
  const qualifiedCount = leads.filter(l => l.result.qualified).length;
  const unqualifiedCount = leads.length - qualifiedCount;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus, textarea:focus { border-color: ${t.accent} !important; box-shadow: 0 0 0 2px ${t.accent}22; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${t.bg}; }
        ::-webkit-scrollbar-thumb { background: ${t.borderLight}; border-radius: 3px; }
        @keyframes slideUp { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        .lead-row:hover { background: ${t.bgHover} !important; }
        .sort-btn { background: transparent; border: none; color: ${t.textDim}; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; transition: all 0.15s; }
        .sort-btn:hover, .sort-btn.active { color: ${t.accent}; background: ${t.accent}11; }
        .inline-input { width: 100%; padding: 4px 8px; background: ${t.bg}; border: 1.5px solid ${t.accent}; border-radius: 4px; color: ${t.text}; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; box-sizing: border-box; }
        .editable-cell { cursor: text; padding: 2px 4px; border-radius: 4px; transition: background 0.15s; min-height: 20px; }
        .editable-cell:hover { background: ${t.accent}11; }
        @media (max-width: 900px) {
          .lead-grid-header { display: none !important; }
          .lead-row { grid-template-columns: 1fr !important; gap: 6px !important; padding: 14px 16px !important; position: relative; }
          .lead-row > div:nth-child(2)::before,
          .lead-row > div:nth-child(3)::before,
          .lead-row > div:nth-child(4)::before,
          .lead-row > div:nth-child(5)::before {
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${t.textFaint}; margin-right: 8px; display: inline;
          }
          .lead-row > div:nth-child(2)::before { content: 'Type: '; }
          .lead-row > div:nth-child(3)::before { content: 'Budget: '; }
          .lead-row > div:nth-child(4)::before { content: 'Timeline: '; }
          .lead-row > div:nth-child(5)::before { content: 'ZIP: '; }
          .lead-row > div:nth-child(6) { margin-top: 4px; }
          .lead-row > span:last-child { justify-self: start; margin-top: 4px; }
          .mobile-hide { display: none !important; }
          .stat-row { flex-direction: column !important; gap: 16px !important; }
          .stat-row > div:not(:first-child) > div:first-child { display: none !important; }
          .chart-grid { grid-template-columns: 1fr !important; }
          .toolbar-row { flex-direction: column !important; align-items: stretch !important; }
          .toolbar-row > * { width: 100% !important; }
          .toolbar-row > div { display: flex !important; flex-wrap: wrap !important; }
          .header-stats { display: none !important; }
        }
        @media (max-width: 600px) {
          .app-header { padding: 16px !important; }
          .app-content { padding: 16px !important; }
          .tab-bar { padding: 0 12px !important; }
          .tab-bar button { padding: 10px 14px !important; font-size: 12px !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif" }}>
        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, padding: "12px 20px", borderRadius: 8, background: toast.type === "error" ? t.redBg : t.greenBg, color: t.text, fontSize: 14, fontWeight: 600, animation: "slideUp 0.3s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", border: `1px solid ${toast.type === "error" ? t.redBorder : t.greenBorder}` }}>
            {toast.msg}
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmAction && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.2s ease" }} onClick={() => setConfirmAction(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28, maxWidth: 400, width: "100%", animation: "slideUp 0.3s ease" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{confirmAction.title}</h3>
              <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{confirmAction.message}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmAction(null)} style={btnSecondary}>Cancel</button>
                <button onClick={confirmAction.onConfirm} style={{ ...btnPrimary, background: t.red, padding: "10px 20px" }}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${t.border}`, background: theme === "dark" ? "linear-gradient(180deg, #151311 0%, #0c0a09 100%)" : "linear-gradient(180deg, #fff 0%, #faf9f7 100%)" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 32px" }} className="app-header">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, background: t.accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 17, color: "#0c0a09" }}>LQ</div>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, fontFamily: "'Outfit', sans-serif" }}>{companyName || "Lead Qualifier"}</h1>
                  <p style={{ fontSize: 11, color: t.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>{ind.label} · {leads.length} leads · {qualifiedCount} qualified</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {leads.length > 0 && (
                  <div style={{ display: "flex", gap: 16, marginRight: 8 }} className="header-stats">
                    {[
                      { val: qualifiedCount, label: "Pass", color: t.green },
                      { val: unqualifiedCount, label: "Fail", color: t.red },
                      { val: `${leads.length > 0 ? Math.round((qualifiedCount / leads.length) * 100) : 0}%`, label: "Rate", color: t.text },
                    ].map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: i < 2 ? 0 : 0 }}>
                        {i > 0 && <div style={{ width: 1, height: 36, background: t.borderLight, marginRight: 16 }} />}
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                          <div style={{ color: t.textFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme"
                  style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.borderLight}`, background: t.bgHover, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: t.text, transition: "all 0.2s" }}>
                  {theme === "dark" ? "☀" : "🌙"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: `1px solid ${t.border}` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", display: "flex", gap: 2, overflowX: "auto" }} className="tab-bar">
            {[{ id: "indeed", label: "LeadGen" }, { id: "shiplist", label: "Ship List", count: shipListResults.length || undefined }, { id: "leads", label: "Pipeline", count: leads.length }, { id: "queue", label: "Outreach" }, { id: "dashboard", label: "Dashboard" }].map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding: "12px 20px", background: tab === tb.id ? t.accent : "transparent", color: tab === tb.id ? "#0c0a09" : t.textMuted, border: "none", borderBottom: tab === tb.id ? `3px solid ${t.accent}` : "3px solid transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: tab === tb.id ? 700 : 500, letterSpacing: "0.02em", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                {tb.label}
                {tb.count !== undefined && <span style={{ background: tab === tb.id ? "#00000033" : t.bgHover, color: tab === tb.id ? "#0c0a09" : t.textDim, padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{tb.count}</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }} className="app-content">

          {/* ════════════ SHIP LIST ════════════ */}
          {tab === "shiplist" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>📋 Ship List</h2>
                <p style={{ color: t.textDim, fontSize: 14 }}>Find Bay Area companies (100+ employees, Series B+ SaaS or professional services) with content gaps — no YouTube, or Instagram/TikTok under 1 post/month.</p>
              </div>

              {/* Controls */}
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16, alignItems: "flex-end" }}>
                  <div>
                    <label style={labelStyle}>City / Region</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListCity} onChange={e => setShipListCity(e.target.value)}>
                      <option value="San Francisco">San Francisco</option>
                      <option value="San Jose">San Jose</option>
                      <option value="Oakland">Oakland</option>
                      <option value="Palo Alto">Palo Alto</option>
                      <option value="Bay Area">All Bay Area</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Company Type</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListCompanyType} onChange={e => setShipListCompanyType(e.target.value)}>
                      <option value="all">All (SaaS + Prof. Services)</option>
                      <option value="saas">SaaS Only (Series B+)</option>
                      <option value="professional_services">Professional Services Only</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Results</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListCount} onChange={e => setShipListCount(Number(e.target.value))}>
                      {[10, 15, 20, 25].map(n => <option key={n} value={n}>{n} companies</option>)}
                    </select>
                  </div>
                  <button onClick={handleShipListSearch} disabled={shipListLoading} style={{ ...btnPrimary, whiteSpace: "nowrap", opacity: shipListLoading ? 0.7 : 1 }}>
                    {shipListLoading ? (shipListProgress ? `⏳ Batch ${shipListProgress.current}/${shipListProgress.total}...` : "⏳ Searching...") : "⚡ Build Ship List"}
                  </button>
                </div>
              </div>

              {shipListError && (
                <div style={{ background: "#7f1d1d33", border: "1px solid #b91c1c44", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 13, marginBottom: 20 }}>
                  {shipListError}
                </div>
              )}

              {shipListResults.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: t.textMuted, flex: 1 }}>{shipListResults.length} companies with content gaps</span>
                    <button onClick={() => {
                      const headers = ["Company Name", "Website", "City", "Employee Count", "Funding Stage", "Est. Revenue", "Company Type", "YouTube", "Instagram", "Instagram Posts/Mo", "TikTok", "TikTok Posts/Mo", "LinkedIn", "Content Gaps"];
                      const rows = shipListResults.map(r => [
                        r.companyName, r.website, r.city, r.employeeCount, r.fundingStage, r.estimatedRevenue, r.companyType,
                        r.youtube || "none", r.instagram || "none", r.instagramPostsPerMonth, r.tiktok || "none", r.tiktokPostsPerMonth,
                        r.linkedIn || "none", r.contentGap.join("; ")
                      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
                      const csv = [headers.join(","), ...rows].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = "ship_list.csv"; a.click();
                    }} style={btnSecondary}>↓ Export CSV</button>
                    <button onClick={() => {
                      const json = JSON.stringify(shipListResults.map(({ id, ...rest }) => rest), null, 2);
                      const blob = new Blob([json], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = "ship_list.json"; a.click();
                    }} style={btnSecondary}>↓ Export JSON</button>
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    {shipListResults.map(r => (
                      <div key={r.id} style={{ ...cardStyle, marginBottom: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{r.companyName}</span>
                              {r.companyType && (
                                <span style={{ background: r.companyType === "SaaS" ? "#1d4ed844" : "#065f4644", color: r.companyType === "SaaS" ? "#93c5fd" : "#6ee7b7", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em" }}>{r.companyType}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 2 }}>
                              {r.city && <span>{r.city} · </span>}
                              {r.employeeCount && <span>{r.employeeCount} employees · </span>}
                              {r.fundingStage && <span style={{ color: t.accent }}>{r.fundingStage}</span>}
                            </div>
                            {r.estimatedRevenue && <div style={{ fontSize: 12, color: t.textFaint }}>{r.estimatedRevenue}</div>}
                            {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.accent, textDecoration: "none", display: "block", marginTop: 4 }}>{r.website}</a>}
                            {r.linkedIn && <a href={r.linkedIn} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none", display: "block", marginTop: 4 }}>🔗 LinkedIn</a>}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                            <div style={{ background: r.youtube ? "#15532e44" : "#7f1d1d33", border: `1px solid ${r.youtube ? "#16a34a44" : "#b91c1c44"}`, borderRadius: 8, padding: "6px 10px", minWidth: 80, textAlign: "center" }}>
                              <div style={{ fontSize: 16 }}>▶</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: r.youtube ? "#86efac" : "#fca5a5", marginTop: 2 }}>{r.youtube ? "Has YouTube" : "No YouTube"}</div>
                              {r.youtube && <a href={r.youtube} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: t.textFaint, textDecoration: "none" }}>view →</a>}
                            </div>
                            <div style={{ background: r.instagramPostsPerMonth >= 1 ? "#15532e44" : "#7f1d1d33", border: `1px solid ${r.instagramPostsPerMonth >= 1 ? "#16a34a44" : "#b91c1c44"}`, borderRadius: 8, padding: "6px 10px", minWidth: 80, textAlign: "center" }}>
                              <div style={{ fontSize: 16 }}>📸</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: r.instagramPostsPerMonth >= 1 ? "#86efac" : "#fca5a5", marginTop: 2 }}>
                                {r.instagram ? `${r.instagramPostsPerMonth}/mo` : "No IG"}
                              </div>
                              {r.instagram && <a href={r.instagram} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: t.textFaint, textDecoration: "none" }}>view →</a>}
                            </div>
                            <div style={{ background: r.tiktokPostsPerMonth >= 1 ? "#15532e44" : "#7f1d1d33", border: `1px solid ${r.tiktokPostsPerMonth >= 1 ? "#16a34a44" : "#b91c1c44"}`, borderRadius: 8, padding: "6px 10px", minWidth: 80, textAlign: "center" }}>
                              <div style={{ fontSize: 16 }}>🎵</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: r.tiktokPostsPerMonth >= 1 ? "#86efac" : "#fca5a5", marginTop: 2 }}>
                                {r.tiktok ? `${r.tiktokPostsPerMonth}/mo` : "No TikTok"}
                              </div>
                              {r.tiktok && <a href={r.tiktok} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: t.textFaint, textDecoration: "none" }}>view →</a>}
                            </div>
                          </div>
                        </div>

                        {r.contentGap && r.contentGap.length > 0 && (
                          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {r.contentGap.map((gap, gi) => (
                              <span key={gi} style={{ background: "#7f1d1d22", border: "1px solid #b91c1c33", color: "#fca5a5", fontSize: 11, padding: "3px 8px", borderRadius: 6 }}>⚠ {gap}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!shipListLoading && !shipListError && shipListResults.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: t.textFaint }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: t.textMuted }}>No Ship List yet</div>
                  <div style={{ fontSize: 13 }}>Configure your filters above and click "Build Ship List" to find content-cold companies.</div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ DASHBOARD ════════════ */}
          {tab === "dashboard" && (() => {
            // Compute dashboard data inline
            const outreachSentIds = new Set([
              ...Object.keys(indeedEmailDrafts),
              ...Object.keys(indeedApplyPitch),
              ...Object.keys(indeedContactDraft),
              ...Object.keys(indeedLinkedInMsg),
            ]);
            const outreachSentCount = outreachSentIds.size;

            const inferSource = (jobUrl) => {
              const u = jobUrl || "";
              if (u.includes("indeed.com")) return "Indeed";
              if (u.includes("linkedin.com")) return "LinkedIn";
              if (u.includes("ziprecruiter")) return "ZipRecruiter";
              if (u.includes("glassdoor")) return "Glassdoor";
              if (u.includes("careerbuilder")) return "CareerBuilder";
              return "Other";
            };
            const sourceCounts = {};
            indeedResults.forEach(r => {
              const s = inferSource(r.jobUrl);
              sourceCounts[s] = (sourceCounts[s] || 0) + 1;
            });
            const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

            const roleCounts = {};
            indeedResults.forEach(r => {
              const jt = r.jobTitle || "Other";
              const matchedRole = INDEED_ROLES.find(ir => jt.toLowerCase().includes(ir.label.toLowerCase().split(" ")[0]));
              const role = matchedRole ? matchedRole.label : jt.split(" ").slice(0, 3).join(" ");
              roleCounts[role] = (roleCounts[role] || 0) + 1;
            });
            const roleData = Object.entries(roleCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

            const recentLeads = [...indeedResults].reverse().slice(0, 5);
            const hasData = indeedResults.length > 0 || leads.length > 0;

            return (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>📊 Dashboard</h2>
                  <p style={{ color: t.textDim, fontSize: 14 }}>Lead generation overview — run a search in LeadGen to populate this.</p>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                  {[
                    { val: indeedResults.length, label: "Leads Found", sub: "this session", color: t.accent },
                    { val: leads.length, label: "In Pipeline", sub: "saved leads", color: t.green },
                    { val: outreachSentCount, label: "Outreach Drafted", sub: "emails / pitches / DMs", color: "#a78bfa" },
                    { val: "0%", label: "Response Rate", sub: "coming soon", color: t.textDim },
                  ].map((s, i) => (
                    <div key={i} style={{ ...cardStyle, marginBottom: 0, textAlign: "center", padding: "20px 16px" }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {!hasData ? (
                  <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🎯</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>No data yet</h3>
                    <p style={{ color: t.textFaint, fontSize: 14, marginBottom: 20 }}>Run a search in LeadGen to see your analytics here</p>
                    <button onClick={() => setTab("indeed")} style={btnPrimary}>Go to LeadGen →</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
                    {/* Leads by source */}
                    {sourceData.length > 0 && (
                      <div style={cardStyle}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Leads by Source</h3>
                        <ResponsiveContainer width="100%" height={Math.max(140, sourceData.length * 36)}>
                          <BarChart data={sourceData} layout="vertical" margin={{ left: 0, right: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: t.textMuted }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }} cursor={{ fill: t.bgHover }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                              {sourceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Leads by role */}
                    {roleData.length > 0 && (
                      <div style={cardStyle}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Leads by Role</h3>
                        <ResponsiveContainer width="100%" height={Math.max(140, roleData.length * 36)}>
                          <BarChart data={roleData} layout="vertical" margin={{ left: 0, right: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: t.textMuted }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 13 }} cursor={{ fill: t.bgHover }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#f59e0b" barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Recent activity */}
                    {recentLeads.length > 0 && (
                      <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Recent Activity</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {recentLeads.map((r, i) => (
                            <div key={r.id || i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: t.bgHover, borderRadius: 8, borderLeft: `3px solid ${t.accent}` }}>
                              <span style={{ fontSize: 18 }}>💼</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.companyName}</div>
                                <div style={{ fontSize: 12, color: t.textDim }}>{r.jobTitle} · {r.jobPayRate} · {r.location}</div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 12, color: r.urgency === "high" ? t.green : t.textDim, fontWeight: 700 }}>{r.urgency === "high" ? "🔥 Hot" : r.urgency === "medium" ? "Active" : "Listed"}</div>
                                {r.postingDate && <div style={{ fontSize: 11, color: t.textFaint }}>{r.postingDate}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ════════════ ADD LEAD ════════════ */}
          {tab === "add" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>New Lead Entry</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={loadDemoData} style={btnSecondary}>Load Demo Data</button>
                  <button onClick={() => setShowUpload(!showUpload)} style={btnSecondary}>{showUpload ? "✕ Close Upload" : "↑ CSV Upload"}</button>
                </div>
              </div>

              {showUpload && (
                <div style={{ marginBottom: 24, padding: 24, border: `2px dashed ${t.borderInput}`, borderRadius: 12, background: t.bgHover, textAlign: "center", animation: "slideUp 0.3s ease" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 4 }}>Upload a CSV file with your leads</p>
                  <p style={{ fontSize: 11, color: t.textFaint, marginBottom: 16 }}>Columns: name, company, email, phone, projectType, budget, location, zipCode, timeline, description, source</p>
                  <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: "none" }} />
                  <button onClick={() => fileRef.current?.click()} style={btnPrimary}>Choose File</button>
                  <button onClick={() => {
                    const t1 = PROJECT_TYPES[0]?.id || "type1"; const t2 = PROJECT_TYPES[1]?.id || "type2";
                    const sample = `name,company,email,phone,projectType,budget,location,zipCode,timeline,description,source\nJohn Smith,Example Corp,john@example.com,555-0101,${t1},250000,Downtown,90210,6-12,Sample ${ind.leadNoun} description,Website\nJane Doe,Another Co,jane@example.com,555-0102,${t2},45000,Suburbs,10001,0-3,Another sample ${ind.leadNoun},Referral`;
                    const blob = new Blob([sample], { type: "text/csv" }); const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "sample_leads.csv"; a.click();
                  }} style={{ marginLeft: 12, ...btnSecondary, background: "transparent" }}>↓ Sample CSV</button>
                </div>
              )}

              <div style={cardStyle} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA") handleAddLead(); }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
                  <div><label style={labelStyle}>Contact Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Smith" autoFocus /></div>
                  <div><label style={labelStyle}>Company</label><input style={inputStyle} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Company name" /></div>
                  <div><label style={labelStyle}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" /></div>
                  <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" /></div>
                  <div><label style={labelStyle}>{ind.typeName} *</label><select style={{ ...inputStyle, cursor: "pointer" }} value={form.projectType} onChange={e => setForm(p => ({ ...p, projectType: e.target.value }))}><option value="">Select…</option>{PROJECT_TYPES.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}</select></div>
                  <div><label style={labelStyle}>Budget ($) *</label><input style={inputStyle} type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="250000" /></div>
                  <div><label style={labelStyle}>Location</label><input style={inputStyle} value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City / Area" /></div>
                  <div><label style={labelStyle}>ZIP Code</label><input style={inputStyle} value={form.zipCode} onChange={e => setForm(p => ({ ...p, zipCode: e.target.value }))} placeholder="90210" /></div>
                  <div><label style={labelStyle}>Timeline</label><select style={{ ...inputStyle, cursor: "pointer" }} value={form.timeline} onChange={e => setForm(p => ({ ...p, timeline: e.target.value }))}><option value="">Select…</option>{TIMELINE_OPTIONS.map(tl => <option key={tl.value} value={tl.value}>{tl.label}</option>)}</select></div>
                  <div><label style={labelStyle}>Lead Source</label><input style={inputStyle} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="Website, Referral…" /></div>
                </div>
                <div style={{ marginTop: 18 }}><label style={labelStyle}>Project Description</label><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the project scope…" /></div>
                <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                  <button onClick={handleAddLead} style={{ ...btnPrimary, padding: "12px 32px" }}>Qualify & Add Lead →</button>
                  <button onClick={() => setForm({ ...EMPTY_LEAD })} style={{ ...btnSecondary, background: "transparent" }}>Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ LEADS ════════════ */}
          {tab === "leads" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {leads.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🏗</div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>No leads yet</h3>
                  <p style={{ color: t.textFaint, fontSize: 14, marginBottom: 24 }}>Find real opportunities or add leads manually</p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setTab("prospects")} style={btnPrimary}>⚡ Find Prospects</button>
                    <button onClick={() => setTab("add")} style={btnSecondary}>+ Add Manually</button>
                    <button onClick={loadDemoData} style={btnSecondary}>Load Demo Data</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Toolbar */}
                  <div className="toolbar-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input style={{ ...inputStyle, width: 200, padding: "8px 14px", fontSize: 13 }} placeholder="Search leads…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                      {["all", "qualified", "unqualified"].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filterStatus === s ? t.accent : t.borderLight}`, background: filterStatus === s ? t.accent : "transparent", color: filterStatus === s ? "#0c0a09" : t.textMuted, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", textTransform: "capitalize", transition: "all 0.15s" }}>
                          {s === "all" ? `All (${leads.length})` : s === "qualified" ? `Qualified (${qualifiedCount})` : `Unqualified (${unqualifiedCount})`}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => {
                        const csv = ["Name,Company,Email,Phone,Project Type,Budget,Location,ZIP,Timeline,Source,Status,Follow Up,Score", ...leads.map(l => `"${l.name}","${l.company}","${l.email}","${l.phone}","${l.projectType}","${l.budget}","${l.location}","${l.zipCode}","${l.timeline}","${l.source}","${l.result.qualified ? "Qualified" : "Unqualified"}","${l.followUp}","${l.result.score}/${l.result.total}"`)].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "qualified_leads.csv"; a.click();
                      }} style={btnSecondary}>↓ Export</button>
                      <button onClick={handleClearAll} style={{ ...btnSecondary, color: t.red, borderColor: t.redBorder }}>Clear All</button>
                    </div>
                  </div>

                  {/* Follow-up filter */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>Follow-up:</span>
                    <button onClick={() => setFilterFollowUp("all")} style={{ padding: "4px 12px", borderRadius: 12, border: `1px solid ${filterFollowUp === "all" ? t.accent : t.borderLight}`, background: filterFollowUp === "all" ? t.accent + "22" : "transparent", color: filterFollowUp === "all" ? t.accent : t.textDim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>All</button>
                    {FOLLOWUP_STATUSES.map(s => (
                      <button key={s.id} onClick={() => setFilterFollowUp(s.id)} style={{ padding: "4px 12px", borderRadius: 12, border: `1px solid ${filterFollowUp === s.id ? s.color : t.borderLight}`, background: filterFollowUp === s.id ? s.color + "22" : "transparent", color: filterFollowUp === s.id ? s.color : t.textDim, cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{s.label}</button>
                    ))}
                  </div>

                  {/* Sort */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: t.textFaint, marginRight: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sort:</span>
                      {[{ id: "date", label: "Date" }, { id: "name", label: "Name" }, { id: "budget", label: "Budget" }, { id: "score", label: "Score" }].map(s => (
                        <button key={s.id} className={`sort-btn ${sortBy === s.id ? "active" : ""}`} onClick={() => { if (sortBy === s.id) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortBy(s.id); setSortDir("desc"); } }}>
                          {s.label} {sortBy === s.id ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: t.textFaint, fontStyle: "italic" }}>Click any cell to edit inline · Esc to cancel</span>
                  </div>

                  {/* Table header */}
                  <div className="lead-grid-header" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 1fr 120px", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textFaint, borderBottom: `1px solid ${t.border}` }}>
                    <span>Name</span><span>{ind.typeName}</span><span>Budget</span><span>Timeline</span><span>ZIP</span><span>Follow-up</span><span>Status</span>
                  </div>

                  {filteredLeads.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: t.textFaint, fontSize: 14 }}>No leads match your filters</div>
                  ) : filteredLeads.map((lead, idx) => (
                    <div key={lead.id}>
                      <div className="lead-row" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 1fr 120px", gap: 8, padding: "12px 16px", fontSize: 14, cursor: "pointer", borderBottom: `1px solid ${t.border}`, transition: "background 0.15s", animation: `slideUp 0.25s ease ${Math.min(idx * 0.02, 0.3)}s both`, alignItems: "center" }}
                        onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}>
                        <div>
                          <InlineCell lead={lead} field="name" style={{ fontWeight: 600, fontSize: 14, display: "block" }}>
                            {lead.name || "—"}
                          </InlineCell>
                          {lead.company && <InlineCell lead={lead} field="company" style={{ fontSize: 12, color: t.textDim, display: "block", marginTop: 2 }}>{lead.company}</InlineCell>}
                        </div>
                        <div>
                          <InlineCell lead={lead} field="projectType" options={PROJECT_TYPES.map(pt => ({ value: pt.id, label: pt.label }))} style={{ color: t.textMuted, textTransform: "capitalize", fontSize: 13 }}>
                            {(lead.projectType || "—").replace(/_/g, " ")}
                          </InlineCell>
                        </div>
                        <div>
                          <InlineCell lead={lead} field="budget" type="number" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                            {lead.budget ? `$${parseInt(lead.budget).toLocaleString()}` : "—"}
                          </InlineCell>
                        </div>
                        <div>
                          <InlineCell lead={lead} field="timeline" options={TIMELINE_OPTIONS.map(tl => ({ value: tl.value, label: tl.label }))} style={{ color: t.textMuted, fontSize: 12 }}>
                            {lead.timeline ? (TIMELINE_OPTIONS.find(tl => tl.value === lead.timeline)?.label || lead.timeline) : "—"}
                          </InlineCell>
                        </div>
                        <div>
                          <InlineCell lead={lead} field="zipCode" style={{ color: t.textMuted, fontSize: 12 }}>
                            {lead.zipCode || "—"}
                          </InlineCell>
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          <select value={lead.followUp || "new"} onChange={e => handleFollowUpChange(lead.id, e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: 12, border: `1px solid ${(FOLLOWUP_STATUSES.find(s => s.id === lead.followUp) || FOLLOWUP_STATUSES[0]).color}44`, background: (FOLLOWUP_STATUSES.find(s => s.id === lead.followUp) || FOLLOWUP_STATUSES[0]).color + "18", color: (FOLLOWUP_STATUSES.find(s => s.id === lead.followUp) || FOLLOWUP_STATUSES[0]).color, fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", outline: "none" }}>
                            {FOLLOWUP_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </div>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: lead.result.qualified ? t.greenBg : t.redBg, color: lead.result.qualified ? t.green : t.red, border: `1px solid ${lead.result.qualified ? t.greenBorder : t.redBorder}` }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: lead.result.qualified ? t.green : t.red }} />
                          {lead.result.score}/{lead.result.total}
                        </span>
                      </div>

                      {expandedLead === lead.id && (
                        <div style={{ padding: "20px 16px 20px 32px", background: t.bgAlt, borderBottom: `1px solid ${t.border}`, animation: "slideUp 0.2s ease" }}>
                          {editingLead === lead.id ? (
                            <div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                                {[{ key: "name", label: "Name" }, { key: "company", label: "Company" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "budget", label: "Budget", type: "number" }, { key: "location", label: "Location" }, { key: "zipCode", label: "ZIP" }, { key: "source", label: "Source" }].map(f => (
                                  <div key={f.key}><label style={labelStyle}>{f.label}</label><input style={{ ...inputStyle, padding: "8px 12px", fontSize: 13 }} type={f.type || "text"} value={editForm[f.key] || ""} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} /></div>
                                ))}
                                <div><label style={labelStyle}>{ind.typeName}</label><select style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, cursor: "pointer" }} value={editForm.projectType} onChange={e => setEditForm(p => ({ ...p, projectType: e.target.value }))}><option value="">Select…</option>{PROJECT_TYPES.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}</select></div>
                                <div><label style={labelStyle}>Timeline</label><select style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, cursor: "pointer" }} value={editForm.timeline} onChange={e => setEditForm(p => ({ ...p, timeline: e.target.value }))}><option value="">Select…</option>{TIMELINE_OPTIONS.map(tl => <option key={tl.value} value={tl.value}>{tl.label}</option>)}</select></div>
                              </div>
                              <div style={{ marginTop: 12 }}><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontSize: 13 }} value={editForm.description || ""} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} /></div>
                              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                                <button onClick={() => handleSaveEdit(lead.id)} style={{ ...btnPrimary, padding: "8px 20px", fontSize: 13 }}>Save & Re-Qualify</button>
                                <button onClick={() => { setEditingLead(null); setEditForm(null); }} style={{ ...btnSecondary, background: "transparent" }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                              <div style={{ flex: "1 1 260px" }}>
                                <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Contact Details</h4>
                                <div style={{ display: "grid", gap: 6, fontSize: 13, color: t.textMuted }}>
                                  {lead.email && <div>✉ {lead.email}</div>}
                                  {lead.phone && <div>☎ {lead.phone}</div>}
                                  {lead.location && <div>📍 {lead.location} {lead.zipCode && `(${lead.zipCode})`}</div>}
                                  {lead.source && <div>🔗 Source: {lead.source}</div>}
                                  {lead.description && <div style={{ marginTop: 8, padding: 12, background: t.bgHover, borderRadius: 6, lineHeight: 1.5 }}>{lead.description}</div>}
                                </div>
                                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                                  <button onClick={() => { setEditingLead(lead.id); setEditForm({ ...lead }); }} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>✏ Edit</button>
                                  <button onClick={() => handleDeleteLead(lead.id)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", color: t.red, borderColor: t.redBorder, background: "transparent" }}>🗑 Delete</button>
                                </div>
                              </div>
                              <div style={{ flex: "1 1 300px" }}>
                                <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Qualification Breakdown</h4>
                                <div style={{ display: "grid", gap: 8 }}>
                                  {lead.result.criteria.map((c, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: t.bgHover, borderRadius: 6, borderLeft: `3px solid ${c.pass ? t.green : t.red}` }}>
                                      <span style={{ fontSize: 14, color: c.pass ? t.green : t.red }}>{c.pass ? "✓" : "✕"}</span>
                                      <div><div style={{ fontSize: 13, fontWeight: 600, color: c.pass ? t.green : t.red }}>{c.name}</div><div style={{ fontSize: 11, color: t.textDim }}>{c.detail}</div></div>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ marginTop: 12, padding: "10px 14px", background: lead.result.qualified ? t.greenBg : t.redBg, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>Final Score</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: lead.result.qualified ? t.green : t.red }}>{lead.result.score}/{lead.result.total}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ════════════ PROSPECTS ════════════ */}
          {tab === "prospects" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>🎯 Prospect Search</h2>
                <p style={{ color: t.textDim, fontSize: 14, lineHeight: 1.5 }}>Multi-pass deep search to find service businesses that need AI, web, and ad services from Ascend Solutions.</p>
              </div>

              <div style={cardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>City or Region *</label>
                    <input style={{ ...inputStyle }} value={prospectCity} onChange={e => setProspectCity(e.target.value)} placeholder="Austin TX" />
                  </div>
                  <div>
                    <label style={labelStyle}>Business Niche *</label>
                    <input style={{ ...inputStyle }} value={prospectNiche} onChange={e => setProspectNiche(e.target.value)} placeholder="HVAC, roofing, plumbing..." />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Number of Results</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[5, 10, 15].map(n => (
                      <button key={n} onClick={() => setProspectCount(n)}
                        style={{ padding: "8px 20px", background: prospectCount === n ? t.accent : t.bgHover, border: `1px solid ${prospectCount === n ? t.accent : t.borderLight}`, borderRadius: 8, color: prospectCount === n ? "#0c0a09" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: prospectCount === n ? 700 : 500, transition: "all 0.15s" }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Filter by Buying Signals (optional)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginTop: 8 }}>
                    {[
                      { key: "hiringOnIndeed", label: "☑ Hiring on Indeed" },
                      { key: "badWebsite", label: "☑ No/bad website" },
                      { key: "lowReviews", label: "☑ Low Google reviews" },
                      { key: "noSocial", label: "☑ No social media" },
                      { key: "runningAds", label: "☑ Running ads" },
                      { key: "recentlyStarted", label: "☑ Recently started" },
                    ].map(f => (
                      <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: t.bgHover, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={prospectFilters[f.key]} onChange={e => setProspectFilters(p => ({ ...p, [f.key]: e.target.checked }))} style={{ cursor: "pointer" }} />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={handleProspectSearch} disabled={prospectLoading} style={{ ...btnPrimary, padding: "12px 32px", fontSize: 15, opacity: prospectLoading ? 0.6 : 1, cursor: prospectLoading ? "wait" : "pointer" }}>
                  {prospectLoading ? "Searching..." : "🔍 Search Prospects"}
                </button>
              </div>

              {prospectLoading && (
                <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 36, marginBottom: 16, animation: "pulse 1.2s infinite" }}>🔍</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Deep search in progress...</div>
                  <div style={{ fontSize: 13, color: t.textDim, maxWidth: 500, margin: "0 auto", lineHeight: 1.5 }}>
                    Step 1: Finding {prospectNiche} businesses in {prospectCity}<br />
                    Step 2: Checking Indeed, Google, social media<br />
                    Step 3: Identifying buying signals
                  </div>
                </div>
              )}

              {prospectError && (
                <div style={{ ...cardStyle, background: t.redBg, border: `1px solid ${t.redBorder}` }}>
                  <span style={{ fontSize: 20 }}>⚠</span> {prospectError}
                </div>
              )}

              {prospects.length > 0 && !prospectLoading && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>Found {prospects.length} prospects</div>
                  <div style={{ display: "grid", gap: 16 }}>
                    {prospects.map(p => (
                      <div key={p.id} style={{ ...cardStyle, borderLeft: `4px solid ${p.classification.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{p.businessName}</h3>
                              <span style={{ padding: "4px 10px", background: p.classification.color + "22", color: p.classification.color, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                                {p.classification.emoji} {p.classification.tier}
                              </span>
                              <span style={{ padding: "4px 10px", background: t.bgHover, borderRadius: 12, fontSize: 11, color: t.textMuted }}>{p.niche}</span>
                            </div>
                            {p.ownerName && <div style={{ fontSize: 14, color: t.textMuted }}>Owner: {p.ownerName}</div>}
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Contact Info</div>
                            {p.phone && <div style={{ fontSize: 13, marginBottom: 4 }}>☎ {p.phone}</div>}
                            {p.email && <div style={{ fontSize: 13, marginBottom: 4 }}>✉ {p.email}</div>}
                            {p.website && <div style={{ fontSize: 13, marginBottom: 4 }}>🌐 {p.website}</div>}
                            {p.address && <div style={{ fontSize: 13, color: t.textMuted }}>📍 {p.address}</div>}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Business Info</div>
                            {p.googleReviews.count > 0 && <div style={{ fontSize: 13, marginBottom: 4 }}>⭐ {p.googleReviews.rating} ({p.googleReviews.count} reviews)</div>}
                            {p.estimatedRevenue && <div style={{ fontSize: 13, marginBottom: 4 }}>💰 {p.estimatedRevenue}</div>}
                            {p.yearEstablished && <div style={{ fontSize: 13, marginBottom: 4 }}>📅 Est. {p.yearEstablished}</div>}
                            {p.websiteQuality && <div style={{ fontSize: 13, color: t.textMuted }}>🌐 {p.websiteQuality}</div>}
                          </div>
                        </div>

                        {p.socialMedia && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Social Media</div>
                            <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                              <span>FB: {p.socialMedia.facebook === "active" ? "✓" : "✗"}</span>
                              <span>IG: {p.socialMedia.instagram === "active" ? "✓" : "✗"}</span>
                              <span>LI: {p.socialMedia.linkedin === "active" ? "✓" : "✗"}</span>
                            </div>
                          </div>
                        )}

                        {p.indeedHiring && p.indeedHiring.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Hiring on Indeed</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {p.indeedHiring.map((job, i) => (
                                <span key={i} style={{ padding: "4px 10px", background: t.greenBg, color: t.green, borderRadius: 12, fontSize: 11 }}>{job}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.buyingSignals && p.buyingSignals.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🔥 Buying Signals</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {p.buyingSignals.map((sig, i) => (
                                <div key={i} style={{ padding: "6px 10px", background: t.accent + "11", borderLeft: `3px solid ${t.accent}`, borderRadius: 4, fontSize: 12 }}>{sig}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.opportunities && p.opportunities.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>💡 Opportunities</div>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: t.textMuted }}>
                              {p.opportunities.map((opp, i) => <li key={i} style={{ marginBottom: 2 }}>{opp}</li>)}
                            </ul>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
                          <button onClick={() => expandedProspect === p.id ? setExpandedProspect(null) : setExpandedProspect(p.id)} style={{ ...btnSecondary, fontSize: 12 }}>
                            {expandedProspect === p.id ? "Hide Details" : "Show Details"}
                          </button>
                          <button onClick={() => handleDraftEmail(p)} disabled={draftingEmail === p.id} style={{ ...btnSecondary, fontSize: 12 }}>
                            {draftingEmail === p.id ? "Drafting..." : emailDrafts[p.id] ? "Re-draft Email" : "Draft Email"}
                          </button>
                        </div>

                        {emailDrafts[p.id] && (
                          <div style={{ marginTop: 12, padding: 16, background: t.bgAlt, borderRadius: 8, border: `1px solid ${t.borderLight}` }}>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>📧 Email Draft</div>
                            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{emailDrafts[p.id]}</div>
                            <button onClick={() => { navigator.clipboard.writeText(emailDrafts[p.id]); showToast("Email copied to clipboard"); }} style={{ ...btnPrimary, fontSize: 12, padding: "6px 16px" }}>
                              Copy to Clipboard
                            </button>
                          </div>
                        )}

                        {expandedProspect === p.id && p.sourceUrls && p.sourceUrls.length > 0 && (
                          <div style={{ marginTop: 12, padding: 12, background: t.bgHover, borderRadius: 6 }}>
                            <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Sources</div>
                            {p.sourceUrls.map((url, i) => (
                              <div key={i} style={{ fontSize: 11, color: t.accent, marginBottom: 2 }}>{url}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ JOE'S QUEUE ════════════ */}
          {tab === "queue" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>📞 Joe's Queue</h2>
                <p style={{ color: t.textDim, fontSize: 14 }}>Warm prospects ready to contact — sorted by signal strength</p>
              </div>

              {(() => {
                const warmProspects = prospects.filter(p => p.classification.tier === "WARM").sort((a, b) => b.buyingSignals.length - a.buyingSignals.length);
                const hotIndeed = indeedResults.filter(r => r.urgency === "high" && indeedQueueActions[r.id] !== "skip").sort((a, b) => b.buyingSignals.length - a.buyingSignals.length);
                const totalContacted = Object.values(queueActions).filter(a => a === "contacted").length + Object.values(indeedQueueActions).filter(a => a === "contacted").length;
                const totalReplied = Object.values(queueActions).filter(a => a === "replied").length + Object.values(indeedQueueActions).filter(a => a === "replied").length;

                if (warmProspects.length === 0 && hotIndeed.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "80px 20px" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📞</div>
                      <h3 style={{ fontSize: 18, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>No warm leads yet</h3>
                      <p style={{ color: t.textFaint, fontSize: 14, marginBottom: 24 }}>Run a prospect search or hunt Indeed leads to populate your queue</p>
                      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <button onClick={() => setTab("prospects")} style={btnPrimary}>🎯 Search Prospects</button>
                        <button onClick={() => setTab("indeed")} style={btnSecondary}>💼 Hunt Indeed Leads</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    <div style={{ ...cardStyle, display: "flex", gap: 40, marginBottom: 20, flexWrap: "wrap" }}>
                      <div><span style={{ fontSize: 28, fontWeight: 700, color: t.green }}>{warmProspects.length}</span><div style={{ fontSize: 11, color: t.textDim }}>WARM PROSPECTS</div></div>
                      <div><span style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{hotIndeed.length}</span><div style={{ fontSize: 11, color: t.textDim }}>HOT INDEED LEADS</div></div>
                      <div><span style={{ fontSize: 28, fontWeight: 700, color: t.accent }}>{totalContacted}</span><div style={{ fontSize: 11, color: t.textDim }}>CONTACTED</div></div>
                      <div><span style={{ fontSize: 28, fontWeight: 700, color: t.green }}>{totalReplied}</span><div style={{ fontSize: 11, color: t.textDim }}>REPLIED</div></div>
                    </div>

                    {hotIndeed.length > 0 && (
                      <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>🔥 Hot Indeed Leads — Actively Hiring</div>
                        <div style={{ display: "grid", gap: 12 }}>
                          {hotIndeed.map(r => (
                            <div key={r.id} style={{ ...cardStyle, borderLeft: `4px solid ${t.green}`, padding: 16, marginBottom: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                                <div>
                                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{r.companyName}</h3>
                                  <div style={{ fontSize: 13, color: t.textMuted }}>Hiring: {r.jobTitle} · {r.jobPayRate} · {r.location}</div>
                                </div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: t.accent }}>{r.annualCost}/yr</div>
                              </div>
                              {r.pitchHook && <div style={{ padding: "8px 12px", background: t.accent + "0f", borderLeft: `3px solid ${t.accent}`, borderRadius: 4, fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>{r.pitchHook}</div>}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {!indeedEmailDrafts[r.id] && (
                                  <button onClick={() => { setTab("indeed"); }} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>View in Indeed Leads</button>
                                )}
                                {indeedEmailDrafts[r.id] && (
                                  <button onClick={() => { navigator.clipboard.writeText(indeedEmailDrafts[r.id]); showToast("Copied to clipboard"); }} style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px" }}>Copy Outreach</button>
                                )}
                                <button onClick={() => setIndeedQueueActions(prev => ({ ...prev, [r.id]: prev[r.id] === "contacted" ? undefined : "contacted" }))}
                                  style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", background: indeedQueueActions[r.id] === "contacted" ? t.accent + "22" : t.bgHover, color: indeedQueueActions[r.id] === "contacted" ? t.accent : t.textMuted }}>
                                  {indeedQueueActions[r.id] === "contacted" ? "✓ Contacted" : "Mark Contacted"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {warmProspects.length > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>🟢 Warm Prospects</div>}

                    <div style={{ marginBottom: 12, textAlign: "right" }}>
                      <button onClick={() => {
                        const csv = ["Business Name,Owner,Phone,Email,Website,Address,Niche,Buying Signals,Opportunities", ...warmProspects.map(p =>
                          `"${p.businessName}","${p.ownerName}","${p.phone}","${p.email}","${p.website}","${p.address}","${p.niche}","${(p.buyingSignals || []).join("; ")}","${(p.opportunities || []).join("; ")}"`
                        )].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "joes_queue.csv";
                        a.click();
                      }} style={{ ...btnSecondary, fontSize: 12 }}>
                        ↓ Export CSV
                      </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                      {warmProspects.map(p => (
                        <div key={p.id} style={{ ...cardStyle, borderLeft: `4px solid ${t.green}`, opacity: queueActions[p.id] === "dismissed" ? 0.4 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                            <div>
                              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.businessName}</h3>
                              <div style={{ fontSize: 14, color: t.textMuted }}>{p.ownerName} • {p.phone} • {p.email}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {p.buyingSignals.slice(0, 2).map((sig, i) => (
                                <span key={i} style={{ padding: "4px 8px", background: t.accent + "22", color: t.accent, borderRadius: 8, fontSize: 10, fontWeight: 700 }}>🔥 {i + 1}</span>
                              ))}
                            </div>
                          </div>

                          <div style={{ marginBottom: 12, fontSize: 13 }}>
                            <strong>Top Signals:</strong>
                            <div style={{ marginTop: 4 }}>
                              {p.buyingSignals.slice(0, 2).map((sig, i) => (
                                <div key={i} style={{ padding: "6px 10px", background: t.accent + "11", borderLeft: `3px solid ${t.accent}`, borderRadius: 4, fontSize: 12, marginBottom: 4 }}>{sig}</div>
                              ))}
                            </div>
                          </div>

                          {emailDrafts[p.id] && (
                            <div style={{ marginBottom: 12, padding: 12, background: t.bgAlt, borderRadius: 6, border: `1px solid ${t.borderLight}` }}>
                              <div style={{ fontSize: 11, color: t.textDim, marginBottom: 6 }}>📧 DRAFT EMAIL</div>
                              <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{emailDrafts[p.id]}</div>
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {!emailDrafts[p.id] && (
                              <button onClick={() => handleDraftEmail(p)} disabled={draftingEmail === p.id} style={{ ...btnPrimary, fontSize: 12, padding: "8px 16px" }}>
                                {draftingEmail === p.id ? "Drafting..." : "Draft Email"}
                              </button>
                            )}
                            {emailDrafts[p.id] && (
                              <button onClick={() => { navigator.clipboard.writeText(emailDrafts[p.id]); showToast("Copied to clipboard"); }} style={{ ...btnPrimary, fontSize: 12, padding: "8px 16px" }}>
                                Copy Email
                              </button>
                            )}
                            <button onClick={() => setQueueActions(prev => ({ ...prev, [p.id]: "contacted" }))} disabled={queueActions[p.id] === "contacted"} style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", background: queueActions[p.id] === "contacted" ? t.accent + "22" : t.bgHover }}>
                              {queueActions[p.id] === "contacted" ? "✓ Contacted" : "Mark Contacted"}
                            </button>
                            <button onClick={() => setQueueActions(prev => ({ ...prev, [p.id]: "replied" }))} disabled={queueActions[p.id] === "replied"} style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", background: queueActions[p.id] === "replied" ? t.green + "22" : t.bgHover }}>
                              {queueActions[p.id] === "replied" ? "✓ Replied" : "Mark Replied"}
                            </button>
                            <button onClick={() => setQueueActions(prev => ({ ...prev, [p.id]: "dismissed" }))} style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", color: t.textDim }}>
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ════════════ INDEED LEADS ════════════ */}
          {tab === "indeed" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>🎯 Lead Generator</h2>
                <p style={{ color: t.textDim, fontSize: 14, lineHeight: 1.5 }}>Find companies posting roles AI can replace. Searches across Indeed, LinkedIn, ZipRecruiter, Glassdoor, and more.</p>
              </div>

              <div style={cardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>City or Region <span style={{ color: t.textFaint, fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional — leave blank for all remote)</span></label>
                    <input style={inputStyle} value={indeedCity} onChange={e => setIndeedCity(e.target.value)} placeholder="Austin TX, Miami FL... or leave blank" />
                  </div>
                  <div>
                    <label style={labelStyle}>Number of Results</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[5, 10, 15].map(n => (
                        <button key={n} onClick={() => setIndeedCount(n)}
                          style={{ padding: "8px 20px", background: indeedCount === n ? t.accent : t.bgHover, border: `1px solid ${indeedCount === n ? t.accent : t.borderLight}`, borderRadius: 8, color: indeedCount === n ? "#0c0a09" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: indeedCount === n ? 700 : 500, transition: "all 0.15s" }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Roles to Hunt *</label>
                  <p style={{ fontSize: 12, color: t.textFaint, marginBottom: 10 }}>Companies posting these roles have proven they need the function — and they have budget for it.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                    {INDEED_ROLES.map(role => {
                      const active = indeedSelectedRoles.includes(role.id);
                      return (
                        <button key={role.id}
                          onClick={() => setIndeedSelectedRoles(prev => active ? prev.filter(r => r !== role.id) : [...prev, role.id])}
                          style={{ padding: "10px 14px", background: active ? t.accent + "1a" : t.bgHover, border: `1px solid ${active ? t.accent : t.borderLight}`, borderRadius: 8, color: active ? t.accent : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{role.icon}</span>
                          <span style={{ flex: 1 }}>{role.label}</span>
                          {active && <span style={{ fontSize: 11 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Custom Role (optional)</label>
                  <input style={inputStyle} value={indeedCustomRole} onChange={e => setIndeedCustomRole(e.target.value)} placeholder="e.g. Lead Qualifier, Cold Caller, Follow-up Specialist..." />
                </div>

                <button onClick={handleIndeedSearch} disabled={indeedLoading}
                  style={{ ...btnPrimary, padding: "12px 32px", fontSize: 15, opacity: indeedLoading ? 0.6 : 1, cursor: indeedLoading ? "wait" : "pointer" }}>
                  {indeedLoading ? "Hunting..." : "🎯 Hunt Indeed Leads"}
                </button>
              </div>

              {indeedLoading && (
                <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 36, marginBottom: 16, animation: "pulse 1.2s infinite" }}>💼</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Scanning Indeed job postings...</div>
                  <div style={{ fontSize: 13, color: t.textDim, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                    Roles: {[...indeedSelectedRoles.map(id => INDEED_ROLES.find(r => r.id === id)?.label).filter(Boolean), ...(indeedCustomRole ? [indeedCustomRole] : [])].join(", ")}<br />
                    Location: {indeedCity}<br />
                    Building company profiles + automation pitch angles
                  </div>
                </div>
              )}

              {indeedError && (
                <div style={{ ...cardStyle, background: t.redBg, border: `1px solid ${t.redBorder}`, marginTop: 16 }}>
                  <span style={{ fontSize: 20 }}>⚠</span> {indeedError}
                </div>
              )}

              {indeedResults.length > 0 && !indeedLoading && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>Found {indeedResults.length} companies hiring</span>
                      <span style={{ fontSize: 12, color: t.textDim, marginLeft: 12 }}>
                        {indeedResults.filter(r => r.urgency === "high").length} hot · {indeedResults.filter(r => r.urgency === "medium").length} active
                      </span>
                    </div>
                    <button onClick={() => {
                      const csv = ["Company,Industry,Location,Job Title,Pay Rate,Annual Cost,Website,Phone,Email,Urgency,Automation Angle,Pitch Hook", ...indeedResults.map(r =>
                        `"${r.companyName}","${r.industry}","${r.location}","${r.jobTitle}","${r.jobPayRate}","${r.annualCost}","${r.website}","${r.phone}","${r.email}","${r.urgency}","${r.automationAngle}","${r.pitchHook}"`
                      )].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = "indeed_leads.csv"; a.click();
                    }} style={{ ...btnSecondary, fontSize: 12 }}>↓ Export CSV</button>
                  </div>

                  <div style={{ display: "grid", gap: 16 }}>
                    {indeedResults.map(r => {
                      const urgencyColor = r.urgency === "high" ? t.green : r.urgency === "medium" ? t.accent : t.textDim;
                      const urgencyBg = r.urgency === "high" ? t.greenBg : r.urgency === "medium" ? t.accent + "15" : t.bgHover;
                      const urgencyLabel = r.urgency === "high" ? "🔥 Hot Listing" : r.urgency === "medium" ? "⚡ Active" : "📋 Listed";
                      const skipped = indeedQueueActions[r.id] === "skip";
                      return (
                        <div key={r.id} style={{ ...cardStyle, borderLeft: `4px solid ${urgencyColor}`, opacity: skipped ? 0.4 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{r.companyName}</h3>
                                <span style={{ padding: "4px 10px", background: urgencyBg, color: urgencyColor, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{urgencyLabel}</span>
                                {indeedQueueActions[r.id] === "contacted" && <span style={{ padding: "4px 10px", background: t.accent + "22", color: t.accent, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✓ Contacted</span>}
                                {indeedQueueActions[r.id] === "replied" && <span style={{ padding: "4px 10px", background: t.greenBg, color: t.green, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✓ Replied</span>}
                                {r.pipelineTag && <span style={{ padding: "4px 10px", background: "#f59e0b22", color: "#f59e0b", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{r.pipelineTag}</span>}
                              </div>
                              {r.industry && <div style={{ fontSize: 13, color: t.textMuted }}>{r.industry} · {r.location}</div>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: t.accent }}>{r.jobPayRate}</div>
                              {r.annualCost && <div style={{ fontSize: 11, color: t.textDim }}>{r.annualCost}/yr budget signal</div>}
                            </div>
                          </div>

                          {/* Job posting */}
                          <div style={{ padding: "10px 14px", background: t.bgHover, borderRadius: 8, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Indeed Posting</div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>📋 {r.jobTitle}</div>
                              {r.postingDate && <div style={{ fontSize: 11, color: t.textMuted }}>Posted {r.postingDate}</div>}
                            </div>
                            {r.companySize && <div style={{ fontSize: 12, color: t.textMuted }}>👥 {r.companySize}</div>}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
                            <div>
                              <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Contact Info</div>
                              {r.phone && <div style={{ fontSize: 13, marginBottom: 4 }}>☎ {r.phone}</div>}
                              {r.email && <div style={{ fontSize: 13, marginBottom: 4 }}>✉ {r.email}</div>}
                              {r.website && <div style={{ fontSize: 13 }}>🌐 {r.website}</div>}
                              {!r.phone && !r.email && !r.website && <div style={{ fontSize: 12, color: t.textFaint }}>No contact info found</div>}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Business Info</div>
                              {r.googleReviews.count > 0 && <div style={{ fontSize: 13, marginBottom: 4 }}>⭐ {r.googleReviews.rating} ({r.googleReviews.count} reviews)</div>}
                              {r.companySize && <div style={{ fontSize: 13 }}>👥 {r.companySize}</div>}
                            </div>
                          </div>

                          {r.automationAngle && (
                            <div style={{ padding: "12px 14px", background: t.accent + "0f", border: `1px solid ${t.accent}33`, borderRadius: 8, marginBottom: 14 }}>
                              <div style={{ fontSize: 11, color: t.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 700 }}>🤖 Automation Angle</div>
                              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.automationAngle}</div>
                            </div>
                          )}

                          {r.buyingSignals && r.buyingSignals.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🔥 Why They Need This Now</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {r.buyingSignals.map((sig, i) => (
                                  <div key={i} style={{ padding: "6px 10px", background: t.bgHover, borderLeft: `3px solid ${t.accent}`, borderRadius: 4, fontSize: 12 }}>{sig}</div>
                                ))}
                              </div>
                            </div>
                          )}

                          {r.opportunities && r.opportunities.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>💡 What to Pitch</div>
                              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: t.textMuted }}>
                                {r.opportunities.map((opp, i) => <li key={i} style={{ marginBottom: 2 }}>{opp}</li>)}
                              </ul>
                            </div>
                          )}

                          <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, flexWrap: "wrap" }}>
                            <button onClick={() => handleIndeedDraftEmail(r)} disabled={draftingIndeedEmail === r.id}
                              style={{ ...btnPrimary, fontSize: 12, padding: "8px 16px", opacity: draftingIndeedEmail === r.id ? 0.6 : 1 }}>
                              {draftingIndeedEmail === r.id ? "Drafting..." : indeedEmailDrafts[r.id] ? "Re-draft Outreach" : "Draft Outreach"}
                            </button>
                            {(() => {
                              const normCo = (s) => (s || "").toLowerCase().trim().replace(/[™®©]/g, "").replace(/[^a-z0-9]/g, "");
                              const inPipeline = leads.some(l => normCo(l.company) === normCo(r.companyName));
                              return (
                                <button
                                  onClick={() => !inPipeline && handleAddIndeedToPipeline(r)}
                                  disabled={inPipeline}
                                  style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", background: inPipeline ? t.green + "22" : t.bgHover, color: inPipeline ? t.green : t.textMuted, opacity: inPipeline ? 0.8 : 1, cursor: inPipeline ? "default" : "pointer" }}>
                                  {inPipeline ? "✓ In Pipeline" : "➕ Add to Pipeline"}
                                </button>
                              );
                            })()}
                            <button onClick={() => setIndeedQueueActions(prev => ({ ...prev, [r.id]: prev[r.id] === "contacted" ? undefined : "contacted" }))}
                              style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", background: indeedQueueActions[r.id] === "contacted" ? t.accent + "22" : t.bgHover, color: indeedQueueActions[r.id] === "contacted" ? t.accent : t.textMuted }}>
                              {indeedQueueActions[r.id] === "contacted" ? "✓ Contacted" : "Mark Contacted"}
                            </button>
                            <button onClick={() => setIndeedQueueActions(prev => ({ ...prev, [r.id]: prev[r.id] === "replied" ? undefined : "replied" }))}
                              style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", background: indeedQueueActions[r.id] === "replied" ? t.green + "22" : t.bgHover, color: indeedQueueActions[r.id] === "replied" ? t.green : t.textMuted }}>
                              {indeedQueueActions[r.id] === "replied" ? "✓ Got Reply" : "Mark Replied"}
                            </button>
                            <button onClick={() => setIndeedQueueActions(prev => ({ ...prev, [r.id]: "skip" }))}
                              style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", color: t.textFaint }}>
                              Skip
                            </button>
                          </div>

                          {indeedEmailDrafts[r.id] && (
                            <div style={{ marginTop: 12, padding: 16, background: t.bgAlt, borderRadius: 8, border: `1px solid ${t.borderLight}` }}>
                              <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>📧 Outreach Draft</div>
                              <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{indeedEmailDrafts[r.id]}</div>
                              <button onClick={() => { navigator.clipboard.writeText(indeedEmailDrafts[r.id]); showToast("Copied to clipboard"); }}
                                style={{ ...btnPrimary, fontSize: 12, padding: "6px 16px" }}>
                                Copy to Clipboard
                              </button>
                            </div>
                          )}

                          {/* ── OUTREACH OPTIONS ── */}
                          <div style={{ marginTop: 16, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                            <button
                              onClick={() => setIndeedOutreachOpen(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: `1px solid ${t.borderLight}`, borderRadius: 8, padding: "8px 16px", color: t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                              <span style={{ flex: 1, textAlign: "left" }}>📬 Outreach Options</span>
                              <span style={{ fontSize: 11 }}>{indeedOutreachOpen[r.id] ? "▲ Collapse" : "▼ Expand"}</span>
                            </button>

                            {indeedOutreachOpen[r.id] && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 }}>

                                {/* Option 1 — Apply Direct */}
                                <div style={{ background: t.bgAlt, border: `1px solid ${t.borderLight}`, borderLeft: "3px solid #34d399", borderRadius: 10, padding: 16 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>🔗 Apply Direct</div>
                                    <span style={{ fontSize: 10, padding: "2px 8px", background: "#34d39922", color: "#34d399", borderRadius: 12, fontWeight: 700 }}>Fastest</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: t.textDim, marginBottom: 12, lineHeight: 1.5 }}>Apply through the job posting with a pitch instead of a resume.</p>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                                    {r.jobUrl ? (
                                      <a href={r.jobUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", textDecoration: "none", display: "inline-block" }}>
                                        Open Listing ↗
                                      </a>
                                    ) : (
                                      <span style={{ fontSize: 12, color: t.textFaint, fontStyle: "italic" }}>No direct link found</span>
                                    )}
                                    <button onClick={() => handleIndeedGenerateApplyPitch(r)} disabled={generatingApplyPitch === r.id}
                                      style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px", background: "#34d399", opacity: generatingApplyPitch === r.id ? 0.6 : 1 }}>
                                      {generatingApplyPitch === r.id ? "Generating..." : indeedApplyPitch[r.id] ? "Re-generate" : "Generate Pitch"}
                                    </button>
                                  </div>
                                  {indeedApplyPitch[r.id] && (
                                    <div style={{ marginTop: 8 }}>
                                      <textarea readOnly value={indeedApplyPitch[r.id]}
                                        style={{ width: "100%", minHeight: 100, padding: 10, background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 6, color: t.text, fontSize: 12, lineHeight: 1.5, resize: "vertical", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
                                      <button onClick={() => { navigator.clipboard.writeText(indeedApplyPitch[r.id]); showToast("Copied!"); }}
                                        style={{ ...btnSecondary, fontSize: 11, padding: "5px 12px", marginTop: 6 }}>Copy</button>
                                    </div>
                                  )}
                                </div>

                                {/* Option 2 — Find Contact */}
                                <div style={{ background: t.bgAlt, border: `1px solid ${t.borderLight}`, borderLeft: "3px solid #60a5fa", borderRadius: 10, padding: 16 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>🔍 Find Contact Info</div>
                                    <span style={{ fontSize: 10, padding: "2px 8px", background: "#60a5fa22", color: "#60a5fa", borderRadius: 12, fontWeight: 700 }}>Highest Response Rate</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: t.textDim, marginBottom: 12, lineHeight: 1.5 }}>Search for this company's email and decision-maker.</p>
                                  {!indeedContactInfo[r.id] && (
                                    <button onClick={() => handleIndeedFindContact(r)} disabled={searchingContact === r.id}
                                      style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px", background: "#60a5fa", color: "#0c0a09", opacity: searchingContact === r.id ? 0.6 : 1 }}>
                                      {searchingContact === r.id ? "Searching..." : "Search for Contact"}
                                    </button>
                                  )}
                                  {indeedContactInfo[r.id] === "not_found" && (
                                    <div style={{ fontSize: 12, color: t.textDim, padding: "8px 0" }}>Could not find contact info — try Apply Direct or LinkedIn instead.</div>
                                  )}
                                  {indeedContactInfo[r.id] && indeedContactInfo[r.id] !== "not_found" && (() => {
                                    const c = indeedContactInfo[r.id];
                                    return (
                                      <div style={{ fontSize: 13 }}>
                                        {c.name && <div style={{ marginBottom: 3 }}>👤 <strong>{c.name}</strong>{c.title ? ` — ${c.title}` : ""}</div>}
                                        {c.email && <div style={{ marginBottom: 3 }}>✉ {c.email}</div>}
                                        {c.phone && <div style={{ marginBottom: 3 }}>☎ {c.phone}</div>}
                                        {c.website && <div style={{ marginBottom: 3 }}>🌐 {c.website}</div>}
                                        {c.notes && <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{c.notes}</div>}
                                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                          <button onClick={() => handleIndeedGenerateContactEmail(r)} disabled={generatingContactDraft === r.id}
                                            style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px", background: "#60a5fa", color: "#0c0a09", opacity: generatingContactDraft === r.id ? 0.6 : 1 }}>
                                            {generatingContactDraft === r.id ? "Drafting..." : indeedContactDraft[r.id] ? "Re-draft Email" : "Draft Email"}
                                          </button>
                                          <button onClick={() => handleIndeedFindContact(r)} disabled={searchingContact === r.id}
                                            style={{ ...btnSecondary, fontSize: 11, padding: "5px 10px" }}>
                                            Re-search
                                          </button>
                                        </div>
                                        {indeedContactDraft[r.id] && (
                                          <div style={{ marginTop: 10 }}>
                                            <textarea readOnly value={indeedContactDraft[r.id]}
                                              style={{ width: "100%", minHeight: 120, padding: 10, background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 6, color: t.text, fontSize: 12, lineHeight: 1.5, resize: "vertical", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
                                            <button onClick={() => { navigator.clipboard.writeText(indeedContactDraft[r.id]); showToast("Copied!"); }}
                                              style={{ ...btnSecondary, fontSize: 11, padding: "5px 12px", marginTop: 6 }}>Copy</button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Option 3 — LinkedIn */}
                                <div style={{ background: t.bgAlt, border: `1px solid ${t.borderLight}`, borderLeft: "3px solid #a78bfa", borderRadius: 10, padding: 16 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>💼 LinkedIn Outreach</div>
                                    <span style={{ fontSize: 10, padding: "2px 8px", background: "#a78bfa22", color: "#a78bfa", borderRadius: 12, fontWeight: 700 }}>Most Personal</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: t.textDim, marginBottom: 12, lineHeight: 1.5 }}>Find the hiring manager on LinkedIn and send a personal message.</p>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                                    <a href={`https://www.google.com/search?q=site:linkedin.com/company+"${encodeURIComponent(r.companyName)}"`}
                                      target="_blank" rel="noopener noreferrer"
                                      style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", textDecoration: "none", display: "inline-block" }}>
                                      Search LinkedIn ↗
                                    </a>
                                    <button onClick={() => handleIndeedGenerateLinkedInMsg(r)} disabled={generatingLinkedInMsg === r.id}
                                      style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px", background: "#a78bfa", color: "#0c0a09", opacity: generatingLinkedInMsg === r.id ? 0.6 : 1 }}>
                                      {generatingLinkedInMsg === r.id ? "Generating..." : indeedLinkedInMsg[r.id] ? "Re-generate" : "Generate Messages"}
                                    </button>
                                  </div>
                                  {indeedLinkedInMsg[r.id] && (() => {
                                    const msg = indeedLinkedInMsg[r.id];
                                    const noteLen = (msg.connectionNote || "").length;
                                    return (
                                      <div style={{ fontSize: 12 }}>
                                        <div style={{ marginBottom: 8 }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                            <span style={{ fontSize: 11, color: t.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Connection Note</span>
                                            <span style={{ fontSize: 11, color: noteLen > 300 ? "#f87171" : t.textDim }}>{noteLen}/300</span>
                                          </div>
                                          <textarea readOnly value={msg.connectionNote || ""}
                                            style={{ width: "100%", minHeight: 80, padding: 8, background: t.bgHover, border: `1px solid ${noteLen > 300 ? "#f87171" : t.borderLight}`, borderRadius: 6, color: t.text, fontSize: 12, lineHeight: 1.5, resize: "vertical", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
                                          <button onClick={() => { navigator.clipboard.writeText(msg.connectionNote || ""); showToast("Copied!"); }}
                                            style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px", marginTop: 4 }}>Copy Note</button>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 11, color: t.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Follow-up DM</div>
                                          <textarea readOnly value={msg.followUpDm || ""}
                                            style={{ width: "100%", minHeight: 90, padding: 8, background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 6, color: t.text, fontSize: 12, lineHeight: 1.5, resize: "vertical", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
                                          <button onClick={() => { navigator.clipboard.writeText(msg.followUpDm || ""); showToast("Copied!"); }}
                                            style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px", marginTop: 4 }}>Copy DM</button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ SETTINGS ════════════ */}
          {tab === "settings" && (
            <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 700 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Qualification Criteria</h2>
                  <p style={{ fontSize: 13, color: t.textDim, marginTop: 4 }}>Define rules to score incoming leads</p>
                </div>
                {settingsEdited && leads.length > 0 && (
                  <button onClick={requalifyAll} style={{ ...btnPrimary, animation: "pulse 1.5s infinite" }}>↻ Re-Qualify All ({leads.length})</button>
                )}
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: t.text }}><span style={{ color: t.accent }}>$</span> Budget Range</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Minimum</label><input style={inputStyle} type="number" value={criteria.minBudget} onChange={e => { setCriteria(p => ({ ...p, minBudget: parseInt(e.target.value) || 0 })); setSettingsEdited(true); }} /></div>
                  <div><label style={labelStyle}>Maximum</label><input style={inputStyle} type="number" value={criteria.maxBudget} onChange={e => { setCriteria(p => ({ ...p, maxBudget: parseInt(e.target.value) || 0 })); setSettingsEdited(true); }} /></div>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: t.text }}><span style={{ color: t.accent }}>◆</span> Accepted {ind.typeName}s</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PROJECT_TYPES.map(pt => {
                    const active = criteria.acceptedProjectTypes.includes(pt.id);
                    return (<button key={pt.id} onClick={() => { setCriteria(p => ({ ...p, acceptedProjectTypes: active ? p.acceptedProjectTypes.filter(x => x !== pt.id) : [...p.acceptedProjectTypes, pt.id] })); setSettingsEdited(true); }} style={{ padding: "8px 16px", background: active ? t.accent : t.bgHover, border: `1px solid ${active ? t.accent : t.borderInput}`, borderRadius: 20, color: active ? "#0c0a09" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>{pt.icon} {pt.label}</button>);
                  })}
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: t.text }}><span style={{ color: t.accent }}>◎</span> Service Area</h3>
                <p style={{ fontSize: 12, color: t.textFaint, marginBottom: 12 }}>ZIP code prefixes, comma-separated. Leave empty to skip.</p>
                <input style={inputStyle} value={criteria.serviceAreaZips} onChange={e => { setCriteria(p => ({ ...p, serviceAreaZips: e.target.value })); setSettingsEdited(true); }} placeholder="e.g. 902, 900, 100" />
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: t.text }}><span style={{ color: t.accent }}>⏱</span> Timeline Range (months)</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Min Months</label><input style={inputStyle} type="number" value={criteria.minTimelineMonths} onChange={e => { setCriteria(p => ({ ...p, minTimelineMonths: parseInt(e.target.value) || 0 })); setSettingsEdited(true); }} /></div>
                  <div><label style={labelStyle}>Max Months</label><input style={inputStyle} type="number" value={criteria.maxTimelineMonths} onChange={e => { setCriteria(p => ({ ...p, maxTimelineMonths: parseInt(e.target.value) || 0 })); setSettingsEdited(true); }} /></div>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: t.text }}><span style={{ color: t.accent }}>⚙</span> App Settings</h3>
                <div style={{ marginBottom: 16 }}><label style={labelStyle}>Company Name</label><input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" /></div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Industry</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={industry} onChange={e => {
                    const newInd = e.target.value;
                    setIndustry(newInd);
                    const newCriteria = getDefaultCriteria(newInd);
                    setCriteria(prev => ({ ...prev, acceptedProjectTypes: newCriteria.acceptedProjectTypes, minBudget: newCriteria.minBudget, maxBudget: newCriteria.maxBudget }));
                    setProspects([]);
                    setSettingsEdited(true);
                  }}>
                    {INDUSTRY_LIST.map(i => <option key={i.id} value={i.id}>{i.icon} {i.label}</option>)}
                  </select>
                  <p style={{ fontSize: 11, color: t.textFaint, marginTop: 6 }}>Changing industry updates the {ind.typeName.toLowerCase()} options and finder search terms. Existing leads are preserved.</p>
                </div>
                <button onClick={handleResetApp} style={{ ...btnSecondary, color: t.red, borderColor: t.redBorder, background: "transparent", fontSize: 12 }}>↺ Reset Everything</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
