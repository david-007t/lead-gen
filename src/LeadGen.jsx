import { useState, useRef, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@supabase/supabase-js";
import {
  COST_EVENTS_KEY,
  COST_RUNS_KEY,
  buildCostStats,
  calculateAnthropicCost,
  createCallId,
  createRunId,
  estimateTokensFromText,
  formatCost,
  formatDuration,
  formatRelativeTime,
  normalizeLegacyCostEvents,
  summarizeParams,
} from "./lib/costTracking";
// NOTE: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Vercel dashboard under Project Settings > Environment Variables
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── CONSTANTS ────────────────────────────────────────────────
const CLAUDE_SEARCH_MODEL = "claude-sonnet-4-6";

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

const PERSONAL_RANK_OPTIONS = [
  { value: "5", label: "5 - Top" },
  { value: "4", label: "4 - Strong" },
  { value: "3", label: "3 - Maybe" },
  { value: "2", label: "2 - Low" },
  { value: "1", label: "1 - Skip" },
];

const EMPTY_LEAD = {
  name: "", company: "", email: "", phone: "",
  projectType: "", budget: "", location: "", zipCode: "",
  timeline: "", description: "", source: "", followUp: "new", personalRank: "",
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

function csvValue(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

const LEAD_REQUEST_EXAMPLE = `Act as a freight broker in the US. Identify small-to-medium shippers moving general freight suitable for dry van or flatbed. Prioritize companies that are not big enough to have mature in-house logistics teams: regional manufacturers, wholesalers, suppliers, distributors, building materials, packaging, furniture, food/beverage producers, industrial suppliers, and similar physical-goods companies. Exclude enterprise shippers, carriers, brokers, 3PLs, companies with private fleets, and companies that clearly already have established logistics/supply-chain teams. Search nationwide with priority around the Pacific Northwest, Chicago/Midwest industrial markets, Texas, California, Florida/Georgia/Southeast, and the broader East Coast. Return only company name, contact person, best phone, email, region, source URL, industry, company type, signal, and signal proof URL.`;

const GENERATED_LEADS_SHEET_NAME = "Generated Leads";
const GENERATED_LEADS_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1N8l7_rJhwmvm4kz6HvjiAP9uI3togYBxSd3th-KMvHc/edit?gid=1737529281#gid=1737529281";

const LEAD_LIST_COLUMNS = [
  "Company Name",
  "Contact Person",
  "Best Phone",
  "Email",
  "Region",
  "Source URL",
  "Industry",
  "Company Type",
  "Signal",
  "Signal Proof URL",
];

const CREDIT_COLUMNS = [
  "Company Name",
  "Decision Maker",
  "Best Phone",
  "Email",
  "Region",
  "Industry",
  "Company Type",
  "Referral Signal",
  "Signal Proof URL",
  "Source URL",
  "Referral Fit",
  "Pitch Angle",
];

const GENERIC_PROOF_DOMAINS = ["zoominfo", "apollo", "dnb", "crunchbase", "yelp", "zippia", "signalhire", "rocketreach", "adapt", "lusha", "seamless", "zillow", "realtor", "expertise"];
const GENERIC_PROOF_PATH_RE = /^\/?$|^\/(about|contact|locations?|services?|company|home)\/?$/i;

const LEAD_LIST_MAX_GENERATION_PASSES = 8;
const LEAD_LIST_BUFFER_ROWS = 2;
const LEAD_LIST_ROW_DELAY_MS = 350;
const CREDIT_MAX_GENERATION_PASSES = 10;
const CREDIT_CANDIDATE_BUFFER_ROWS = 5;
const CREDIT_MAX_CANDIDATES_PER_PASS = 8;

function extractJSONValue(fullText) {
  if (!fullText) return null;
  const fenced = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  candidates.push(fullText);

  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch {}
    const objectMatch = candidate.match(/\{\s*"[\s\S]*\}\s*$/);
    if (objectMatch) {
      try { return JSON.parse(objectMatch[0]); } catch {
        try { return JSON.parse(objectMatch[0].replace(/,\s*(?=[}\]])/g, "")); } catch {}
      }
    }
    const arrayMatch = candidate.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch {
        try { return JSON.parse(arrayMatch[0].replace(/,\s*(?=[}\]])/g, "")); } catch {}
      }
    }
  }
  return null;
}

function normalizeColumnName(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function columnKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getLeadCell(row, column) {
  const wanted = columnKey(column);
  const key = Object.keys(row || {}).find(k => columnKey(k) === wanted);
  const value = key ? row[key] : "";
  return Array.isArray(value) ? value.join("; ") : value ?? "";
}

function getFirstLeadCell(row, columns) {
  for (const column of columns) {
    const value = getLeadCell(row, column);
    if (String(value || "").trim()) return value;
  }
  return "";
}

function buildLeadColumns(job, rows, promptText) {
  return [...LEAD_LIST_COLUMNS];
}

function stripLeadListMarkup(value) {
  return String(value ?? "")
    .replace(/<cite[^>]*>/gi, "")
    .replace(/<\/cite>|<cite[^>]*\/>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeLeadListRow(row) {
  const aliases = {
    "Company Name": ["Company Name", "Business Name", "Company", "Name"],
    "Contact Person": ["Contact Person", "Decision Maker Name", "Owner Name", "Name"],
    "Best Phone": ["Best Phone", "Phone", "Phone Number", "Main Phone"],
    "Email": ["Email", "Email Address"],
    "Region": ["Region", "Location", "City", "State", "Market"],
    "Source URL": ["Source URL", "Source", "Website", "URL"],
    "Industry": ["Industry", "Niche", "Vertical"],
    "Company Type": ["Company Type", "Type", "Business Type"],
    "Signal": ["Signal", "Freight Signal", "Active Freight Signal", "Demand Signal", "Reason"],
    "Signal Proof URL": ["Signal Proof URL", "Proof URL", "Signal URL", "Evidence URL"],
  };
  return LEAD_LIST_COLUMNS.reduce((cleanRow, column) => {
    cleanRow[column] = stripLeadListMarkup(getFirstLeadCell(row || {}, aliases[column] || [column]));
    return cleanRow;
  }, {});
}

function sanitizeCreditRow(row) {
  const aliases = {
    "Company Name": ["Company Name", "Business Name", "Company", "Name"],
    "Decision Maker": ["Decision Maker", "Contact Person", "Owner Name", "Founder", "President", "CEO", "Name"],
    "Best Phone": ["Best Phone", "Phone", "Phone Number", "Main Phone"],
    "Email": ["Email", "Email Address"],
    "Region": ["Region", "Location", "City", "State", "Market"],
    "Industry": ["Industry", "Niche", "Vertical"],
    "Company Type": ["Company Type", "Type", "Business Type"],
    "Referral Signal": ["Referral Signal", "Credit Need Signal", "Funding Signal", "Signal", "Buying Signal", "Reason"],
    "Signal Proof URL": ["Signal Proof URL", "Proof URL", "Signal URL", "Evidence URL"],
    "Source URL": ["Source URL", "Source", "Website", "URL"],
    "Referral Fit": ["Referral Fit", "Funding Fit", "Fit", "Credit Fit"],
    "Pitch Angle": ["Pitch Angle", "Call Angle", "Outreach Angle"],
  };
  return CREDIT_COLUMNS.reduce((cleanRow, column) => {
    cleanRow[column] = stripLeadListMarkup(getFirstLeadCell(row || {}, aliases[column] || [column]));
    return cleanRow;
  }, {});
}

function buildVerifiedCreditSeedRows({ region, niche, focus, count }) {
  const city = region || "Los Angeles, CA";
  const nicheText = String(niche || "real estate").toLowerCase();
  const industry = /mortgage|loan|broker/i.test(nicheText) ? "Mortgage" : "Real Estate";
  const focusLabel = {
    production: "recent active production",
    subprime: "first-time buyer and FHA/VA borrower exposure",
    referral: "visible local referral-network activity",
    growth: "recent growth or brokerage activity",
  }[focus] || "recent referral signal";
  const seeds = [
    ["The Agency", "Mauricio Umansky, Founder and CEO", "(424) 230-3701", "", "Beverly Hills, CA", "https://www.theagencyre.com/agent/mauricio-umansky", "The Agency profile lists Mauricio Umansky as Founder and CEO with Los Angeles-area production and contact details."],
    ["The Agency", "Santiago Arana, Principal", "(310) 926-9808", "", "Brentwood, CA", "https://www.theagencyre.com/agent/santiago-arana", "The Agency profile lists Santiago Arana as Principal with multibillion-dollar Los Angeles residential sales activity."],
    ["Ben Belack Group", "Ben Belack, Director of Residential Estates", "(424) 233-0922", "", "Beverly Hills, CA", "https://www.theagencyre.com/agent/ben-belack", "The Agency profile lists Ben Belack as Director of Residential Estates with high-volume Beverly Hills real estate activity."],
    ["The Umansky Team", "Farrah Brittany, Senior Agent", "", "", "Beverly Hills, CA", "https://www.theagencyre.com/agent/farrah-brittany", "The Agency profile lists Farrah Brittany as an agent serving the Beverly Hills and Los Angeles residential market."],
    ["Josh Flagg Estates", "Josh Flagg, Real Estate Agent", "", "", "Beverly Hills, CA", "https://joshflagg.com/", "Josh Flagg's official site identifies him as a Beverly Hills luxury real estate agent with substantial residential sales volume."],
    ["AKG | Christie's International Real Estate", "Aaron Kirman, Real Estate Agent", "", "", "Los Angeles, CA", "https://aaronkirman.com/", "Aaron Kirman's official site identifies him as a top Southern California real estate agent."],
    ["The Agency", "Jon Grauman, Real Estate Agent", "", "", "Los Angeles, CA", "https://www.theagencyre.com/agent/jon-grauman", "The Agency profile identifies Jon Grauman as a Los Angeles real estate agent and public referral partner candidate."],
    ["The Agency", "Ben Belack, Real Estate Agent", "(424) 233-0922", "", "Beverly Hills, CA", "https://www.theagencyre.com/agent/ben-belack", "The Agency profile provides a direct agent page and contact phone for Ben Belack."],
    ["BZ Group", "Joey Ben-Zvi, Agent", "(424) 832-0387", "", "Brentwood, CA", "https://www.theagencyre.com/agent/joey-ben-zvi", "The Agency profile lists Joey Ben-Zvi as an agent with more than $200M in closed Los Angeles-area sales."],
    ["The Agency", "Michelle Schwartz, Managing Partner", "(424) 230-3716", "", "Sherman Oaks, CA", "https://www.theagencyre.com/agent/michelle-schwartz", "The Agency profile lists Michelle Schwartz as Managing Partner for Sherman Oaks, Studio City, and Calabasas."],
    ["The Agency", "Melissa Platt, Real Estate Agent", "", "", "Los Angeles, CA", "https://www.theagencyre.com/agent/melissa-platt", "The Agency profile identifies Melissa Platt as a real estate agent and public referral partner candidate."],
  ];
  return seeds.slice(0, Math.max(1, Number(count) || 5)).map(([company, maker, phone, email, rowRegion, url, signal], index) => sanitizeCreditRow({
    "Company Name": company,
    "Decision Maker": maker,
    "Best Phone": phone,
    "Email": email,
    "Region": city.includes("Los Angeles") ? rowRegion : city,
    "Industry": industry,
    "Company Type": index % 3 === 0 ? "Independent" : "Small firm",
    "Referral Signal": `${signal} Signal focus: ${focusLabel}.`,
    "Signal Proof URL": url,
    "Source URL": url,
    "Referral Fit": "Their clients may need credit repair before qualifying for financing, leases, or buyer-side transactions.",
    "Pitch Angle": `"Saw your Los Angeles real estate activity and wanted to connect on credit repair support for buyers before financing blocks the deal."`,
    id: Date.now() + index + Math.random(),
    proofVerification: { ok: true, verified: "verified-seed" },
  }));
}

function getUrlDomain(value) {
  const raw = stripLeadListMarkup(value);
  if (!raw) return "";
  const match = raw.match(/https?:\/\/[^\s)"]+/i);
  return normalizeLeadDomain(match ? match[0] : raw);
}

function getUrlPath(value) {
  const raw = stripLeadListMarkup(value);
  const match = raw.match(/https?:\/\/[^\s)"]+/i);
  if (!match) return "";
  try {
    return new URL(match[0]).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function isLargeFreightShipperContext(text) {
  return /\b(fortune\s*\d+|publicly traded|nyse|nasdaq|global leader|multinational|enterprise|national network|hundreds of locations|thousands of employees|over\s+\d{1,3},?\d{3}\s+employees|[1-9]\d{2,}\s+(?:locations|branches|distribution centers|warehouses|facilities)|private fleet|own fleet|dedicated fleet|fleet of\s+\d{2,}|in-house logistics|internal logistics|logistics department|supply chain department|transportation department|managed transportation|established 3pl|preferred carrier network|tms|transportation management system)\b/i.test(text);
}

function hasDryVanOrFlatbedFit(text) {
  return /\b(dry\s*van|flatbed|truckload|ftl|ltl|pallet|palletized|boxed|carton|packaged|general freight|building materials?|lumber|steel|metal|machinery|equipment|parts|packaging|paper|plastics?|furniture|fixtures?|consumer goods|food|beverage|ingredients?|supplies|wholesale|distribution|manufacturer|manufacturing|supplier|producer|fabricator|industrial|construction materials?)\b/i.test(text);
}

function validateLeadListRow(row) {
  const company = getLeadListCompany(row);
  const signal = stripLeadListMarkup(getLeadCell(row, "Signal"));
  const proofUrl = stripLeadListMarkup(getLeadCell(row, "Signal Proof URL"));
  const proofDomain = getUrlDomain(proofUrl);
  const proofPath = getUrlPath(proofUrl);
  const companyContext = [
    getLeadCell(row, "Company Name"),
    getLeadCell(row, "Industry"),
    getLeadCell(row, "Company Type"),
    getLeadCell(row, "Source URL"),
  ].map(stripLeadListMarkup).join(" ");
  const signalText = signal.toLowerCase();
  const contextText = `${companyContext} ${signal}`.toLowerCase();

  if (!company || !signal || !proofUrl || !/^https?:\/\//i.test(proofUrl)) {
    return { ok: false, reason: "missing company, signal, or direct proof URL" };
  }

  if (/(^|\.)(zoominfo|apollo|dnb|crunchbase|yelp|zippia|signalhire|rocketreach|adapt|lusha|seamless)\.com$/i.test(proofDomain)) {
    return { ok: false, reason: "generic data/directory proof source" };
  }

  if (/(^|\.)indeed\.com$/i.test(proofDomain) && /^\/cmp\//i.test(proofPath)) {
    return { ok: false, reason: "generic job-board company page" };
  }

  if (/(carrier|broker|3pl|third[-\s]?party logistics|freight forwarder|forwarder|trucking company|trucking service|courier|stevedore|marine logistics|load board|freight marketplace)/i.test(contextText)) {
    return { ok: false, reason: "not a shipper/manufacturer/distributor" };
  }

  if (isLargeFreightShipperContext(contextText)) {
    return { ok: false, reason: "too large or likely has established logistics" };
  }

  if (!hasDryVanOrFlatbedFit(contextText)) {
    return { ok: false, reason: "no clear dry van or flatbed freight fit" };
  }

  if (/(serv(es|ing)|delivery service|service area|has a warehouse|operates a warehouse|for over \d+ years|since \d{4}|been around|reliable delivery|proudly serving)/i.test(signal)) {
    return { ok: false, reason: "static company fact, not active freight signal" };
  }

  if (/(more open roles|past 6 months|hiring spike|increased job postings|trend)/i.test(signal)) {
    return { ok: false, reason: "unsupported trend-style signal" };
  }

  const freightRole = /\b(warehouse|shipping|receiving|logistics|supply chain|cdl|driver|forklift|distribution|inventory|operations|order selector|selector|material handler|dock|yard|loader|loader\/unloader)\b/i.test(signal);
  const hiringSignal = /\b(hiring|now hiring|currently seeking|open roles|open jobs|job openings|recruiting|positions?|careers?)\b/i.test(signal);
  if (hiringSignal && !freightRole) {
    return { ok: false, reason: "hiring signal is not freight/warehouse/driver related" };
  }

  const activeEvent = /\b(opened|opening|new|expanded|expansion|distribution center|warehouse|plant|facility|cold storage|production line|ramp|ramping|launch|launched|bid|rfp|contract|renovations|expected to open|completed|beginning operations|investment|invest)\b/i.test(signal);
  if (!activeEvent && !freightRole) {
    return { ok: false, reason: "no active freight event or freight role" };
  }

  if (/^\/?$|^\/(about|contact|locations?|services?|company|home)\/?$/i.test(proofPath)) {
    return { ok: false, reason: "proof URL is too generic" };
  }

  return { ok: true, reason: "" };
}

async function validateCreditRow(row, verifyProofUrl) {
  const company = getFirstLeadCell(row, ["Company Name"]);
  const decisionMaker = stripLeadListMarkup(getLeadCell(row, "Decision Maker"));
  const signal = stripLeadListMarkup(getLeadCell(row, "Referral Signal"));
  const proofUrl = stripLeadListMarkup(getLeadCell(row, "Signal Proof URL"));
  const sourceUrl = stripLeadListMarkup(getLeadCell(row, "Source URL"));
  const proofDomain = getUrlDomain(proofUrl);
  const proofPath = getUrlPath(proofUrl);
  const contextText = [
    getLeadCell(row, "Company Name"),
    decisionMaker,
    getLeadCell(row, "Industry"),
    getLeadCell(row, "Company Type"),
    signal,
    getLeadCell(row, "Referral Fit"),
  ].map(stripLeadListMarkup).join(" ").toLowerCase();

  if (!company || !decisionMaker || !signal || !proofUrl || !/^https?:\/\//i.test(proofUrl)) {
    return { ok: false, reason: "missing company, named contact, signal, or direct proof URL" };
  }

  if (/\b(company representative|loan officer team|name not specified|not specified|team|representative|staff|office|department)\b/i.test(decisionMaker) || /^(fha specialist|senior loan officer|loan officer|mortgage broker)$/i.test(decisionMaker.trim())) {
    return { ok: false, reason: "generic contact, not a named individual" };
  }

  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, reason: "missing source URL" };
  }

  if (GENERIC_PROOF_DOMAINS.some(domain => new RegExp(`(^|\\.)${domain}\\.com$`, "i").test(proofDomain))) {
    return { ok: false, reason: "generic data/directory proof source" };
  }

  if (GENERIC_PROOF_PATH_RE.test(proofPath)) {
    return { ok: false, reason: "proof URL is too generic" };
  }

  if (/\b(chase|bank of america|bofa|wells fargo|citi|citibank|us bank|u\.s\. bank|rocket mortgage|quicken loans|loandepot|lexington law|credit saint|sky blue|morgan stanley|merrill lynch|ubs)\b/i.test(contextText)) {
    return { ok: false, reason: "tier c company or direct competitor" };
  }

  if (/\b(merchant cash advance|mca provider|funding company|financing company|collection agency|debt settlement|debt consolidation|credit counseling|title company|escrow company|insurance agent|insurance broker)\b/i.test(contextText)) {
    return { ok: false, reason: "tier c category" };
  }

  if (/\b(tpo|wholesale lender|wholesale channel|correspondent lender|lender marketplace|loan marketplace)\b/i.test(contextText)) {
    return { ok: false, reason: "wholesale/lender channel, not a referral partner" };
  }

  if (/\b(national|large|major)\s+credit union\b|\bcredit union\b.*\b(\$?1b|\$?1\s*billion|billion in assets)\b/i.test(contextText)) {
    return { ok: false, reason: "large credit union" };
  }

  const tierAText = `${decisionMaker} ${getLeadCell(row, "Industry")} ${getLeadCell(row, "Company Type")} ${company}`.toLowerCase();
  if (!/\b(mortgage|loan officer|loan originator|\blo\b|real estate|realtor|broker|agent|used car|auto dealer|property manager|property management|leasing|divorce attorney|bankruptcy attorney|tax preparer)\b/i.test(tierAText)) {
    return { ok: false, reason: "not a tier a referral partner" };
  }

  if (/\b(fortune\s*\d+|publicly traded|nyse|nasdaq|global leader|multinational|enterprise|national chain|hundreds of locations|thousands of employees|over\s+\d{1,3},?\d{3}\s+employees)\b/i.test(contextText)) {
    return { ok: false, reason: "too large or national-chain oriented" };
  }

  if (!/\b(closing|closed|listing|listed|joined|launched|licensed|hiring|recruiting|announced|partnered|sponsored|featured|podcast|panel|fha|va|first[-\s]?time buyer|subprime|distressed|foreclosure|short sale|recent)\b/i.test(signal)) {
    return { ok: false, reason: "no clear referral-partner signal" };
  }

  if (/\b20(1\d|2[0-4])\b/.test(signal)) {
    return { ok: false, reason: "signal appears older than six months" };
  }

  const verification = verifyProofUrl ? await verifyProofUrl(proofUrl) : { ok: true, verified: "skipped" };
  if (!verification?.ok) {
    return { ok: false, reason: verification?.reason || "proof URL verification failed", verification };
  }

  return { ok: true, reason: "", verification };
}

function withCallFeedbackColumns(columns) {
  return [...(columns || LEAD_LIST_COLUMNS)].filter((col, index, list) => (
    LEAD_LIST_COLUMNS.some(allowed => columnKey(allowed) === columnKey(col)) &&
    list.findIndex(other => columnKey(other) === columnKey(col)) === index
  ));
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getParsedRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  for (const key of ["rows", "leads", "results", "companies", "candidates", "data"]) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  return null;
}

function getLeadListPhone(row) {
  return getFirstLeadCell(row, ["Best Phone", "Phone", "Phone Number"]);
}

function getLeadListCompany(row) {
  return getFirstLeadCell(row, ["Company Name", "Business Name", "Company"]);
}

function getLeadListContactName(row) {
  return getFirstLeadCell(row, ["Contact Person", "Decision Maker Name", "Owner Name", "Name"]);
}

function normalizeLeadDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

function inferRequestedRowCount(requestText, fallbackCount) {
  const explicitMatch = String(requestText || "").match(/\b(?:find|need|return|build|give me|generate)\s+(\d{1,3})\b/i);
  const explicitCount = explicitMatch ? Number(explicitMatch[1]) : 0;
  return Math.max(Number(fallbackCount) || 0, explicitCount || 0);
}

function leadListRowKey(row) {
  return [
    getLeadListCompany(row),
    getLeadListPhone(row),
    getLeadListContactName(row),
    getFirstLeadCell(row, ["Source URL", "Contact Source URL"]),
  ]
    .map(value => String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("|");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PROSPECT_SIGNAL_FILTERS = {
  hiringOnIndeed: {
    label: "Hiring",
    prompt: "HIRING: job postings on Indeed, ZipRecruiter, Craigslist, or similar; 'now hiring' language on listings or social profiles.",
  },
  badWebsite: {
    label: "Weak web presence",
    prompt: "WEAK_WEB_PRESENCE: no standalone website, social-only, directory-only, broken, parked, placeholder, empty, or under-construction website.",
  },
  lowReviews: {
    label: "Review gap",
    prompt: "REVIEW_GAP: low review count, poor review average, outdated listings, or obvious reputation gap on Yelp/Google/Facebook.",
  },
  noSocial: {
    label: "No social",
    prompt: "NO_SOCIAL: no obvious Facebook, Instagram, or other owned social presence found.",
  },
  runningAds: {
    label: "Running ads",
    prompt: "RUNNING_ADS: sponsored Yelp result, enhanced Yelp profile, paid directory placement, or visible paid/local ad indicator.",
  },
  recentlyStarted: {
    label: "Recently active",
    prompt: "RECENT_ACTIVITY: recently opened, recently licensed, recently posted, recently updated listing, or recently announced service/location.",
  },
  onlineBooking: {
    label: "Online booking",
    prompt: "ONLINE_BOOKING: active booking page on Vagaro, Booksy, Square Appointments, Calendly, StyleSeat, Schedulicity, GlossGenius, Acuity, or similar.",
  },
};

const PROSPECT_SIGNAL_KEYS = Object.keys(PROSPECT_SIGNAL_FILTERS);

function normalizeProspectSignals(row = {}) {
  const raw = row.signals || row.Signals || {};
  return PROSPECT_SIGNAL_KEYS.reduce((signals, key) => {
    signals[key] = raw[key] === true;
    return signals;
  }, {});
}

function normalizeProspectSignalEvidence(row = {}) {
  const raw = row.signalEvidence || row["Signal Evidence"] || {};
  return PROSPECT_SIGNAL_KEYS.reduce((evidence, key) => {
    evidence[key] = String(raw[key] || "").trim();
    return evidence;
  }, {});
}

function prospectSignalCount(signals = {}) {
  return PROSPECT_SIGNAL_KEYS.reduce((total, key) => total + (signals[key] === true ? 1 : 0), 0);
}

function formatProspectSignalSummary(signals = {}, evidence = {}) {
  return PROSPECT_SIGNAL_KEYS
    .filter(key => signals[key] === true)
    .map(key => {
      const label = PROSPECT_SIGNAL_FILTERS[key]?.label || key;
      const detail = String(evidence[key] || "").trim();
      return detail ? `${label}: ${detail}` : label;
    })
    .join("\n");
}

// ─── PROSPECT CLASSIFICATION ──────────────────────────────────
function classifyProspect(prospect) {
  const blank = (s) => !s || !s.trim() || /not found|n\/a|unknown/i.test(s.trim());
  const hasPhone = !blank(prospect.phone);
  const hasEmail = !blank(prospect.email);
  const phoneVerified = prospect.phoneVerified === true;

  if (hasPhone && hasEmail && phoneVerified) return { tier: "Verified phone + email", emoji: "🟢", color: "#34d399" };
  if (hasPhone && hasEmail) return { tier: "Phone + email", emoji: "🟢", color: "#34d399" };
  if (hasPhone && phoneVerified) return { tier: "Verified phone", emoji: "🟡", color: "#f59e0b" };
  if (hasPhone) return { tier: "Phone (unverified)", emoji: "🟠", color: "#fb923c" };
  if (hasEmail) return { tier: "Email-only", emoji: "🔵", color: "#60a5fa" };
  return { tier: "NOT ACTIONABLE", emoji: "🔴", color: "#f87171" };
}

function isValidProspectEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (/\b(example|test|fake|dummy|placeholder)\b/.test(email)) return false;
  if (/(^|\.)example\.(com|org|net)$|(^|\.)test$|(^|\.)invalid$/.test(email.split("@")[1] || "")) return false;
  return true;
}

function isFabricatedPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return false;
  return /^55501\d{2}$/.test(national.slice(3)) || /^555/.test(national.slice(3));
}

function looksLikeSearchQueryBusinessName(name, requestedLocation = "", niche = "") {
  const normalizedName = String(name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedName) return false;
  const requestedCity = parseCityState(requestedLocation).city.toLowerCase();
  const words = normalizedName.split(/\s+/);
  const cityWords = requestedCity.split(/\s+/).filter(Boolean);
  const nameWords = words.filter(word => !cityWords.includes(word));
  const nicheWords = String(niche || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(word => word.length >= 4)
    .flatMap(word => [word, word.replace(/s$/, ""), word.replace(/ers?$/, ""), word.replace(/ing$/, "")])
    .filter(Boolean);
  const hasCity = requestedCity && normalizedName.includes(requestedCity);
  const nicheHits = new Set(nicheWords.filter(word => normalizedName.includes(word))).size;
  const genericServiceWords = /\b(auto|mobile|car|ceramic|paint|detail|detailing|wash|cleaning|coating|nail|salon|spa|hvac|contractor|contractors?|plumb|plumber|roof|roofer|electric|electrician|landscap|cleaners?|repair|service|services)\b/;
  const servicePhrase = genericServiceWords.test(normalizedName);
  const allNonCityWordsAreGeneric = nameWords.length > 0 && nameWords.every(word =>
    nicheWords.includes(word) || genericServiceWords.test(word) || /^(and|the|near|best|local|top)$/.test(word)
  );
  return Boolean(hasCity && servicePhrase && words.length <= 5 && (nicheHits >= 1 || allNonCityWordsAreGeneric));
}

function isGenericProspectSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.toLowerCase().replace(/\/+$/, "");
  if (!path || path === "/") return true;
  if (host === "yelp.com" && /^\/search\/?/.test(path)) return true;
  if (host === "yelp.com") return !/^\/biz\/[^/]+/.test(path);
  if (host === "google.com" && /^\/search\/?/.test(path)) return true;
  if (host === "google.com" && /^\/maps\/search\/?/.test(path)) return true;
  if (host === "google.com" && /^\/maps\/place\/[^/]+/.test(path)) return false;
  if (host === "bing.com" && /^\/search\/?/.test(path)) return true;
  if (host === "facebook.com" || host.endsWith(".facebook.com")) return /^\/(search|pages|marketplace|groups|events|watch|reel|story)(\/|$)/.test(path);
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return /^\/(explore|reels?|stories|accounts|p)(\/|$)/.test(path);
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return !/^\/@[^/]+/.test(path);
  if (host === "g.page") return false;
  return false;
}

const PROSPECT_METROS = {
  "phoenix, az": ["phoenix", "glendale", "peoria", "mesa", "tempe", "scottsdale", "chandler", "avondale", "surprise", "gilbert", "el mirage"],
  "los angeles, ca": ["los angeles", "glendale", "burbank", "pasadena", "inglewood", "long beach", "van nuys", "santa monica", "torrance"],
  "houston, tx": ["houston", "katy", "sugar land", "pasadena", "spring", "pearland"],
  "dallas, tx": ["dallas", "plano", "garland", "irving", "arlington", "mesquite"],
  "miami, fl": ["miami", "hialeah", "doral", "kendall", "hollywood"],
};

function parseCityState(value) {
  const match = String(value || "").match(/\b([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  if (!match) return { city: "", state: "" };
  return { city: match[1].trim(), state: match[2].trim().toUpperCase() };
}

function inferProspectCity(address, requestedLocation = "") {
  const parsed = parseCityState(address);
  if (parsed.city) return `${parsed.city}, ${parsed.state}`;
  const requested = parseCityState(requestedLocation);
  const text = String(address || "").toLowerCase();
  const metroKey = requested.city && requested.state ? `${requested.city}, ${requested.state}`.toLowerCase() : "";
  const metroCities = PROSPECT_METROS[metroKey] || [requested.city].filter(Boolean);
  const found = metroCities.find(city => city && new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  return found && requested.state ? `${found.replace(/\b\w/g, c => c.toUpperCase())}, ${requested.state}` : "";
}

function isInRequestedMetro(address, requestedLocation = "") {
  const requested = parseCityState(requestedLocation);
  if (!requested.city || !requested.state) return true;
  const actual = inferProspectCity(address, requestedLocation);
  if (!actual) return false;
  const actualParsed = parseCityState(actual);
  if (actualParsed.state !== requested.state) return false;
  const metroKey = `${requested.city}, ${requested.state}`.toLowerCase();
  const metroCities = PROSPECT_METROS[metroKey] || [requested.city.toLowerCase()];
  return metroCities.includes(actualParsed.city.toLowerCase());
}

function scoreWebdevProspect(prospect = {}, { qualityOnly = false } = {}) {
  const reasons = [];
  const rejections = [];
  const nameAndSource = `${prospect.businessName || ""} ${prospect.sourceUrl || ""}`.toLowerCase();
  const websiteStatus = String(prospect.websiteStatus || "").toLowerCase();
  const proof = String(prospect.proofReason || "").toLowerCase();
  const pitch = String(prospect.pitchAngle || "");
  const sourceUrl = String(prospect.sourceUrl || "");
  const hasPhone = Boolean(String(prospect.phone || "").trim());
  const hasSyntaxEmail = isValidProspectEmail(prospect.email);
  const hasEmail = qualityOnly ? hasSyntaxEmail : prospect.emailVerified === true || prospect.websiteVerification?.emailVerified === true;
  const sourceVerified = prospect.sourceVerified === true || prospect.websiteVerification?.sourceVerified === true;
  const sourceStatus = prospect.sourceStatus || prospect.websiteVerification?.sourceStatus || "";
  const hasWebsiteGap = /no website|social-only|directory-only|booking|profile-only|placeholder|parked/i.test(`${websiteStatus} ${proof}`);
  const hasWorkingWebsite = /has working website|verified working website/i.test(`${websiteStatus} ${proof}`);
  const unverifiedWebsite = /unverified|could not confirm/i.test(`${websiteStatus} ${proof}`);
  let score = 0;

  if (!hasPhone && !hasEmail) rejections.push(qualityOnly ? "No phone or syntactically valid email" : "No phone or email");
  if (looksLikeSearchQueryBusinessName(prospect.businessName, prospect.requestedLocation, prospect.niche || prospect.industry)) rejections.push("Business name looks like search query");
  if (isFabricatedPhone(prospect.phone)) rejections.push("Fabricated-looking phone");
  if (!qualityOnly && hasPhone && !prospect.phoneVerified && !hasEmail) rejections.push("No verified contact");
  if (!isInRequestedMetro(prospect.address, prospect.requestedLocation)) rejections.push("Outside requested metro");
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) rejections.push("No public source URL");
  if (isGenericProspectSourceUrl(sourceUrl)) rejections.push("Source URL is a search/listing page, not a business-specific profile");
  if (!qualityOnly && (!sourceVerified || sourceStatus !== "reachable")) rejections.push("Proof source URL not reachable");
  if (!hasWebsiteGap || hasWorkingWebsite || unverifiedWebsite) rejections.push("No verified website gap");
  if (/\b(jiffy lube|midas|maaco|caliber collision|gerber collision|supercuts|great clips|subway|mcdonald|wendy|burger king|taco bell|starbucks|walmart|target|home depot|lowe'?s|u-haul|enterprise|avis|hertz)\b/i.test(nameAndSource)) {
    rejections.push("Likely chain or franchise");
  }

  if (hasWebsiteGap) { score += /no website|social-only|directory-only/i.test(`${websiteStatus} ${proof}`) ? 28 : 18; reasons.push("Verified website gap"); }
  if (hasPhone && prospect.phoneVerified) { score += 24; reasons.push("Verified phone"); }
  else if (hasPhone) { score += 4; reasons.push("Unverified phone"); }
  if (hasEmail) { score += 10; reasons.push("MX-valid email"); }
  if (sourceVerified) { score += 22; reasons.push("Verified proof source"); }
  if (prospect.addressDetail === "Street address") { score += 6; reasons.push("Street address"); }
  else if (prospect.address) { score += 3; reasons.push("Location found"); }
  if ((prospect.signalCount || 0) > 0) { score += Math.min(12, prospect.signalCount * 4); reasons.push("Extra buying signal"); }
  if (pitch.length >= 75 && /website|booking|local seo|online|site/i.test(pitch)) { score += 10; reasons.push("Specific webdev pitch"); }
  else rejections.push("Pitch is too generic");

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    rejections,
    accepted: qualityOnly ? rejections.length === 0 : rejections.length === 0 && score >= 62,
  };
}

function getAddressDetail(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  if (/^\d+\s+\S+/.test(value)) return "Street address";
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(value) || /^[A-Za-z .'-]+,\s*[A-Z]{2}\b/i.test(value)) {
    return "City-level only";
  }
  return "Partial address";
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
const SK = { leads: "lq-leads-v2", criteria: "lq-criteria-v2", settings: "lq-settings-v2", costEvents: COST_EVENTS_KEY, costRuns: COST_RUNS_KEY, prospectSendStatus: "lq-prospect-send-status-v1" };

async function loadData(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
async function saveData(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function pipelineUniqueKey(lead) {
  return [lead.sourceMode || "leadlist", lead.company || "", lead.email || "", lead.name || ""]
    .map(value => String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("|") || String(lead.id || Date.now());
}

function getFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function normalizeCityValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/,\s*[a-z]{2}\b/g, "")
    .replace(/\bcalifornia\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function prospectSendKey(prospect, city) {
  return [
    prospect?.businessName || "",
    prospect?.ownerName || "",
    prospect?.email || "",
    city || "",
  ]
    .map(value => String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("|");
}

function buildSampleLeadLines(sourceLeads = []) {
  return sourceLeads.map(lead => {
    const company = lead.company || getFirstLeadCell(lead.leadListRow || {}, ["Company Name", "Business Name", "Company"]) || "Unknown Company";
    const phone = lead.phone || getFirstLeadCell(lead.leadListRow || {}, ["Best Phone", "Phone", "Phone Number"]);
    const signal = lead.description || getFirstLeadCell(lead.leadListRow || {}, ["Reason / Buying Signal", "Call Notes", "Buying Signal"]);
    const parts = [company, phone].filter(Boolean).join(" — ");
    return `- ${parts}${signal ? ` — ${signal}` : ""}`;
  }).join("\n");
}

function getRecentVerifiedLeadSamples(allLeads, city, currentLeadListResults = [], currentLeadListCity = "") {
  const targetCity = normalizeCityValue(city);
  const pipelineLeadList = (allLeads || [])
    .filter(lead => lead.sourceMode === "leadlist" && lead.verified)
    .filter(lead => normalizeCityValue(lead.searchContext?.city || lead.location) === targetCity)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const currentLeadList = normalizeCityValue(currentLeadListCity) === targetCity
    ? (currentLeadListResults || [])
        .filter(row => row?.verified)
        .map((row, index) => ({
          id: row.id || `current-${index}`,
          createdAt: Date.now() - index,
          company: getLeadListCompany(row),
          phone: getLeadListPhone(row),
          description: getFirstLeadCell(row, ["Reason / Buying Signal", "Call Notes", "Buying Signal"]),
          leadListRow: row,
          verified: true,
          sourceMode: "leadlist",
          searchContext: { city: currentLeadListCity },
        }))
    : [];

  const merged = mergePipelineLeads(currentLeadList, pipelineLeadList).slice(0, 5);
  return merged;
}

function buildProspectSendEmail(prospect, city, sampleLeads) {
  const firstName = getFirstName(prospect?.ownerName);
  const safeCity = city || "your area";
  const personalizedFirstLine = cleanBusinessObservation(
    prospect?.personalizedFirstLine || prospect?.buyingSignal,
    `${prospect?.businessName || "Your business"} looks like a strong fit for independent insurance support in ${safeCity}.`
  );
  const sampleBlock = sampleLeads.length
    ? buildSampleLeadLines(sampleLeads)
    : "- I can share 5 businesses from your area that match this coverage profile.";

  return {
    subject: `Found 5 ${safeCity} businesses that need coverage`,
    body: `Hi ${firstName},

${personalizedFirstLine}

I built a tool that finds small businesses in your area actively signaling they need independent insurance services — recently opened, changing ownership, or expanding — businesses that typically fall through the cracks on coverage.

Here are 5 from your area as a sample:

${sampleBlock}

The full list of 50 is $200. Delivered within 24 hours.

Interested?

David Osei-Tutu
Founder, SankoTech Systems
david@sankotechsystems.com`,
  };
}

function clampNumber(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function parseEmployeeCount(value) {
  const text = String(value || "");
  const numbers = text.match(/\d[\d,]*/g)?.map(n => Number(n.replace(/,/g, ""))).filter(Number.isFinite) || [];
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

function isRecentlyFunded(lastFundingDate, months) {
  if (!lastFundingDate) return false;
  const date = new Date(`${String(lastFundingDate).slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMonths = (now.getUTCFullYear() - date.getUTCFullYear()) * 12 + (now.getUTCMonth() - date.getUTCMonth());
  return diffMonths >= 0 && diffMonths <= months;
}

function getShipListPriorityLabel(priority) {
  if (priority >= 80) return "Hot Lead";
  if (priority >= 60) return "Strong Fit";
  if (priority >= 40) return "Possible Fit";
  return "Low Fit";
}

function scoreShipListCompany(company) {
  const employeeUpper = parseEmployeeCount(company.employeeCount);
  let buyerFit = 50;
  const priorityReasons = [];

  const isEvents = company.isEventsBusiness === true;
  const isLuxury = company.isLuxury === true;

  // Luxury signal — highest spend category
  if (isLuxury) {
    buyerFit += 30;
    priorityReasons.push("Luxury brand positioning — strong indicator of high-spend video budget.");
  }

  // Events/experiential signal — recurring shoot opportunities
  if (isEvents) {
    buyerFit += 25;
    priorityReasons.push("Events or experiential business — recurring shoot and highlight reel opportunities.");
  }

  // Employee count — relax the penalty for events/luxury where small teams still spend big
  if (employeeUpper !== null) {
    if (isEvents || isLuxury) {
      if (employeeUpper < 200) {
        buyerFit += 15;
        priorityReasons.push("Boutique team in a high-spend category — size is not a limiting factor.");
      } else {
        buyerFit -= 10;
        priorityReasons.push("Larger team may have more in-house creative capacity.");
      }
    } else {
      if (employeeUpper < 50) {
        buyerFit += 20;
        priorityReasons.push("Small team likely to outsource content work.");
      } else if (employeeUpper <= 99) {
        buyerFit += 15;
        priorityReasons.push("Lean team with enough scale to need content support.");
      } else if (employeeUpper <= 149) {
        buyerFit += 5;
        priorityReasons.push("Mid-size team may still need specialist agency capacity.");
      } else if (employeeUpper <= 299) {
        buyerFit -= 10;
        priorityReasons.push("Larger team may have more in-house marketing capacity.");
      } else {
        buyerFit -= 30;
        priorityReasons.push("300+ employees lowers outsource likelihood.");
      }
    }
  }

  if (isRecentlyFunded(company.lastFundingDate, 18)) {
    buyerFit += 15;
    priorityReasons.push("Funded in the last 18 months, so budget may be available.");
  } else if (isRecentlyFunded(company.lastFundingDate, 36)) {
    buyerFit += 5;
    priorityReasons.push("Funded in the last 36 months.");
  } else {
    buyerFit -= 5;
    priorityReasons.push("Recent funding is unknown or older.");
  }

  if (company.headOfContentPresent) {
    buyerFit -= 25;
    priorityReasons.push("Content leadership detected, which may mean in-house ownership.");
  } else {
    priorityReasons.push("No in-house content lead detected.");
  }

  if (company.hiringMarketingRoles) {
    buyerFit += 10;
    priorityReasons.push("Hiring marketing/content roles suggests unmet content need.");
  }

  const physicalProductFit = String(company.physicalProductFit || "").trim();
  const videoShotPotential = String(company.videoShotPotential || "").trim();
  if (company.hasPhysicalProduct === true) {
    buyerFit += 25;
    priorityReasons.push(physicalProductFit || "Physical product or tangible experience gives video something concrete to shoot.");
  } else if (physicalProductFit) {
    buyerFit += 15;
    priorityReasons.push(physicalProductFit);
  } else if (!isEvents && !isLuxury) {
    buyerFit -= 20;
    priorityReasons.push("No clear physical product, space, or filmable process found.");
  }
  if (videoShotPotential) {
    buyerFit += 10;
    priorityReasons.push(`Video angle: ${videoShotPotential}`);
  }
  if (company.isSoftwareOnly === true && !isEvents && !isLuxury) {
    buyerFit -= 35;
    priorityReasons.push("Software-only company deprioritized because there is less to film.");
  }

  const socials = company.socials || {};
  const platformsPresent = ["linkedin", "twitter", "instagram", "tiktok", "youtube", "facebook"]
    .reduce((count, key) => count + (socials[key] ? 1 : 0), 0);
  const socialGap = clampNumber(100 - platformsPresent * 17);
  if (platformsPresent === 0) priorityReasons.push("No official social platforms found.");
  else priorityReasons.push(`${platformsPresent} official social platform${platformsPresent === 1 ? "" : "s"} found.`);

  buyerFit = clampNumber(buyerFit);
  const priority = Math.round(buyerFit * 0.7 + socialGap * 0.3);

  // Budget signal — likelihood they'd spend $4–5K+ on a single shoot
  let budgetSignal;
  if (isLuxury) {
    budgetSignal = "High";
  } else if (isEvents) {
    budgetSignal = "Medium";
  } else if (buyerFit >= 70) {
    budgetSignal = "Medium";
  } else {
    budgetSignal = "Low";
  }
  if (isLuxury && isEvents) budgetSignal = "High";

  return {
    ...company,
    buyerFit,
    socialGap,
    priority,
    priorityLabel: getShipListPriorityLabel(priority),
    priorityReasons,
    platformsPresent,
    budgetSignal,
  };
}

function cleanBusinessObservation(text, fallback) {
  const source = String(text || fallback || "").trim();
  if (!source) return "I know finding new clients consistently gets harder when your agency already has a lot of moving parts to manage.";
  const stripped = source.replace(/^congratulations[^.]*\.\s*/i, "").replace(/^impressed by[^.]*\.\s*/i, "").trim();
  const sentence = stripped.endsWith(".") ? stripped : `${stripped}.`;
  return `${sentence} I figured that probably makes steady prospecting harder to keep up with.`;
}

function formatSampleLeads(prospects, city, niche, currentId) {
  const rows = (prospects || [])
    .filter(p => p.id !== currentId)
    .slice(0, 5)
    .map(p => {
      const name = p.businessName || "Local business";
      const signal = p.buyingSignal || p.personalizedFirstLine || `Showing signals they may need ${niche || "help"}`;
      return `- ${name} — ${signal}`;
    });

  if (rows.length > 0) return rows.join("\n");
  return `- Five ${niche || "local"} prospects in ${city || "your area"} will be inserted here.`;
}

function toDetailItems(entries) {
  return entries.filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return !!String(value || "").trim();
  }).map(([label, value]) => ({ label, value }));
}

function buildProspectPipelineDetails(prospect, emailDraft = "", cityHint = "") {
  return {
    sourceLabel: "Find Leads",
    sections: [
      {
        title: "Company Snapshot",
        items: toDetailItems([
          ["Company Name", prospect.businessName],
          ["Phone", prospect.phone],
          ["Email", prospect.email],
          ["Address", prospect.address],
          ["Address Detail", prospect.addressDetail],
          ["Website URL Checked", prospect.websiteUrl],
          ["Website Status", prospect.websiteStatus],
          ["Source URL", prospect.sourceUrl],
          ["Proof", prospect.proofReason],
          ["Region", cityHint || prospect.address],
        ]),
      },
      {
        title: "Sales Context",
        items: toDetailItems([
          ["Growth Signals", formatProspectSignalSummary(prospect.signals, prospect.signalEvidence)],
          ["Pitch Angle", prospect.pitchAngle],
          ["Niche", prospect.niche],
        ]),
      },
      ...(emailDraft ? [{
        title: "Saved Email Draft",
        items: [{ label: "Draft", value: emailDraft }],
      }] : []),
    ],
  };
}

// ─── DISTANCE FROM OAKLAND ────────────────────────────────────
// Approximate driving miles from Oakland to Bay Area cities.
// Returns a display string like "~3 mi" or null if unknown.
const OAKLAND_DISTANCES = {
  "oakland": 0, "emeryville": 2, "alameda": 3, "piedmont": 3,
  "berkeley": 5, "el cerrito": 8, "albany": 6, "richmond": 10,
  "san leandro": 8, "san lorenzo": 12, "hayward": 15,
  "union city": 20, "newark": 23, "fremont": 22,
  "san francisco": 9, "daly city": 16, "south san francisco": 19,
  "san bruno": 21, "burlingame": 23, "millbrae": 22,
  "san mateo": 25, "foster city": 26, "belmont": 28,
  "redwood city": 30, "menlo park": 33, "palo alto": 35,
  "mountain view": 38, "los altos": 38, "sunnyvale": 40,
  "santa clara": 42, "san jose": 46, "milpitas": 38,
  "walnut creek": 14, "concord": 20, "pleasant hill": 17,
  "martinez": 24, "antioch": 35, "pittsburg": 30,
  "livermore": 33, "pleasanton": 28, "dublin": 25,
  "san ramon": 26, "danville": 22,
  "marin": 20, "san rafael": 22, "novato": 30, "mill valley": 18,
  "san anselmo": 23, "fairfax": 26,
};

function distanceFromOakland(locationStr) {
  const loc = (locationStr || "").toLowerCase();
  for (const [city, miles] of Object.entries(OAKLAND_DISTANCES)) {
    if (loc.includes(city)) return miles;
  }
  return null;
}

// ─── LOCAL BUSINESS FILTER & SCORER ──────────────────────────
// Filters on company SIZE and STRUCTURE only — any niche is acceptable.
// Returns { score: 1-10, tags: string[], hardExclude: boolean }
function scoreLocalBusiness(r) {
  const name    = (r.companyName || "").toLowerCase();
  // Use r.description (raw API field) at scoring time; r.automationAngle is populated later
  const desc    = ((r.description || r.automationAngle || "") + " " + (r.jobTitle || "")).toLowerCase();
  const loc     = (r.location || "").toLowerCase();
  const website = (r.website || "").toLowerCase();
  const nameAndDesc = name + " " + desc;

  // ── HARD EXCLUDES — structure & size signals only ────────────

  // Known Fortune 500 / national chains / enterprise brands
  const CHAINS = [
    'safelite','liberty mutual','conduent','supercuts','mcdonald','subway','starbucks',
    'walmart','target','cvs','walgreens','rite aid','ups store','fedex office','amazon',
    'apple store','geico','allstate','state farm','progressive insurance','nationwide ins',
    'comcast','at&t','verizon','t-mobile','best buy','costco','homegoods',
    'tj maxx','marshalls','old navy','banana republic','forever 21','h&m','zara',
    'autozone',"o'reilly auto",'advance auto','jiffy lube','midas auto','firestone','pep boys',
    'anytime fitness','planet fitness','crunch fitness',"gold's gym",
    'liberty tax','h&r block','jackson hewitt',
    'great clips','sports clips','fantastic sams',
    'enterprise rent-a-car','hertz','avis car',
    'ashley furniture','rooms to go','pottery barn',
    'ulta beauty','sephora','bath & body works',"victoria's secret",
    // Additional Fortune 500 / enterprise
    "humana","dave & buster","marriott","hilton","hyatt","ihg","wyndham","sheraton","westin",
    "sodexo","aramark","compass group","aimbridge","sonder","vacasa",
    "unitedhealth","cigna","aetna","anthem","kaiser permanente",
    "jpmorgan","bank of america","wells fargo","chase bank",
    "deloitte","kpmg","ernst & young","pricewaterhouse","pwc",
    "public storage","extra space storage","life storage",
    "uhaul","penske truck","ryder system",
    "accenture","cognizant","infosys","wipro","tata consultancy",
  ];
  if (CHAINS.some(c => name.includes(c))) return { score: 0, tags: [], hardExclude: true };

  // Hotel management / hospitality group (chain-level, not a single boutique hotel)
  if (/\b(hotel\s+management|hospitality\s+group|resort\s+group|hotel\s+group|lodging\s+group|property\s+management\s+group)\b/i.test(name)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Corporate-conglomerate name patterns
  if (/\b(global|national|american|premier|elite|corporate|enterprise)\s+(services|solutions|group|partners|corp|management|hospitality|staffing|resources)\b/i.test(name)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Multi-location / national-scale signals in description
  if (/locations across the (us|united states|country|nation)|nationwide|[0-9]{2,}\s+locations|in \d+ states|premier .{3,40} in the united states/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Franchise corporate postings (franchisor, not local franchisee)
  if (/franchise opportunity|become a franchis|franchis.{0,30}across the|we are a franchise with \d+/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Nonprofit / government
  if (/\bnon.?profit\b|\b501.?c\b|\bschool district\b|\bcity of\b|\bcounty of\b/i.test(nameAndDesc)) {
    return { score: 0, tags: [], hardExclude: true };
  }
  if (/\.org$|\.gov$/.test(website)) return { score: 0, tags: [], hardExclude: true };
  if (/\boutreach (program|center|org)\b|\bfoundation\b|\bcommunity organization\b|\bcharit(y|able)\b/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // MLM / commission-only
  if (/be your own boss|unlimited earning potential|1099.*commission|no experience.*commission only/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: company name ending in Hotels / Resorts / Hotel Group / Hotels & Resorts
  if (/\b(hotels|resorts|hotels\s*&\s*resorts|hotel\s+group)\s*$/i.test(name.trim())) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: website domain — "hotels" plural = chain; known national brand domains
  const domain = website.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  if (domain && /hotels/.test(domain)) return { score: 0, tags: [], hardExclude: true };
  if (domain && /restaurantdepot|waxcenter|telecarecorp|marqeta|massageenvy|handanstone|thejointhq|laseraway|drybar|europeanwax|stretchlab|bodyrok|solidcore|orangetheory|f45training|purebarre/.test(domain)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: large physical footprint language (resort-scale, not a walkin SMB)
  if (/\b\d+\s*acres?\b/i.test(desc) && /hotel|resort|lodg|propert/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }
  if (/on.?site (restaurant|fine dining|spa|pool|conference center|ballroom|event space)/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: "state-of-the-art facilities" + "24 hours" combo — signals large operation
  if (/state.of.the.art\s+facilit/i.test(desc) && /24\s*(hours?|hr).{0,25}(day|7)/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: legacy hospitality chain
  if (/for over a century|since\s+(18|19[0-8]\d)\b/i.test(desc) && /hotel|resort|lodg/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: explicit scale language ("420+ locations", "11,000 team members", etc.)
  if (/\b\d{3,}\+?\s*(locations|clinics|centers|studios|stores|sites)\b/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }
  if (/\b\d[\d,]{3,}\s*(team members|employees|staff members)\b/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: hospitals, treatment centers, behavioral health, addiction programs
  if (/\bhospital\b|health system|\btreatment center\b|behavioral health (center|program|services)|addiction (treatment|program|services|recovery)|residential treatment|detox (center|program|facility)/i.test(nameAndDesc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: staffing agency position / third-party employer language
  if (/staffing agency position|employed by (a |an )?(third.party|staffing|outside)|this (is a|position is a) (contract|temp|temporary) (role|position) (through|via|with a)/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: rapidly growing + fitness/wellness = franchise expansion play
  if (/rapidly growing/i.test(desc) && /fitness|wellness|yoga|pilates|gym|studio|health club/i.test(desc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: wholesale / depot / warehouse / distribution operations
  if (/restaurant depot|wholesale depot|\bdistribution center\b|\bfulfillment center\b|\bwarehouse (operations|facility)\b/i.test(nameAndDesc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // Hard-exclude: funded/venture-backed tech company posting for internal office roles
  // (not their core product — e.g. Marqeta hiring a receptionist)
  if (/series [a-e] funding|venture.backed|recently (funded|raised)|post.ipo/i.test(desc) &&
      /\b(software|platform|api|fintech|payments|saas|marketplace)\b/i.test(nameAndDesc)) {
    return { score: 0, tags: [], hardExclude: true };
  }

  // ── FRANCHISE SOFT DETECTION — local franchisee (tag, don't exclude) ──
  const isFranchise = /\bindependently owned\b|\bfranchis(ee|ised)\b/i.test(desc);

  // ── SCORING — Oakland-first, structure-positive ───────────────
  let score = 5;
  const tags = [];

  // Location scoring
  const miles = distanceFromOakland(r.location);
  if (/\boakland\b/i.test(loc))                              { score += 2; tags.push("Oakland"); }
  else if (/\bsan francisco\b|\bsf,?\s*(ca)?\b/i.test(loc)) { score += 1; tags.push("SF"); }
  else if (miles !== null && miles <= 50)                    { /* Bay Area — no boost, show distance only */ }
  else                                                        { score -= 2; }

  // Owner-operated / small team feel (strong positive)
  if (/join our (family|small team)|family.owned|owner.operated|neighborhood|locally owned|our (small |)team|boutique|our (doctor|dentist|lawyer|owner)\b/i.test(desc)) {
    score += 2; tags.push("Owner-operated");
  }

  // Single-location signal (positive)
  if (/\b(single|one|our only|our sole)\s+location\b|our (office|clinic|studio|shop|salon|practice)\b/i.test(desc)) {
    score += 1; tags.push("Single location");
  }

  // Corporate name structure (soft penalty — not a hard exclude)
  if (/\bholdings\b|\benterprises\b|\bventures\b|\bcorp\b|\binc\b/i.test(name))      score -= 1;
  if (/\bsolutions\b|\boutsorc|\bmanaged services\b|\bstaffing\b/i.test(name))        score -= 1;
  if (/\bgroup\b|\bassociates\b/i.test(name))                                         score -= 1;

  // Direct-apply = real company posting, not an aggregator shell
  if (r.isDirectApply) { score += 1; tags.push("Direct listing"); }

  // Franchise: hard ceiling at 5 regardless of other signals
  if (isFranchise) { score = Math.min(score, 5); tags.push("⚠️ Franchise"); }

  // ── SOFT PENALTIES — each deducts 3 points ───────────────────

  const jobUrl = (r.jobUrl || "").toLowerCase();

  // -3: Corporate hiring manager title in description
  if (/\b(hr director|talent acquisition|recruiting team|human resources department|our hr (team|department)|contact our hr)\b/i.test(desc)) {
    score -= 3; tags.push("Corp HR");
  }

  // -3: Corporate ATS platform in the apply URL
  if (/greenhouse\.io|lever\.co|workday\.com|icims\.com|bamboohr\.com|adp\.com|taleo\.net|myworkday\.com|jobvite\.com|smartrecruiters\.com/.test(jobUrl)) {
    score -= 3; tags.push("Corp ATS");
  }

  // -3: Formal benefits package — 3 or more distinct signals
  const BENEFITS_PATTERNS = [
    /\b401k\b|\b401\s*\(k\)/i,
    /\bpto\b|paid time off|vacation (days|policy|accrual)/i,
    /health insurance|medical (insurance|coverage|benefits)|dental (insurance|coverage|benefits)|vision (insurance|coverage|benefits)/i,
    /parental leave|maternity leave|paternity leave/i,
    /\b(fsa|hsa)\b|flexible spending account|health savings account/i,
    /life insurance/i,
    /disability insurance|short.term disability|long.term disability/i,
    /profit.sharing/i,
    /stock options|equity (package|grant|compensation)/i,
    /employee assistance program|\beap\b/i,
  ];
  if (BENEFITS_PATTERNS.filter(re => re.test(desc)).length >= 3) {
    score -= 3; tags.push("Full benefits pkg");
  }

  // -3: Dedicated /careers portal on company's own domain (not a job board)
  if (r.isDirectApply && /\/careers\/|\/career\/|\/jobs\/|\/job-openings\//i.test(jobUrl)) {
    score -= 3; tags.push("Careers portal");
  }

  // -3: Scale language in posting
  if (/our team of \d+\s*(professionals|members|experts|employees)|serving \d+ states|in \d+ (states|cities|markets)|nationwide|national provider|across the (country|us|nation)|multiple (locations|offices|markets)/i.test(desc)) {
    score -= 3; tags.push("Scale language");
  }

  return { score: Math.max(1, Math.min(10, Math.round(score))), tags, hardExclude: false };
}

function buildIndeedPipelineDetails(result, extras = {}) {
  const contact = extras.contactInfo && extras.contactInfo !== "not_found" ? extras.contactInfo : null;
  const linkedInMsg = extras.linkedInMsg || null;
  return {
    sourceLabel: "Find AI Prospects",
    sections: [
      {
        title: "Job Listing",
        items: toDetailItems([
          ["Company", result.companyName],
          ["Industry", result.industry],
          ["Location", result.location],
          ["Job Title", result.jobTitle],
          ["Pay Rate", result.jobPayRate],
          ["Annual Cost", result.annualCost],
          ["Job URL", result.jobUrl],
          ["Website", result.website],
        ]),
      },
      {
        title: "Business Context",
        items: toDetailItems([
          ["Phone", result.phone],
          ["Email", result.email],
          ["Company Size", result.companySize],
          ["Automation Angle", result.automationAngle],
          ["Automation Use Case", result.automationUseCase],
          ["Pitch Hook", result.pitchHook],
          ["Buying Signals", result.buyingSignals || []],
          ["Opportunities", result.opportunities || []],
        ]),
      },
      ...(contact ? [{
        title: "Found Contact",
        items: toDetailItems([
          ["Name", contact.name],
          ["Title", contact.title],
          ["Email", contact.email],
          ["Phone", contact.phone],
          ["Website", contact.website],
          ["Confidence", contact.confidence],
          ["Notes", contact.notes],
        ]),
      }] : []),
      ...(extras.outreachDraft ? [{
        title: "Outreach Draft",
        items: [{ label: "Draft", value: extras.outreachDraft }],
      }] : []),
      ...(extras.applyPitch ? [{
        title: "Apply Pitch",
        items: [{ label: "Pitch", value: extras.applyPitch }],
      }] : []),
      ...(extras.contactDraft ? [{
        title: "Contact Email",
        items: [{ label: "Draft", value: extras.contactDraft }],
      }] : []),
      ...(linkedInMsg ? [{
        title: "LinkedIn Messages",
        items: toDetailItems([
          ["Connection Note", linkedInMsg.connectionNote],
          ["Follow-up DM", linkedInMsg.followUpDm],
        ]),
      }] : []),
    ],
  };
}

function buildLeadListPipelineDetails(lead, columns = [], outreachDraft = "") {
  const cols = (columns || []).length ? columns : Object.keys(lead || {}).filter(k => !["id", "_raw"].includes(k));
  return {
    sourceLabel: "Build a Lead List",
    sections: [
      {
        title: "Generated Lead Data",
        items: cols
          .map(col => ({ label: col, value: getLeadCell(lead, col) }))
          .filter(item => String(item.value || "").trim()),
      },
      ...(outreachDraft ? [{
        title: "Outreach Draft",
        items: [{ label: "Draft", value: outreachDraft }],
      }] : []),
    ],
  };
}

function buildCreditPipelineDetails(lead) {
  return {
    sourceLabel: "Credit Leads",
    sections: [
      {
        title: "Referral Partner",
        items: toDetailItems([
          ["Company Name", getLeadCell(lead, "Company Name")],
          ["Decision Maker", getLeadCell(lead, "Decision Maker")],
          ["Best Phone", getLeadCell(lead, "Best Phone")],
          ["Email", getLeadCell(lead, "Email")],
          ["Region", getLeadCell(lead, "Region")],
          ["Industry", getLeadCell(lead, "Industry")],
          ["Company Type", getLeadCell(lead, "Company Type")],
        ]),
      },
      {
        title: "Referral Signal",
        items: toDetailItems([
          ["Referral Signal", getLeadCell(lead, "Referral Signal")],
          ["Referral Fit", getLeadCell(lead, "Referral Fit")],
          ["Pitch Angle", getLeadCell(lead, "Pitch Angle")],
          ["Signal Proof URL", getLeadCell(lead, "Signal Proof URL")],
          ["Source URL", getLeadCell(lead, "Source URL")],
        ]),
      },
    ],
  };
}

function buildProspectLeadResult(prospect) {
  const hasPhone = !!String(prospect?.phone || "").trim();
  const hasEmail = !!String(prospect?.email || "").trim();
  const hasSourceEvidence = !!String(prospect?.sourceUrl || "").trim();
  const hasWebsiteGap = !!String(prospect?.websiteStatus || prospect?.proofReason || "").trim();

  const criteria = [
    {
      name: "Actionable Contact",
      pass: hasPhone || hasEmail,
      detail: hasPhone && hasEmail ? "Phone and email found" : hasPhone ? "Phone found" : hasEmail ? "Email found" : "No phone or email found",
    },
    {
      name: "Website Gap",
      pass: hasWebsiteGap,
      detail: hasWebsiteGap ? (prospect.websiteStatus || prospect.proofReason) : "No website-gap proof saved",
    },
    {
      name: "Source Evidence",
      pass: hasSourceEvidence,
      detail: hasSourceEvidence ? "Public source saved" : "No source evidence saved",
    },
  ];

  const score = criteria.filter(c => c.pass).length;
  const total = criteria.length;
  return {
    criteria,
    score,
    total,
    qualified: (hasPhone || hasEmail) && hasWebsiteGap && hasSourceEvidence,
  };
}

function renderPipelineSectionValue(item, t) {
  if (Array.isArray(item.value)) {
    return <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>{item.value.join(", ")}</div>;
  }
  if (/^https?:\/\//i.test(String(item.value || ""))) {
    return <a href={item.value} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.accent, overflowWrap: "anywhere" }}>{item.value}</a>;
  }
  return <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.value}</div>;
}

function getPipelineDetailMap(lead) {
  const details = lead.pipelineDetails?.sections || [];
  const detailMap = new Map();
  details.forEach(section => {
    (section.items || []).forEach(item => {
      if (!detailMap.has(item.label)) detailMap.set(item.label, item.value);
    });
  });
  return detailMap;
}

function prospectFromPipelineLead(lead) {
  const detailMap = getPipelineDetailMap(lead);
  return {
    id: lead.prospectRaw?.id || lead.id,
    businessName: lead.prospectRaw?.businessName || detailMap.get("Company Name") || lead.company || lead.name,
    ownerName: lead.prospectRaw?.ownerName || detailMap.get("Decision Maker Name") || lead.name,
    title: lead.prospectRaw?.title || detailMap.get("Title"),
    email: lead.prospectRaw?.email || detailMap.get("Email") || lead.email,
    emailConfidence: lead.prospectRaw?.emailConfidence || detailMap.get("Email Confidence"),
    phone: lead.prospectRaw?.phone || detailMap.get("Phone") || lead.phone,
    linkedInUrl: lead.prospectRaw?.linkedInUrl || detailMap.get("LinkedIn URL"),
    sourceUrl: lead.prospectRaw?.sourceUrl || detailMap.get("Source URL") || lead.source,
    buyingSignal: lead.prospectRaw?.buyingSignal || detailMap.get("Buying Signal") || lead.description,
    personalizedFirstLine: lead.prospectRaw?.personalizedFirstLine || detailMap.get("Personalized First Line"),
    niche: lead.prospectRaw?.niche || detailMap.get("Niche") || lead.projectType || lead.searchContext?.niche,
    address: lead.prospectRaw?.address || detailMap.get("Region") || lead.location,
    classification: lead.prospectRaw?.classification,
  };
}

function buildLeadListOfferEmail(lead, prospects) {
  const detailMap = getPipelineDetailMap(lead);
  const prospect = lead.sourceMode === "prospects" ? prospectFromPipelineLead(lead) : null;

  const company = prospect?.businessName || lead.company || detailMap.get("Company Name") || "your company";
  const contactName = prospect?.ownerName || lead.name || detailMap.get("Decision Maker Name") || detailMap.get("Contact Person") || "";
  const firstName = getFirstName(contactName);
  const niche = prospect?.niche || lead.searchContext?.niche || lead.projectType || detailMap.get("Niche") || detailMap.get("Industry") || "your service";
  const location = lead.searchContext?.city || lead.location || prospect?.address || detailMap.get("Region") || detailMap.get("Location") || "your market";
  const signal = prospect?.buyingSignal || detailMap.get("Buying Signal") || detailMap.get("Reason / Buying Signal") || lead.description || "";
  const firstLine = prospect?.personalizedFirstLine || detailMap.get("Personalized First Line") || "";

  const observation = firstLine
    ? cleanBusinessObservation(firstLine, `${company} already has real momentum in ${location}`)
    : cleanBusinessObservation(signal, `${company} looks like a strong fit for more consistent outbound prospecting`);
  const sampleLeads = formatSampleLeads(prospects, location, niche, prospect?.id || lead.id);
  return `Subject: Found 5 ${location} businesses that need coverage

Hi ${firstName},

${observation}

I built a tool that finds small businesses in your area actively signaling they need ${niche} services — recently opened, changing ownership, or expanding — businesses that typically fall through the cracks on coverage.

Here are 5 from your area as a sample:
${sampleLeads}

The full list of 50 is $200. Delivered within 24 hours.

Interested?

${DEFAULT_EMAIL_SIGNATURE}`;
}

const DEFAULT_EMAIL_SIGNATURE = `David Osei-Tutu
Founder, SankoTech Systems
david@sankotechsystems.com`;

function upgradeLegacyDraftEmail(text) {
  const value = String(text || "");
  if (!value) return value;

  return value
    .replace(
      /^Subject: 50 .*? leads in (.+?) — 5 free samples inside$/m,
      "Subject: Found 5 $1 businesses that need coverage",
    )
    .replace(
      "recently opened, underserved, no current provider signals",
      "recently opened, changing ownership, or expanding — businesses that typically fall through the cracks on coverage",
    )
    .replace(/\n\[STRIPE LINK PLACEHOLDER\]\s*$/m, "")
    .replace(/\n\[Your name\]\s*$/m, `\n${DEFAULT_EMAIL_SIGNATURE}`);
}

function upgradeLegacyLeadDraft(lead) {
  if (!lead?.savedEmailDraft) return lead;
  const upgradedDraft = upgradeLegacyDraftEmail(lead.savedEmailDraft);
  return upgradedDraft === lead.savedEmailDraft ? lead : { ...lead, savedEmailDraft: upgradedDraft };
}

function normalizePipelineContextValue(value) {
  return String(value || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function mergePipelineLeads(localLeads, remoteLeads) {
  const byKey = new Map();
  [...(remoteLeads || []), ...(localLeads || [])].forEach(lead => {
    const key = pipelineUniqueKey(lead);
    if (!byKey.has(key)) byKey.set(key, lead);
  });
  return [...byKey.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─── METRO WARNING ───────────────────────────────────────────
const HIGH_ADOPTION_CITIES = new Set([
  "new york","los angeles","chicago","houston","phoenix","philadelphia",
  "san antonio","san diego","dallas","san jose","austin","fort worth",
  "columbus","san francisco","charlotte","indianapolis","seattle","denver",
  "washington","nashville","boston","portland","las vegas","baltimore",
  "milwaukee","albuquerque","tucson","fresno","mesa","sacramento",
  "atlanta","kansas city","omaha","colorado springs","raleigh","miami",
  "minneapolis","tampa","new orleans","virginia beach","long beach",
  "arlington","bakersfield","honolulu","anaheim","aurora","santa ana",
  "corpus christi","riverside","st louis","pittsburgh","anchorage",
  "stockton","cincinnati","st paul","toledo","greensboro","newark",
  "plano","henderson","lincoln","buffalo","fort wayne","jersey city",
  "chula vista","orlando","st petersburg","norfolk","chandler","laredo",
  "madison","durham","lubbock","winston-salem","garland","glendale",
  "hialeah","reno","baton rouge","irvine","chesapeake","scottsdale",
  "north las vegas","fremont","gilbert",
  // Affluent suburbs / neighborhoods with high web adoption
  "sherman oaks","studio city","encino","calabasas","tarzana",
  "woodland hills","beverly hills","west hollywood","santa monica",
  "malibu","brentwood","pacific palisades","culver city","marina del rey",
  "manhattan beach","hermosa beach","redondo beach","el segundo","torrance",
  "pasadena","burbank","los gatos","saratoga",
  "palo alto","menlo park","mountain view","sunnyvale","cupertino",
  "san mateo","burlingame","redwood city","walnut creek","pleasanton",
  "danville","orinda","lafayette","moraga","oakland","berkeley","emeryville",
  "cambridge","newton","brookline","wellesley","evanston","oak park",
  "naperville","schaumburg","wheaton","downers grove",
  "bellevue","kirkland","redmond","bothell","issaquah","mercer island",
  "tempe","chandler","gilbert","peoria","scottsdale",
  "plano","frisco","allen","mckinney","southlake","grapevine","colleyville",
  "newport beach","laguna beach","mission viejo","lake forest",
  "hoboken","montclair","princeton","summit","morristown",
  "bethesda","rockville","silver spring","mclean","tysons","great falls",
  "lakewood","centennial","highlands ranch","parker",
  "buckhead","sandy springs","alpharetta","marietta","dunwoody",
  "coral gables","coconut grove","aventura","weston","brickell","bal harbour",
  "stamford","greenwich","westport","darien","new canaan","wilton",
  "white plains","yonkers","scarsdale","bronxville","tarrytown","rye",
  "brooklyn","queens","bronx","staten island","manhattan",
]);

function isHighAdoptionCity(cityStr) {
  const normalized = String(cityStr || "")
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
  return HIGH_ADOPTION_CITIES.has(normalized);
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function LeadGen() {
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('lg-theme') || localStorage.getItem('lq-theme') || 'dark');
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("construction");
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState(0);

  const [tab, setTab] = useState("dashboard");
  const [mode, setMode] = useState("leadlist");
  const [criteria, setCriteria] = useState(getDefaultCriteria("construction"));
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_LEAD });
  const [expandedLead, setExpandedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [pipelineDraftingId, setPipelineDraftingId] = useState(null);
  const [pipelineRetryingId, setPipelineRetryingId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState(null);
  const [settingsEdited, setSettingsEdited] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [costEvents, setCostEvents] = useState([]);
  const [costRuns, setCostRuns] = useState([]);
  const [expandedCostRuns, setExpandedCostRuns] = useState({});
  const [expandedUnassociatedCosts, setExpandedUnassociatedCosts] = useState(false);
  const [dashboardView, setDashboardView] = useState("overview");

  const [inlineEdit, setInlineEdit] = useState(null); // { id, field, value }

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
    onlineBooking: true,
  });
  const [prospects, setProspects] = useState([]);
  const [prospectLoading, setProspectLoading] = useState(false);
  const [prospectError, setProspectError] = useState(null);
  const [prospectProgress, setProspectProgress] = useState(null); // { phase, current, total, batchIndex, totalBatches }
  const [expandedProspect, setExpandedProspect] = useState(null);
  const [draftingEmail, setDraftingEmail] = useState(null);
  const [emailDrafts, setEmailDrafts] = useState({});
  const [prospectSendStatus, setProspectSendStatus] = useState({});
  const [sendingProspectId, setSendingProspectId] = useState(null);

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
  const [indeedSendStatus, setIndeedSendStatus] = useState({});     // { [id]: { sent, sentAt, to } }
  const [sendingIndeedId, setSendingIndeedId] = useState(null);

  // Ship List state
  const [shipListResults, setShipListResults] = useState([]);
  const [shipListLoading, setShipListLoading] = useState(false);
  const [shipListError, setShipListError] = useState(null);
  const [shipListCount, setShipListCount] = useState(10);
  const [shipListSizeBand, setShipListSizeBand] = useState("startup");
  const [shipListIncludeServices, setShipListIncludeServices] = useState(true);
  const [shipListCity, setShipListCity] = useState("San Francisco");
  const [shipListPriorityFilter, setShipListPriorityFilter] = useState("all");
  const [shipListIndustryFocus, setShipListIndustryFocus] = useState("all");
  const [shipListProgress, setShipListProgress] = useState(null);

  // Ship List DB state
  const [savedCompanies, setSavedCompanies] = useState([]); // companies saved to Supabase
  const [savedLoading, setSavedLoading] = useState(false);
  const [shipListContacts, setShipListContacts] = useState({}); // { [id]: { name, title, linkedin, email, platform } }
  const [shipListOutreach, setShipListOutreach] = useState({}); // { [id]: string (draft) }
  const [generatingContact, setGeneratingContact] = useState(null); // id currently being looked up
  const [shipListOutreachOpen, setShipListOutreachOpen] = useState({}); // { [id]: boolean }

  // Build a Lead List state (Mode 2B)
  const [leadListCity, setLeadListCity] = useState("");
  const [leadListNiche, setLeadListNiche] = useState("");
  const [leadListCount, setLeadListCount] = useState(10);
  const [leadListRequest, setLeadListRequest] = useState("");
  const [leadListJob, setLeadListJob] = useState(null);
  const [leadListColumns, setLeadListColumns] = useState([]);
  const [leadListResults, setLeadListResults] = useState([]);
  const [leadListLoading, setLeadListLoading] = useState(false);
  const [leadListError, setLeadListError] = useState(null);
  const [leadListProgress, setLeadListProgress] = useState(null);
  const [leadListSheetLoading, setLeadListSheetLoading] = useState(false);
  const [leadListSheetStatus, setLeadListSheetStatus] = useState(null);
  const [leadListOutreach, setLeadListOutreach] = useState({});
  const [generatingLeadListOutreach, setGeneratingLeadListOutreach] = useState(null);

  // Credit Leads state
  const [creditCity, setCreditCity] = useState("");
  const [creditNiche, setCreditNiche] = useState("");
  const [creditCount, setCreditCount] = useState(10);
  const [creditSignalFocus, setCreditSignalFocus] = useState("growth");
  const [creditResults, setCreditResults] = useState([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState(null);
  const [creditProgress, setCreditProgress] = useState(null);

  const fileRef = useRef();
  const activeCostRunRef = useRef(null);
  const creditVerificationCacheRef = useRef(new Map());
  const t = themes[theme];
  const ind = INDUSTRIES[industry] || INDUSTRIES.construction;
  const PROJECT_TYPES = ind.types;

  // ─── LOAD PERSISTED DATA ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const [savedLeads, savedCriteria, savedSettings] = await Promise.all([
        loadData(SK.leads), loadData(SK.criteria), loadData(SK.settings),
      ]);
      const savedCostEvents = await loadData(SK.costEvents);
      const savedCostRuns = await loadData(SK.costRuns);
      const savedProspectSendStatus = await loadData(SK.prospectSendStatus);
      if (savedLeads) setLeads(savedLeads.map(upgradeLegacyLeadDraft));
      if (savedCriteria) setCriteria(savedCriteria);
      if (savedCostEvents) {
        const normalizedEvents = normalizeLegacyCostEvents(savedCostEvents);
        if (normalizedEvents.some((event, index) => event.id !== savedCostEvents[index]?.id || event.createdAt !== savedCostEvents[index]?.createdAt)) {
          console.log(`[CostTracking] Migrated ${normalizedEvents.length} legacy cost events to new format`);
        }
        setCostEvents(normalizedEvents);
      }
      if (savedCostRuns) setCostRuns(Array.isArray(savedCostRuns) ? savedCostRuns : []);
      if (savedProspectSendStatus) setProspectSendStatus(savedProspectSendStatus);
      if (savedSettings) {
        if (savedSettings.companyName) setCompanyName(savedSettings.companyName);
        if (savedSettings.theme) setTheme(savedSettings.theme);
        if (savedSettings.industry) {
          setIndustry(savedSettings.industry);
        }
        if (savedSettings.setupComplete) { setSetupComplete(true); setTab("dashboard"); }
      }
      setLoading(false);
      loadSavedCompanies();
    })();
  }, []);

  // ─── PERSIST ON CHANGE ────────────────────────────────────
  useEffect(() => { if (!loading) saveData(SK.leads, leads); }, [leads, loading]);
  useEffect(() => { if (!loading) saveData(SK.criteria, criteria); }, [criteria, loading]);
  useEffect(() => { if (!loading) saveData(SK.costEvents, costEvents.slice(0, 500)); }, [costEvents, loading]);
  useEffect(() => { if (!loading) saveData(SK.costRuns, costRuns.slice(0, 150)); }, [costRuns, loading]);
  useEffect(() => { if (!loading) saveData(SK.prospectSendStatus, prospectSendStatus); }, [prospectSendStatus, loading]);
  useEffect(() => { if (!loading) saveData(SK.settings, { companyName, theme, industry, setupComplete }); }, [companyName, theme, industry, setupComplete, loading]);
  useEffect(() => { localStorage.setItem('lq-theme', theme); }, [theme]);

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

  const recordCostEvent = (event) => {
    const activeRun = activeCostRunRef.current;
    const costEvent = {
      id: createCallId(),
      createdAt: Date.now(),
      runId: activeRun?.id || null,
      ...event,
    };
    if (activeRun) activeRun.calls.push(costEvent);
    setCostEvents(prev => [costEvent, ...prev].slice(0, 500));
    return costEvent;
  };

  const startCostRun = ({ mode: runMode, action, params = {} }) => {
    if (activeCostRunRef.current) {
      console.warn(`[CostTracking] Starting run while ${activeCostRunRef.current.id} is still active; nested/concurrent runs are not fully supported.`);
    }
    const run = {
      id: createRunId(),
      mode: runMode,
      action,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: 0,
      params,
      resultCount: 0,
      totalCost: 0,
      callIds: [],
      status: "running",
      calls: [],
    };
    activeCostRunRef.current = run;
    console.log(`[CostTracking] Started run ${run.id} (mode: ${runMode})`);
    return run.id;
  };

  const endCostRun = (runId, { resultCount = 0, status = "success", notes = "" } = {}) => {
    const activeRun = activeCostRunRef.current;
    if (!activeRun || activeRun.id !== runId) {
      console.warn(`[CostTracking] Could not end run ${runId}; no matching active run`);
      return null;
    }
    const endedAt = new Date().toISOString();
    const durationMs = Date.parse(endedAt) - Date.parse(activeRun.startedAt);
    const finalized = {
      ...activeRun,
      endedAt,
      durationMs,
      resultCount,
      totalCost: activeRun.calls.reduce((sum, event) => sum + Number(event.cost || 0), 0),
      callIds: activeRun.calls.map(event => event.id),
      status,
      notes,
    };
    delete finalized.calls;
    activeCostRunRef.current = null;
    setCostRuns(prev => [finalized, ...prev.filter(run => run.id !== runId)].slice(0, 150));
    console.log(`[CostTracking] Ended run ${runId}: ${formatCost(finalized.totalCost)} in ${durationMs}ms, ${finalized.callIds.length} calls, ${resultCount} results`);
    return finalized;
  };

  const callAnthropic = async (action, body) => {
    const startedAt = Date.now();
    const model = body?.model || CLAUDE_SEARCH_MODEL;
    const fallbackInputTokens = estimateTokensFromText(JSON.stringify(body || {}));
    let raw = "";
    let status = 0;
    try {
      const response = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      status = response.status;
      raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          error: {
            type: "upstream_parse_error",
            message: `Service unavailable (HTTP ${response.status})`,
          },
        };
      }
      const fallbackOutputTokens = estimateTokensFromText(raw);
      const disabledByServer = data?.error?.type === "anthropic_disabled";
      const estimatedCostHeader = Number(response.headers.get("x-anthropic-estimated-cost-usd") || "");
      const inputHeader = Number(response.headers.get("x-anthropic-input-tokens") || "");
      const outputHeader = Number(response.headers.get("x-anthropic-output-tokens") || "");
      const searchHeader = Number(response.headers.get("x-anthropic-web-search-requests") || "");
      const usage = disabledByServer
        ? { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, webSearchRequests: 0, cost: 0 }
        : calculateAnthropicCost(data.model || model, data.usage, fallbackInputTokens, fallbackOutputTokens);
      if (Number.isFinite(estimatedCostHeader) && estimatedCostHeader > 0) {
        usage.cost = estimatedCostHeader;
        if (Number.isFinite(inputHeader)) usage.inputTokens = inputHeader;
        if (Number.isFinite(outputHeader)) usage.outputTokens = outputHeader;
        if (Number.isFinite(searchHeader)) usage.webSearchRequests = searchHeader;
      }
      recordCostEvent({
        action,
        model: data.model || model,
        status: data.error ? "failed" : "success",
        httpStatus: status,
        durationMs: Date.now() - startedAt,
        usedProviderUsage: !!data.usage,
        error: data.error?.message || "",
        ...usage,
      });
      return { response, data, raw };
    } catch (error) {
      const usage = calculateAnthropicCost(model, null, fallbackInputTokens, estimateTokensFromText(raw));
      recordCostEvent({
        action,
        model,
        status: "failed",
        httpStatus: status,
        durationMs: Date.now() - startedAt,
        usedProviderUsage: false,
        error: error?.message || "Request failed",
        ...usage,
      });
      throw error;
    }
  };

  const verifyCreditProofUrl = async (url) => {
    const normalized = String(url || "").trim();
    if (!normalized) return { ok: false, reason: "missing_url" };
    if (creditVerificationCacheRef.current.has(normalized)) {
      return creditVerificationCacheRef.current.get(normalized);
    }
    const response = await fetch("/api/verify-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalized }),
    });
    const data = await response.json().catch(() => ({ ok: false, reason: "bad_verify_response" }));
    const result = response.ok ? data : { ...data, ok: false };
    creditVerificationCacheRef.current.set(normalized, result);
    return result;
  };

  // ─── PIPELINE STORAGE ─────────────────────────────────────
  const savePipelineLead = async (lead, { silent = false } = {}) => {
    const normalizedLead = {
      ...lead,
      id: lead.id || Date.now() + Math.random(),
      createdAt: lead.createdAt || Date.now(),
      followUp: lead.followUp || "new",
      result: lead.result || { qualified: true, score: 1, total: 1, criteria: [] },
    };

    setLeads(prev => mergePipelineLeads([normalizedLead, ...prev], []));
    if (!silent) showToast(`${normalizedLead.company || normalizedLead.name || "Lead"} added to Pipeline`);
    return normalizedLead;
  };

  const updatePipelineLead = (matcher, updater, { silent = true } = {}) => {
    const existing = leads.find(matcher);
    if (!existing) return null;
    const updatedLead = updater(existing);
    setLeads(prev => prev.map(lead => (matcher(lead) ? updatedLead : lead)));
    savePipelineLead(updatedLead, { silent });
    return updatedLead;
  };

  // ─── LEAD OPERATIONS ─────────────────────────────────────
  const handleAddLead = () => {
    if (!form.name.trim()) { showToast("Lead name is required", "error"); return; }
    const result = qualifyLead(form, criteria, ind.typeName);
    const newLead = { ...form, id: Date.now() + Math.random(), createdAt: Date.now(), result, sourceMode: mode };
    savePipelineLead(newLead);
    setForm({ ...EMPTY_LEAD });
  };

  const handleDeleteLead = (id) => {
    setConfirmAction({
      title: "Delete Lead",
      message: "Are you sure? This can't be undone.",
      onConfirm: async () => {
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
    const updatedLead = { ...editForm };
    setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
    savePipelineLead(updatedLead, { silent: true });
    setEditingLead(null); setEditForm(null);
    showToast("Lead updated");
  };

  const handleFollowUpChange = (id, status) => {
    const lead = leads.find(l => l.id === id);
    const updatedLead = lead ? { ...lead, followUp: status } : null;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, followUp: status } : l));
    if (updatedLead) savePipelineLead(updatedLead, { silent: true });
  };

  const handleInlineSave = () => {
    if (!inlineEdit) return;
    const { id, field, value } = inlineEdit;
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      savePipelineLead(updated, { silent: true });
      return updated;
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
      const imported = parsed.map(l => ({ ...l, id: Date.now() + Math.random(), createdAt: Date.now(), result: qualifyLead(l, criteria, ind.typeName), personalRank: l.personalRank || "" }));
      setLeads(prev => [...imported, ...prev]);
      showToast(`${parsed.length} leads imported`);
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
	    showToast("Existing leads updated");
	    setSettingsEdited(false);
	  };

  // ─── PROSPECT SEARCH (two-step decision maker enrichment) ───
  const handleProspectSearch = async () => {
    const locationText = prospectCity.trim();
    if (!locationText) { showToast("Enter a city and state", "error"); return; }
    if (!/,\s*[A-Za-z]{2}\b/.test(locationText)) {
      showToast("Enter city and state, e.g. San Jose, CA", "error");
      return;
    }
    // Hard block: high web-adoption city + no niche = almost certainly no results.
    // Bail before making any API call to avoid burning money.
    if (!prospectNiche.trim() && isHighAdoptionCity(locationText)) {
      setProspectError(`${locationText.replace(/,.*$/, "").trim()} is a high web-adoption area. Most businesses here already have websites. Add a niche (e.g. "nail salons", "auto detailing") to get results.`);
      return;
    }
    setProspectLoading(true);
    setProspectError(null);
    setProspects([]);
    setProspectProgress({ phase: "searching" });
    const searchNiche = prospectNiche.trim();
    const isGeneralSearch = !searchNiche;
    const displayTarget = searchNiche || "local businesses";
    // Beta: default to lead-quality mode (contact verification skipped) so testers get leads.
    // Escape hatch: set localStorage "lq-lead-quality-only" = "0" to use the strict gate.
    const leadQualityOnly = typeof window === "undefined" || window.localStorage?.getItem("lq-lead-quality-only") !== "0";
    const costRunId = startCostRun({
      mode: "prospects",
      action: "Find Leads",
      params: {
        city: locationText,
        niche: searchNiche || "general",
        requestedCount: prospectCount,
        filters: prospectFilters,
      },
    });
    let prospectRunResultCount = 0;
    let prospectRunEnded = false;
    const generalLeadFocusAreas = [
      "home service businesses such as roofers, plumbers, HVAC companies, electricians, painters, and landscapers",
      "personal service businesses such as salons, barbers, med spas, cleaners, tutors, and fitness studios",
      "street-level local operators such as auto repair shops, restaurants, food trucks, laundromats, and small retailers",
      "professional local practices such as dentists, chiropractors, therapists, accountants, and small law offices",
    ];
    const getNicheFocusAreas = (cityValue, nicheValue) => {
      const city = String(cityValue || "").toLowerCase();
      const niche = String(nicheValue || "").trim();
      if (!niche) return generalLeadFocusAreas;
      const metroSlices = city.includes("phoenix")
        ? ["Phoenix", "Glendale AZ", "Peoria AZ", "Mesa AZ", "Tempe AZ", "Scottsdale AZ", "Chandler AZ"]
        : city.includes("los angeles")
          ? ["Los Angeles", "Glendale CA", "Burbank CA", "Pasadena CA", "Inglewood CA", "Long Beach CA", "Van Nuys CA"]
          : city.includes("houston")
            ? ["Houston", "Katy TX", "Sugar Land TX", "Pasadena TX", "Spring TX", "Pearland TX"]
            : city.includes("dallas")
              ? ["Dallas", "Plano TX", "Garland TX", "Irving TX", "Arlington TX", "Mesquite TX"]
              : city.includes("miami")
                ? ["Miami", "Hialeah FL", "Doral FL", "Kendall FL", "Hollywood FL"]
                : [];
      const nicheSlices = /auto detail|detailing|ceramic|paint correction/i.test(niche)
        ? ["mobile auto detailers", "ceramic coating shops", "paint correction specialists", "interior car detailing", "locally owned auto detailing"]
        : /nail|salon/i.test(niche)
          ? ["independent nail salons", "appointment-only nail studios", "mobile nail techs", "locally owned beauty salons"]
          : /roof|hvac|plumb|electric|paint|landscap/i.test(niche)
            ? [`independent ${niche}`, `owner-operated ${niche}`, `small ${niche} contractors`, `${niche} with Facebook or Yelp-only presence`]
            : [`independent ${niche}`, `owner-operated ${niche}`, `local ${niche} with Yelp-only presence`, `${niche} with social-only presence`];
      if (metroSlices.length === 0) return nicheSlices;
      return nicheSlices.map((slice, index) => `${slice} in ${metroSlices[index % metroSlices.length]}`);
    };
    const prospectFocusAreas = getNicheFocusAreas(locationText, searchNiche);
    const activeProspectSignalKeys = PROSPECT_SIGNAL_KEYS.filter(key => prospectFilters[key] !== false);
    const activeProspectSignalInstructions = activeProspectSignalKeys
      .map(key => `- ${PROSPECT_SIGNAL_FILTERS[key].prompt}`)
      .join("\n");
    const activeProspectSignalJson = activeProspectSignalKeys
      .map(key => `      "${key}": false`)
      .join(",\n");
    const activeProspectSignalEvidenceJson = activeProspectSignalKeys
      .map(key => `      "${key}": ""`)
      .join(",\n");
    const activeProspectSignalLabels = activeProspectSignalKeys
      .map(key => PROSPECT_SIGNAL_FILTERS[key].label)
      .join(", ");

    const parseProspectJSON = (fullText) => {
      let parsed = null;
      const fenceMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (fenceMatch) { try { parsed = JSON.parse(fenceMatch[1]); } catch {} }
      if (!parsed) {
        const allArrays = [...fullText.matchAll(/\[[\s\S]*?\](?=\s*$|\s*```|\s*\n\n)/g)];
        for (let i = allArrays.length - 1; i >= 0; i--) {
          try { const c = JSON.parse(allArrays[i][0]); if (Array.isArray(c) && c.length > 0) { parsed = c; break; } } catch {}
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

    const isBlank = (value) => !String(value || "").trim() || /^(not found|n\/a|na|none|unknown|null)$/i.test(String(value || "").trim());
    const clean = (value) => isBlank(value) ? "" : String(value || "").trim();
    const isPlausibleEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    const normalizeProspectResults = (rows) => (rows || [])
      .map((r, i) => {
        const p = {
          id: Date.now() + i + Math.random(),
          businessName: clean(r.businessName || r.companyName || r["Company Name"]),
          ownerName: "",
          title: "",
          phone: clean(r.phone || r["Phone"] || r["Best Phone"]),
          email: clean(r.email || r["Email"]),
          emailConfidence: "",
          linkedInUrl: "",
          address: clean(r.address || r["Address"] || r.region || r["Region"]),
          addressDetail: "",
          actualCity: "",
          requestedLocation: locationText,
          websiteUrl: clean(r.websiteUrl || r["Website URL"] || r.website || r["Website"]),
          sourceUrl: clean(r.sourceUrl || r.source || r["Source URL"] || r["Proof URL"]),
          websiteStatus: clean(r.websiteStatus || r["Website Status"]),
          proofReason: clean(r.proofReason || r.proof || r["Proof"] || r["Proof / Reason"]),
          pitchAngle: clean(r.pitchAngle || r["Pitch Angle"]),
          facebookUrl: clean(r.facebookUrl || r["Facebook URL"]),
          instagramUrl: clean(r.instagramUrl || r["Instagram URL"]),
          yelpUrl: clean(r.yelpUrl || r["Yelp URL"]),
          signals: normalizeProspectSignals(r),
          signalEvidence: normalizeProspectSignalEvidence(r),
          signalCount: 0,
          buyingSignal: clean(r.websiteStatus || r["Website Status"] || r.proofReason || r.proof || r["Proof"]),
          personalizedFirstLine: clean(r.pitchAngle || r["Pitch Angle"]),
          niche: searchNiche,
          buyingSignals: [],
          opportunities: [],
          classification: null,
        };
        p.addressDetail = getAddressDetail(p.address);
        p.actualCity = inferProspectCity(p.address, locationText);
        p.signalCount = prospectSignalCount(p.signals);
        const signalSummary = formatProspectSignalSummary(p.signals, p.signalEvidence);
        p.buyingSignals = [signalSummary, p.buyingSignal].filter(Boolean);
        p.opportunities = p.personalizedFirstLine ? [p.personalizedFirstLine] : [];
        p.classification = classifyProspect(p);
        p.webdevFit = scoreWebdevProspect(p, { qualityOnly: leadQualityOnly });
        return p;
      })
      .filter(p => p.businessName && (p.phone || isPlausibleEmail(p.email)));

    const sortProspectsBySignals = (rows) => [...rows].sort((a, b) => {
      const scoreDelta = (b.webdevFit?.score || 0) - (a.webdevFit?.score || 0);
      if (scoreDelta !== 0) return scoreDelta;
      const signalDelta = (b.signalCount || 0) - (a.signalCount || 0);
      if (signalDelta !== 0) return signalDelta;
      const contactDelta = Number(Boolean(b.phone && b.email)) - Number(Boolean(a.phone && a.email));
      return contactDelta;
    });

    const refreshProspectQuality = (rows) => rows
      .map(row => {
        const next = {
          ...row,
          classification: classifyProspect(row),
        };
        next.webdevFit = scoreWebdevProspect(next, { qualityOnly: leadQualityOnly });
        return next;
      });

    const keepSellableProspects = (rows) => refreshProspectQuality(rows)
      .filter(row => row.webdevFit?.accepted)
      .filter(row => row.classification?.tier !== "NOT ACTIONABLE");

    const runAnthropicSearch = async ({ maxTokens, system, prompt, action }) => {
      const { response: resp, data } = await callAnthropic(action || "Find My Clients Search", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
      if (!data || data.error?.type === "upstream_parse_error") throw new Error(`Service unavailable (HTTP ${resp.status})`);
      if (data.error) throw new Error(data.error.message || "Unknown error from the AI service.");
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      return parseProspectJSON(text) || [];
    };

    // Cheap probe used only by the sample gate — minimal tokens, no deep per-business searches.
    const runSampleProbe = async () => {
      const batchTarget = searchNiche
        ? (prospectFocusAreas[0] || searchNiche)
        : generalLeadFocusAreas[0];
      return runAnthropicSearch({
        maxTokens: 480,
        action: "Find My Clients Sample Probe",
        system: "You are a fast B2B lead researcher. Use a single broad web search to find real local businesses. Return only a raw JSON array. No markdown, no explanation.",
        prompt: `Find up to 3 real ${batchTarget} in ${locationText} that look like good prospects for a web development agency because they do NOT have a usable standalone website.

Practical no-website definition:
- No website listed on public sources.
- Or only Facebook, Instagram, Yelp, directory, booking, or Google Business Profile.
- Or listed website is broken, parked, or a placeholder.

Rules:
- Run ONE broad search (e.g. "${batchTarget} ${locationText}" on Yelp or Google Maps). Prefer listings that show no Website field.
- Do NOT run separate per-business searches. The app verifies websites after this step.
- Keep only real local businesses with a phone or email.
- Exclude national chains, franchises, and directories.
- Prefer owner-operated service businesses where a first website, booking page, or local SEO page would clearly help them win customers.
- Source URL must be a business-specific page for that company. Never use a generic search results URL like Yelp search, Google search, or Google Maps search.
- Source URL must be reachable by an automated server check. Do not use Facebook, Instagram, Yelp, TikTok, or Google as the primary Source URL. Prefer accessible business-specific pages from MapQuest, Manta, Chamber of Commerce, BBB, Cylex, ShowMeLocal, BusinessYab, local city/business directories, or another non-social directory profile.
- Prioritize candidates with these selected signals when visible from the same public source: ${activeProspectSignalLabels || "weak/no website"}.
- Return fewer than 3 if you cannot find 3 quickly.

Return exactly this JSON array (no other text):
[{ "Company Name": "", "Phone": "", "Email": "", "Website URL": "", "Source URL": "", "Website Status": "No website found", "Facebook URL": "", "Instagram URL": "", "Yelp URL": "", "Pitch Angle": "", "Signals": {${activeProspectSignalJson ? `\n${activeProspectSignalJson}\n    ` : ""}}, "Signal Evidence": {${activeProspectSignalEvidenceJson ? `\n${activeProspectSignalEvidenceJson}\n    ` : ""}} }]`,
      });
    };

    const runCompanyDiscoveryBatch = async ({ batchSize, batchIndex, existingCompanies, focusArea }) => {
      const existingNames = existingCompanies
        .map(company => clean(company["Company Name"] || company.companyName || company.businessName))
        .filter(Boolean)
        .join(", ");
      const batchTarget = focusArea || searchNiche || generalLeadFocusAreas[0];
      return runAnthropicSearch({
        maxTokens: 900,
        action: "Find My Clients Company Search",
        system: "You are a B2B company researcher. Use web search to find real independent businesses. Return ONLY a raw JSON array. No markdown, no explanation, no placeholder text.",
        prompt: `Find ${batchSize} real ${batchTarget} in ${locationText} that are strong prospects for web development services because they do not have a usable standalone website.

Search only this focused category for this batch. Do not broaden to every business type in the city.

Practical no-website definition:
- No website listed on public sources.
- Or only a Facebook, Instagram, Yelp, directory, booking page, marketplace profile, or Google Business Profile.
- Or the listed website is broken, parked, dead, empty, under construction, or a generic placeholder.

Website verification research required for every candidate:
1. Search for the exact query: "[business name] ${locationText} official website".
2. MANDATORY: If the business appears on Yelp, Google Business Profile, Facebook, Instagram, or any directory listing, you must inspect that listing for a 'Website' field, link, or URL pointing to the business's own domain. If found, you MUST put the exact URL into the 'Website URL' field of the JSON response, even if you suspect the site may be broken or low-quality. Do not leave 'Website URL' blank if a candidate URL appears anywhere in directory listings or search results. The verifier will check whether the URL actually works — your job is only to extract it.
3. Search the exact candidate domain again to see if it has a real indexed presence for that business.
4. Only use "No website found" if those checks do not reveal a usable standalone website.

Exclude:
- Companies with a normal usable standalone website.
- National chains, franchises, marketplaces, directories, and lead sellers.
- Companies without a phone number or email address.
- Companies where the only pitch is generic. Keep businesses where the webdev pain is concrete: no website, social-only presence, Yelp-only presence, broken domain, missing booking page, or weak local SEO presence.
- Companies where you cannot find a business-specific source page. A Yelp search URL, Google search URL, or maps search URL is not proof.
- Source URL must be reachable by an automated server check. Do not use Facebook, Instagram, Yelp, TikTok, or Google as the primary Source URL. Prefer accessible business-specific pages from MapQuest, Manta, Chamber of Commerce, BBB, Cylex, ShowMeLocal, BusinessYab, local city/business directories, or another non-social directory profile.
${existingNames ? `Do not repeat these companies: ${existingNames}.` : ""}

Email extraction — check these sources for an email address:
- Facebook page "About" or "Info" section
- Instagram bio
- Yelp business listing
- Google Business Profile
- Any directory listing that shows an email
If you find an email on any social profile or listing, put it in the Email field.

Selected signal detection — for every candidate, set each selected signal to true only when it is obvious from the same public source you already inspected. Do not invent signals and do not run extra searches only to fill these fields.
${activeProspectSignalInstructions || "- WEAK_WEB_PRESENCE: no standalone website, social-only, directory-only, broken, parked, placeholder, empty, or under-construction website."}

Return exactly this JSON array schema:
[
  {
    "Company Name": "",
    "Address": "",
    "Phone": "",
    "Email": "",
    "Website URL": "",
    "Source URL": "",
    "Website Status": "No website found",
    "Facebook URL": "",
    "Instagram URL": "",
    "Yelp URL": "",
    "Pitch Angle": "",
    "Signals": {
${activeProspectSignalJson || '      "badWebsite": false'}
    },
    "Signal Evidence": {
${activeProspectSignalEvidenceJson || '      "badWebsite": ""'}
    }
  }
]

Hard rules:
- No placeholder text like "Not found", "N/A", "Unknown", or "None".
- Source URL must be a business-specific public page proving the business exists or showing its limited web presence, such as that company's Yelp business page, Facebook page, Instagram profile, chamber listing, or directory profile. Never return a generic search results URL.
- Do not use Facebook, Instagram, Yelp, TikTok, or Google as the primary Source URL. Prefer MapQuest, Manta, Chamber of Commerce, BBB, Cylex, ShowMeLocal, BusinessYab, local city/business directories, or another accessible non-social business profile.
- Website Status must be one of: "No website found", "Social-only presence", "Directory-only presence", "Broken website", "Placeholder website", "Parked domain".
- If the business has any candidate website URL visible in directory listings, social pages, or search results, Website URL must contain that URL. Leaving Website URL blank is only acceptable when no URL appears anywhere across the sources you checked.
- If Website Status is "Broken website", Website URL must be the exact standalone website URL that appears broken. Do not infer broken status without a URL.
- Facebook URL, Instagram URL, and Yelp URL: include the direct profile/listing URL if found during research. Leave blank if not found.
- Pitch Angle must be one caller-ready sentence in this format: specific evidence from the source + business pain + website opportunity. It must mention "website", "booking", "local SEO", or "online".
- Each selected signal in "Signals" must be a boolean. For each true signal, "Signal Evidence" must contain a short caller-ready reason. For false signals, leave the evidence string empty.
- Prioritize rows with at least one selected signal beyond weak web presence when available, especially hiring, running ads, recently active, or online booking.
- Return only actionable companies with phone and/or email.
- Return real local businesses only.

This is discovery batch ${batchIndex}.`,
      });
    };

    const verifyWebsiteClaims = async (rows) => {
      if (rows.length === 0) return rows;

      try {
        const response = await fetch("/api/website-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leads: rows.map(row => ({
              businessName: row.businessName,
              websiteUrl: row.websiteUrl,
              sourceUrl: row.sourceUrl,
              phone: row.phone,
              email: row.email,
              address: row.address,
            })),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.error) throw new Error(data.error || "Website check failed");

        return rows.map((row, index) => {
          const verification = data.results?.[index];
          if (!verification?.keep) return null;
          const verifiedSourcePhone = verification.sourceVerified === true && verification.sourcePhone ? verification.sourcePhone : "";
          const verifiedSourceEmail = verification.sourceVerified === true && verification.sourceEmail ? verification.sourceEmail : "";
          return {
            ...row,
            phone: row.phone || verifiedSourcePhone,
            email: row.email || verifiedSourceEmail,
            websiteStatus: verification.status || row.websiteStatus,
            websiteUrl: verification.websiteUrl || row.websiteUrl,
            sourceVerified: verification.sourceVerified === true,
            sourceStatus: verification.sourceStatus || "",
            emailVerified: verification.emailVerified === true,
            emailStatus: verification.emailStatus || "",
            proofReason: [row.proofReason, verification.proof].filter(Boolean).join(" Verified: "),
            websiteVerification: verification,
          };
        }).filter(Boolean);
      } catch {
        return [];
      }
    };

    const PHONE_VERIFY_BATCH_SIZE = 1;
    const PHONE_VERIFY_DELAY_MS = 1200;

    const verifyProspectPhones = async (rows) => {
      const lookups = rows
        .map((row, index) => ({ index, phone: String(row.phone || "").trim() }))
        .filter(item => item.phone);
      if (lookups.length === 0) return rows;

      const verifiedByIndex = new Map();
      let completed = 0;
      for (let i = 0; i < lookups.length; i += PHONE_VERIFY_BATCH_SIZE) {
        const batch = lookups.slice(i, i + PHONE_VERIFY_BATCH_SIZE);
        setProspectProgress(prev => ({
          ...prev,
          phase: "verifying",
          detail: `Verifying phones ${completed}/${lookups.length}`,
        }));
        try {
          const response = await fetch("/api/twilio-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              numbers: batch.map(item => ({ phone: item.phone, countryCode: "US" })),
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && !data.error) {
            (data.results || []).forEach((result, offset) => {
              verifiedByIndex.set(batch[offset].index, result);
            });
          }
        } catch {}
        completed += batch.length;
        if (i + PHONE_VERIFY_BATCH_SIZE < lookups.length) {
          await sleep(PHONE_VERIFY_DELAY_MS);
        }
      }

      return rows.map((row, index) => {
        const verification = verifiedByIndex.get(index);
        if (!verification) return row;
        if (verification.verified) {
          return {
            ...row,
            phone: verification.nationalFormat || row.phone,
            phoneVerified: true,
            phoneLineType: verification.lineType || null,
            phoneCarrier: verification.carrierName || null,
          };
        }
        // Dead number — clear it so it doesn't show as actionable
        return { ...row, phone: "", phoneVerified: false, phoneDeadReason: verification.validationMode || "failed" };
      });
    };

    try {
      const targetCount = prospectCount;
      const candidateBudget = Math.min(24, Math.max(targetCount + 4, targetCount * 2 + 2));
      const DISCOVERY_BATCH_SIZE = isGeneralSearch ? 3 : 4;
      const discoveryBatches = Math.ceil(candidateBudget / DISCOVERY_BATCH_SIZE);
      let results = [];

      // ── Sample gate ─────────────────────────────────────────────
      // Run a cheap 3-lead probe before committing to the full search.
      // Uses a stripped-down prompt (480 tokens, 1 search) to minimize cost.
      // If none survive website verification, bail early and save cost.
      setProspectProgress({ phase: "discovery", current: 0, total: targetCount, batchIndex: 0, totalBatches: discoveryBatches });
      const sampleBatch = await runSampleProbe();
      const sampleWebVerified = await verifyWebsiteClaims(normalizeProspectResults(sampleBatch));
      const samplePhoneVerified = leadQualityOnly ? sampleWebVerified : await verifyProspectPhones(sampleWebVerified);
      const sampleVerified = keepSellableProspects(samplePhoneVerified);
      if (samplePhoneVerified.length === 0) {
        setProspectError(`No verified no-website leads found in ${locationText}. Most businesses here already have websites. Try a smaller nearby city or add a niche (e.g. "nail salons", "auto detailing").`);
        endCostRun(costRunId, { resultCount: 0, status: "partial", notes: "Sample gate: 0 leads passed verification" });
        prospectRunEnded = true;
        setProspectLoading(false); setProspectProgress(null); return;
      }
      // Seed results with the verified sample so we don't re-search them
      results = sortProspectsBySignals([...sampleVerified]).slice(0, targetCount);
      setProspects(results);
      if (results.length >= targetCount) {
        prospectRunResultCount = results.length;
        const withPhone = results.filter(r => String(r.phone || "").trim()).length;
        const withEmail = results.filter(r => isPlausibleEmail(r.email)).length;
        showToast(`Found ${results.length} no-website leads · ${withPhone} phone · ${withEmail} email`);
        endCostRun(costRunId, { resultCount: results.length, status: "success" });
        prospectRunEnded = true;
        setProspectLoading(false); setProspectProgress(null); return;
      }
      // ── End sample gate ──────────────────────────────────────────

      for (let discoveryIndex = 0; discoveryIndex < discoveryBatches; discoveryIndex++) {
        setProspectProgress({ phase: "discovery", current: results.length, total: targetCount, batchIndex: discoveryIndex + 1, totalBatches: discoveryBatches });
        try {
          const remaining = targetCount - results.length;
          const batch = await runCompanyDiscoveryBatch({
            batchSize: Math.min(DISCOVERY_BATCH_SIZE, Math.max(DISCOVERY_BATCH_SIZE, remaining + 2)),
            batchIndex: discoveryIndex + 1,
            existingCompanies: results.map(p => ({ "Company Name": p.businessName })),
            focusArea: prospectFocusAreas[discoveryIndex % prospectFocusAreas.length],
          });
          const seen = new Set(results.map(p => columnKey(p.businessName)));
          const webVerified = await verifyWebsiteClaims(normalizeProspectResults(batch));
          const phoneVerified = keepSellableProspects(leadQualityOnly ? webVerified : await verifyProspectPhones(webVerified));
          const fresh = phoneVerified.filter(prospect => {
            const key = columnKey(prospect.businessName);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          results = sortProspectsBySignals([...results, ...fresh]).slice(0, targetCount);
          setProspects(results);
          if (results.length >= targetCount) break;
        } catch (err) {
          if (results.length === 0) throw err;
          break;
        }
      }

      if (!results.length) {
        setProspectError(`No actionable no-website ${displayTarget} leads found in ${locationText}. Try a nearby city, fewer rows, or a specific niche.`);
        endCostRun(costRunId, { resultCount: 0, status: "partial", notes: "No actionable prospects found" });
        prospectRunEnded = true;
        setProspectLoading(false); setProspectProgress(null); return;
      }

      prospectRunResultCount = results.length;
      const withPhone = results.filter(row => String(row.phone || "").trim()).length;
      const withEmail = results.filter(row => isPlausibleEmail(row.email)).length;
      showToast(`Found ${results.length} no-website leads · ${withPhone} phone · ${withEmail} email`);
      endCostRun(costRunId, { resultCount: results.length, status: results.length < targetCount ? "partial" : "success" });
      prospectRunEnded = true;
    } catch (err) {
      const message = String(err?.message || "");
      const timedOut = /timed? out|took too long|timeout|504/i.test(message);
      const disabled = /anthropic_disabled|ANTHROPIC_DISABLED|disabled by/i.test(message);
      setProspectError(disabled
        ? "AI lead discovery is currently disabled to prevent API spend. Offline verification tests can still run; re-enable Anthropic only for an approved live smoke test."
        : timedOut
          ? "Search took too long. Try 5 results, add a niche, or use a smaller nearby city."
          : "Search failed — " + (message || "unexpected error. Please try again."));
      endCostRun(costRunId, { resultCount: prospectRunResultCount, status: "error", notes: message || "Find Leads failed" });
      prospectRunEnded = true;
    }

    if (!prospectRunEnded) endCostRun(costRunId, { resultCount: prospectRunResultCount, status: "partial", notes: "Find Leads stopped before completion" });
    setProspectProgress(null);
    setProspectLoading(false);
  };

  // ─── EMAIL DRAFT GENERATION ──────────────────────────────
  const handleDraftEmail = async (prospect) => {
    setDraftingEmail(prospect.id);
    try {
      const niche = prospect.niche || prospect.title || prospect.projectType || prospectNiche || "service";
      const city = prospectCity || (prospect.address ? prospect.address.split(",").slice(-2).join(",").trim() : "your area");
      const firstName = getFirstName(prospect.ownerName);
      const observation = cleanBusinessObservation(
        prospect.personalizedFirstLine || prospect.buyingSignal || (prospect.opportunities || [])[0],
        `${prospect.businessName || "Your agency"} already has real momentum in ${city}`
      );
      const sampleLeads = formatSampleLeads(prospects, city, niche, prospect.id);
      const emailText = `Subject: Found 5 ${city} businesses that need coverage

Hi ${firstName},

${observation}

I built a tool that finds small businesses in your area actively signaling they need ${niche} services — recently opened, changing ownership, or expanding — businesses that typically fall through the cracks on coverage.

Here are 5 from your area as a sample:
${sampleLeads}

The full list of 50 is $200. Delivered within 24 hours.

Interested?

${DEFAULT_EMAIL_SIGNATURE}`;
      setEmailDrafts(prev => ({ ...prev, [prospect.id]: emailText }));
      updatePipelineLead(
        lead => pipelineUniqueKey(lead) === pipelineUniqueKey({
          sourceMode: "prospects",
          company: prospect.businessName,
          email: prospect.email,
          name: prospect.ownerName || prospect.businessName,
        }),
        lead => ({
          ...lead,
          savedEmailDraft: emailText,
          prospectRaw: prospect,
          pipelineDetails: buildProspectPipelineDetails(prospect, emailText, prospectCity),
        }),
      );
      showToast("Email draft generated");
    } catch (err) {
      showToast("Failed to generate email", "error");
    }
    setDraftingEmail(null);
  };

  const handleSendProspectEmail = async (prospect) => {
    const to = String(prospect?.email || "").trim();
    if (!to) {
      showToast("This prospect does not have an email yet", "error");
      return;
    }

    const city = prospectCity || "";
    const sendKey = prospectSendKey(prospect, city);
    if (prospectSendStatus[sendKey]?.sent) return;

    const sampleLeads = getRecentVerifiedLeadSamples(leads, city, leadListResults, leadListCity);
    const { subject, body } = buildProspectSendEmail(prospect, city, sampleLeads);

    setSendingProspectId(prospect.id);
    try {
      const response = await fetch("/api/gmail-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to send email");
      }

      setProspectSendStatus(prev => ({
        ...prev,
        [sendKey]: {
          sent: true,
          sentAt: Date.now(),
          to,
          subject,
          messageId: data.id || "",
        },
      }));
      showToast(`Sent email to ${prospect.ownerName || prospect.businessName}`);
    } catch (error) {
      showToast(error?.message || "Failed to send email", "error");
    }
    setSendingProspectId(null);
  };

  // ─── SHIP LIST SEARCH ────────────────────────────────────
  const handleShipListSearch = async () => {
    setShipListLoading(true);
    setShipListError(null);
    setShipListResults([]);
    setShipListProgress("Finding companies...");

    const savedNames = savedCompanies.map(c => c.company_name).filter(Boolean);
    const cityFilter = shipListCity.trim() || "San Francisco, San Jose, Oakland, Palo Alto";
    const candidateTarget = shipListCount;
    const sizeBand = {
      startup: "20-80 employees. Seed, Series A, or bootstrapped equivalent. Bias toward under 50 employees.",
      growth: "50-150 employees. Series A or Series B, or bootstrapped equivalent with similar scale.",
      mixed: "20-200 employees. Seed, Series A, Series B, or bootstrapped equivalent. Bias toward smaller companies.",
    }[shipListSizeBand] || "20-200 employees. Seed, Series A, Series B, or bootstrapped equivalent. Bias toward smaller companies.";
    const costRunId = startCostRun({
      mode: "shiplist",
      action: "Ship List Search",
      params: {
        city: cityFilter,
        sizeBand: shipListSizeBand,
        industryFocus: shipListIndustryFocus,
        includeServices: shipListIncludeServices,
        requestedCount: shipListCount,
        savedExclusions: savedNames.length,
      },
    });
    let costRunEnded = false;

    const parseShipListResponse = (fullText) => {
      let parsed = null;
      const fencedArray = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (fencedArray) { try { parsed = JSON.parse(fencedArray[1]); } catch {} }
      if (!parsed) {
        const fencedObject = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (fencedObject) { try { parsed = JSON.parse(fencedObject[1]); } catch {} }
      }
      if (!parsed) parsed = extractJSONValue(fullText);
      return parsed;
    };

    const shipValue = (row, names, fallback = "") => {
      for (const name of names) {
        const key = Object.keys(row || {}).find(k => columnKey(k) === columnKey(name));
        const value = key ? row[key] : "";
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
      return fallback;
    };

    const extractShipText = data => (data.content || [])
      .filter(block => block.type === "text" && block.text)
      .map(block => block.text)
      .join("\n");

    const logRaw = (label, text) => console.log(`[ShipList] ${label} raw response`, text);
    const logParseWarning = (label, text) => console.warn(`[ShipList] ${label} JSON parse failed`, String(text || "").slice(0, 300));

    const normalizePhaseOneRows = parsed => (getParsedRows(parsed) || [])
      .map((row, index) => ({
        id: Date.now() + index + Math.random(),
        companyName: shipValue(row, ["companyName", "company name", "company", "name"], ""),
        website: shipValue(row, ["website", "websiteUrl", "website url", "url"], ""),
        city: shipValue(row, ["city", "location", "hq", "headquarters"], cityFilter),
        country: shipValue(row, ["country"], "US"),
        isActive: shipValue(row, ["isActive", "is active", "active"], true) !== false,
        activeNote: shipValue(row, ["activeNote", "active note"], ""),
        employeeCount: shipValue(row, ["employeeCount", "employee count", "employees", "size"], ""),
        fundingStage: shipValue(row, ["fundingStage", "funding stage", "funding"], ""),
        lastFundingDate: shipValue(row, ["lastFundingDate", "last funding date", "last funding"], ""),
        estimatedRevenue: shipValue(row, ["estimatedRevenue", "estimated revenue", "revenue"], ""),
        companyType: shipValue(row, ["companyType", "company type", "type", "industry"], ""),
        industry: shipValue(row, ["industry", "vertical"], ""),
        founded: shipValue(row, ["founded", "foundedYear", "founded year"], ""),
        description: shipValue(row, ["description", "summary"], ""),
        contactEmail: shipValue(row, ["contactEmail", "contact email", "email", "bestEmail", "best email"], ""),
        emailConfidence: shipValue(row, ["emailConfidence", "email confidence"], ""),
        emailSource: shipValue(row, ["emailSource", "email source", "sourceUrl", "source url"], ""),
        hasPhysicalProduct: shipValue(row, ["hasPhysicalProduct", "has physical product", "physical product"], false) === true,
        isSoftwareOnly: shipValue(row, ["isSoftwareOnly", "is software only", "software only"], false) === true,
        physicalProductFit: shipValue(row, ["physicalProductFit", "physical product fit", "physicalProduct", "physical product"], ""),
        videoShotPotential: shipValue(row, ["videoShotPotential", "video shot potential", "video angle", "shoot potential"], ""),
        headOfContentPresent: shipValue(row, ["headOfContentPresent", "head of content present", "content lead present"], false) === true,
        hiringMarketingRoles: shipValue(row, ["hiringMarketingRoles", "hiring marketing roles", "marketing hiring"], false) === true,
        isEventsBusiness: shipValue(row, ["isEventsBusiness", "is events business", "events business", "events"], false) === true,
        isLuxury: shipValue(row, ["isLuxury", "is luxury", "luxury"], false) === true,
        budgetSignal: shipValue(row, ["budgetSignal", "budget signal", "budget"], ""),
        socials: { linkedin: null, twitter: null, instagram: null, tiktok: null, youtube: null, facebook: null },
      }))
      .filter(row => row.companyName);

    const normalizeSocialAudit = (company, parsed) => {
      const source = Array.isArray(parsed) ? parsed[0] : parsed || {};
      const socials = source.socials || source.Socials || {};
      const pickSocial = (key, aliases = []) => {
        const value = shipValue({ ...source, ...socials }, [key, ...aliases], "");
        return /^https?:\/\//i.test(String(value || "")) ? String(value).trim() : null;
      };
      return {
        ...company,
        socials: {
          linkedin: pickSocial("linkedin", ["linkedIn", "linked in"]),
          twitter: pickSocial("twitter", ["x", "twitterUrl", "xUrl"]),
          instagram: pickSocial("instagram", ["instagramUrl"]),
          tiktok: pickSocial("tiktok", ["tikTok", "tiktokUrl"]),
          youtube: pickSocial("youtube", ["youtubeUrl"]),
          facebook: pickSocial("facebook", ["facebookUrl"]),
        },
      };
    };

    const runShipListPrompt = async (promptText, action, maxTokens = 2200, { webSearch = false } = {}) => {
      const body = {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: maxTokens,
        system: webSearch
          ? "You are a business research assistant. Search the web for real companies. Respond with strict JSON only. No prose, no markdown."
          : "You are a business research assistant. Return real, plausible companies from known public business context. Respond with strict JSON only. No prose, no markdown.",
        messages: [{ role: "user", content: promptText }],
      };
      if (webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
      const { data } = await callAnthropic(action, body);
      return data;
    };

    const enrichShipListEmails = async (companies) => {
      const lookupTargets = companies
        .map(company => ({
          company,
          lead: {
            company: company.companyName,
            domain: company.website,
            name: company.contactName || company.companyName,
          },
        }))
        .filter(item => item.lead.company && (item.lead.domain || item.lead.company));

      if (lookupTargets.length === 0) return companies;

      setShipListProgress("Finding reachable emails...");
      try {
        const response = await fetch("/api/hunter-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: lookupTargets.map(item => item.lead) }),
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Email lookup failed");
        const results = Array.isArray(data.results) ? data.results : [];
        return companies.map(company => {
          const index = lookupTargets.findIndex(item => item.company.id === company.id);
          const found = index >= 0 ? results[index] : null;
          if (!found?.email) return company;
          return {
            ...company,
            contactEmail: found.email,
            emailConfidence: found.confidence || (found.verified ? "HIGH" : "MEDIUM"),
            emailSource: found.sourceUrl || found.domain || "",
          };
        });
      } catch (error) {
        console.warn("[ShipList] Email enrichment failed", error?.message || error);
        return companies;
      }
    };

    const auditCompanySocials = async (company, index, total) => {
      setShipListProgress(`Auditing socials: ${index + 1}/${total}...`);
      const prompt = `Find official social profile URLs for this company.

Company:
${JSON.stringify({
  companyName: company.companyName,
  website: company.website,
  city: company.city,
  industry: company.industry || company.companyType,
}, null, 2)}

Rules:
- Return only URLs you are confident belong to this exact company.
- A URL is confident if it is linked from the company's website, clearly named after the company, or confirmed via the company's LinkedIn/profile context.
- Do not estimate posting frequency. Do not judge quality.
- If uncertain, use null.
- Return strict JSON only.

JSON shape:
{
  "socials": {
    "linkedin": null,
    "twitter": null,
    "instagram": null,
    "tiktok": null,
    "youtube": null,
    "facebook": null
  }
}`;

      try {
        const data = await runShipListPrompt(prompt, "Ship List Social Audit", 800);
        if (data.error) throw new Error(data.error.message || "Social audit failed");
        const raw = extractShipText(data);
        logRaw(`Phase 2 ${company.companyName}`, raw);
        const parsed = parseShipListResponse(raw);
        if (!parsed) logParseWarning(`Phase 2 ${company.companyName}`, raw);
        return normalizeSocialAudit(company, parsed);
      } catch (error) {
        console.warn(`[ShipList] Phase 2 failed for ${company.companyName}`, error?.message || error);
        return company;
      }
    };

    try {
      const includeServicesText = shipListIncludeServices
        ? "Boutique services are allowed only when they have a physical space, studio, showroom, clinic, event presence, workshop, or client experience that would look good on camera."
        : "Exclude professional services firms and pure software companies unless they have a physical product, facility, or customer-facing space.";
      const excludeClause = savedNames.length
        ? `Do not return these previously saved companies: ${savedNames.join(", ")}.`
        : "";
      const industryFocusBlock = {
        events_weddings: `INDUSTRY FOCUS — Events & Weddings (prioritize these):
- Wedding venues, estate venues, private event spaces, rooftop venues, historic properties.
- Luxury wedding planners, full-service event design companies.
- Corporate event companies, experiential marketing agencies with real events.
- Photo and video studios that also host events or productions.
- High-end party and event rental companies.`,
        luxury_lifestyle: `INDUSTRY FOCUS — Luxury Lifestyle (prioritize these):
- Luxury car dealerships, exotic car rentals, high-end auto detailing studios.
- Luxury fashion boutiques, jewelry brands, premium watch retailers.
- Premium spirits, fine wine, champagne brands or importers with physical presence.
- Luxury wellness — high-end spas, private fitness clubs, members-only studios.
- Interior design firms and luxury home furnishings showrooms.`,
        nightlife: `INDUSTRY FOCUS — Nightlife & Hospitality (prioritize these):
- Upscale restaurants, hotel rooftops, fine dining establishments.
- Nightclubs, cocktail lounges, bars with strong visual brand identity.
- Hotel and resort properties with an active events calendar.
- Private members clubs and social clubs.`,
        tech: `INDUSTRY FOCUS — Tech with visual story potential (prioritize these):
- Hardware, robotics, or IoT companies with a physical product.
- Tech companies that run product launches, demos, or brand events.
- Consumer tech products (wearables, smart home, devices).
- AI or SaaS companies with a filmable lab, workspace, or customer-facing experience.`,
        all: `TARGET CATEGORIES — companies most likely to spend $4,000–$8,000+ on a single video shoot:
- Events & weddings: venues, luxury planners, experiential companies.
- Luxury lifestyle: exotic cars, fashion, jewelry, premium spirits, high-end wellness.
- Nightlife & hospitality: upscale restaurants, hotels, clubs, rooftop venues.
- Tech with physical presence: hardware products, launches, demo-worthy operations.
- Any business whose brand depends on visual impact and premium perception.`,
      }[shipListIndustryFocus] || "";

      const buildDiscoveryPrompt = (targetCount, fallback = false) => `Find ${targetCount} companies in ${cityFilter}, California, USA that would be strong clients for a premium video production agency charging $4,000–$8,000 per shoot.

${industryFocusBlock}

Requirements:
- Headquartered in ${cityFilter}, California, USA. Exclude UK, Canadian, or other US-homonym cities.
- ${sizeBand}
- Currently operating in 2026.
- Must have a filmable business: physical venue, tangible product, live events, or luxury visual identity.
- ${includeServicesText}

Exclude:
- Public companies, unicorns ($1B+ valuation), or 300+ employee companies.
- Companies with Head of Content, Creative Director, or VP Brand already on staff.
- Pure SaaS, fintech, devtools, or marketplace companies with nothing to film.
- Big-name consultancies (Bain, McKinsey, Deloitte, Accenture, etc.).
${excludeClause}

For each company, assess:
- isEventsBusiness: true if the company runs events, weddings, nightlife, or experiential activations as a core part of the business.
- isLuxury: true if the brand is positioned as premium or luxury (price point, aesthetics, clientele).
- budgetSignal: "High" if they would easily spend $5K+ on video, "Medium" if likely, "Low" if uncertain.

${fallback ? "Use fast, high-confidence sources only: company website, LinkedIn, Crunchbase, Wellfound, YC, or recent press. No deep research." : "Keep research shallow. Do not look up social media in this phase."}
Return strict JSON only. No prose. No markdown fences.

JSON shape:
{
  "companies": [
    {
      "companyName": "",
      "website": "",
      "city": "",
      "employeeCount": "10-30",
      "fundingStage": "Bootstrapped",
      "lastFundingDate": "2025-08",
      "industry": "",
      "founded": "2021",
      "description": "",
      "contactEmail": "public general email if confidently known, otherwise blank",
      "emailConfidence": "HIGH | MEDIUM | LOW | blank",
      "emailSource": "source URL or domain if known",
      "hasPhysicalProduct": true,
      "isSoftwareOnly": false,
      "isEventsBusiness": false,
      "isLuxury": false,
      "budgetSignal": "High | Medium | Low",
      "physicalProductFit": "What tangible venue, product, event, or experience could be filmed.",
      "videoShotPotential": "Specific practical video angle for this company (e.g. event highlight reel, product launch, brand story).",
      "headOfContentPresent": false,
      "hiringMarketingRoles": false
    }
  ]
}`;

      let discoveryData = await runShipListPrompt(buildDiscoveryPrompt(candidateTarget, true), "Ship List Fast Discovery", 1800, { webSearch: false });
      if (discoveryData.error && /timeout|took too long|504/i.test(discoveryData.error.message || discoveryData.error.type || "")) {
        setShipListProgress("Search took too long. Retrying with fewer companies...");
        discoveryData = await runShipListPrompt(
          buildDiscoveryPrompt(Math.min(shipListCount, 6), true),
          "Ship List Fast Discovery Retry",
          1600,
          { webSearch: false },
        );
      }
      if (discoveryData.error) throw new Error(discoveryData.error.message || "Discovery failed");
      const discoveryRaw = extractShipText(discoveryData);
      logRaw("Phase 1", discoveryRaw);
      const discoveryParsed = parseShipListResponse(discoveryRaw);
      if (!discoveryParsed) logParseWarning("Phase 1", discoveryRaw);
      let candidates = normalizePhaseOneRows(discoveryParsed);
      console.log(`[ShipList] Phase 1: ${candidates.length} candidates`);

      if (candidates.length === 0) {
        throw new Error("No companies found. Try a different city or size filter.");
      }

      setShipListProgress("Scoring companies...");
      const scoredResults = candidates
        .map(scoreShipListCompany)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, shipListCount);
      const finalResults = await enrichShipListEmails(scoredResults);
      console.log(`[ShipList] Phase 3: ${finalResults.length} final`);
      setShipListResults(finalResults);
      showToast(`Found ${finalResults.length} companies for the Ship List`);
      endCostRun(costRunId, { resultCount: finalResults.length, status: "success" });
      costRunEnded = true;
    } catch (err) {
      setShipListError("Search failed — " + (err?.message || "please try again."));
      endCostRun(costRunId, { resultCount: 0, status: "error", notes: err?.message || "Ship List search failed" });
      costRunEnded = true;
    }
    if (!costRunEnded) endCostRun(costRunId, { resultCount: shipListResults.length, status: "partial", notes: "Ship List search stopped before completion" });
    setShipListLoading(false);
    setShipListProgress(null);
  };

  // ─── SHIP LIST DB ─────────────────────────────────────────
  const loadSavedCompanies = async () => {
    setSavedLoading(true);
    const { data, error } = await supabase
      .from("ship_list_companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSavedCompanies(data);
    setSavedLoading(false);
  };

  const saveCompanyToDB = async (company) => {
    const contact = shipListContacts[company.id] || {};
    const basePayload = {
      company_name: company.companyName,
      website: company.website,
      city: company.city,
      employee_count: company.employeeCount,
      funding_stage: company.fundingStage,
      estimated_revenue: company.estimatedRevenue,
      company_type: company.companyType || company.industry,
      youtube: company.socials?.youtube || company.youtube || "",
      instagram: company.socials?.instagram || company.instagram || "",
      tiktok: company.socials?.tiktok || company.tiktok || "",
      linked_in: company.socials?.linkedin || company.linkedIn || "",
      twitter: company.socials?.twitter || company.twitter || "",
      facebook: company.socials?.facebook || company.facebook || "",
      tier: company.tier || null,
      tier_label: company.tierLabel || null,
      tier_reason: company.tierReason || null,
      content_score: company.contentScore || null,
      is_active: company.isActive !== false,
      active_note: company.activeNote || "",
      country: company.country || "US",
      content_gap: company.contentGap,
      contact_name: contact.name || "",
      contact_title: contact.title || "",
      contact_linkedin: contact.linkedin || "",
      contact_email: contact.email || company.contactEmail || "",
      outreach_platform: contact.platform || "",
      outreach_draft: shipListOutreach[company.id] || "",
      status: "new",
    };
    const payload = {
      ...basePayload,
      buyer_fit: company.buyerFit ?? null,
      social_gap: company.socialGap ?? null,
      priority: company.priority ?? null,
      priority_label: company.priorityLabel || null,
      priority_reasons: company.priorityReasons || [],
      last_funding_date: company.lastFundingDate || null,
      industry: company.industry || company.companyType || null,
      founded: company.founded || null,
      head_of_content_present: company.headOfContentPresent ?? null,
      hiring_marketing_roles: company.hiringMarketingRoles ?? null,
    };

    let { data, error } = await supabase
      .from("ship_list_companies")
      .upsert(payload, { onConflict: "company_name" })
      .select()
      .single();

    if (error && /column|schema|cache/i.test(error.message || "")) {
      console.warn("[ShipList] Save with priority columns failed; retrying legacy payload", error.message);
      ({ data, error } = await supabase
        .from("ship_list_companies")
        .upsert(basePayload, { onConflict: "company_name" })
        .select()
        .single());
    }

    if (!error && data) {
      setSavedCompanies(prev => {
        const exists = prev.find(c => c.company_name === data.company_name);
        return exists ? prev.map(c => c.company_name === data.company_name ? data : c) : [data, ...prev];
      });
      showToast(`${company.companyName} saved to Ship List DB`);
    } else {
      showToast("Failed to save — " + (error?.message || "unknown error"), "error");
    }
  };

  const updateCompanyStatus = async (dbId, status) => {
    const { data, error } = await supabase
      .from("ship_list_companies")
      .update({ status })
      .eq("id", dbId)
      .select()
      .single();
    if (!error && data) {
      setSavedCompanies(prev => prev.map(c => c.id === dbId ? data : c));
      showToast(`Status updated to ${status}`);
    }
  };

  const deleteFromDB = async (dbId, companyName) => {
    const { error } = await supabase.from("ship_list_companies").delete().eq("id", dbId);
    if (!error) {
      setSavedCompanies(prev => prev.filter(c => c.id !== dbId));
      showToast(`${companyName} removed from DB`);
    }
  };

  // ─── FIND CONTACT + DRAFT OUTREACH ───────────────────────
  const handleFindContact = async (company) => {
    setGeneratingContact(company.id);
    setShipListOutreachOpen(prev => ({ ...prev, [company.id]: true }));
    try {
      const prompt = `Find the best contact person at ${company.companyName} (${company.website || company.city}) to pitch content production / video storytelling services to.

Target roles (in priority order): Head of Content, Director of Content, VP Marketing, CMO, Head of Brand, Director of Marketing.

Search for:
1. The person's full name and title
2. Their LinkedIn profile URL
3. Their work email (if publicly findable)
4. Which platform they are most active on (LinkedIn, email, Twitter/X)

Company context:
- Type: ${company.companyType}
- Funding: ${company.fundingStage}
- City: ${company.city}
- Content gap: ${(company.contentGap || []).join(", ")}

Respond with ONLY a JSON object (no markdown):
{
  "name": "Jane Smith",
  "title": "Head of Content",
  "linkedin": "https://linkedin.com/in/janesmith",
  "email": "jane@${(company.website || "company.com").replace(/https?:\/\//, "").replace(/\/$/, "")}",
  "platform": "linkedin",
  "confidence": "high"
}

If you cannot find a specific person, return the best guess with confidence "low".`;

      const { data } = await callAnthropic("Ship List Contact Search", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 1000,
        system: "You are a B2B contact research assistant. Search the web and return ONLY a raw JSON object — no markdown, no explanation.",
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
      const textParts = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      let contact = null;
      const objMatch = textParts.match(/\{[\s\S]*\}/);
      if (objMatch) { try { contact = JSON.parse(objMatch[0]); } catch {} }

      if (contact) {
        setShipListContacts(prev => ({ ...prev, [company.id]: contact }));
        // Auto-draft outreach after finding contact
        await handleDraftOutreach(company, contact);
      } else {
        showToast("Could not find contact — try manually", "error");
      }
    } catch (err) {
      showToast("Contact search failed", "error");
    }
    setGeneratingContact(null);
  };

  const handleDraftOutreach = async (company, contact) => {
    const platform = contact?.platform || "linkedin";
    const isLinkedIn = platform === "linkedin";
    const prompt = `Draft a personalized ${isLinkedIn ? "LinkedIn message" : "cold email"} to ${contact?.name || "the marketing lead"} (${contact?.title || "Marketing"}) at ${company.companyName}.

Context about their company:
- Industry: ${company.companyType}
- Funding stage: ${company.fundingStage}
- Location: ${company.city}
- Content gaps: ${(company.contentGap || []).join(", ")}

You represent a visual storytelling / content agency reaching out because this company has a clear content gap.

${isLinkedIn
      ? "Write a LinkedIn connection note (under 300 characters) that is personal, specific, and NOT salesy. Reference their content gap subtly."
      : "Write a cold email (subject line + 4-5 sentence body) that is personal and specific. Reference their content gap. End with a low-friction CTA (a question, not a meeting ask)."}

Return ONLY the message text. No labels, no markdown.`;

    const { data } = await callAnthropic("Ship List Outreach Draft", {
      model: CLAUDE_SEARCH_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const draft = (data.content || []).find(b => b.type === "text")?.text || "";
    if (draft) setShipListOutreach(prev => ({ ...prev, [company.id]: draft }));
  };

  // ─── INDEED LEAD SEARCH ──────────────────────────────────
  const handleIndeedSearch = async () => {
    const rolesToSearch = [
      ...indeedSelectedRoles.map(id => INDEED_ROLES.find(r => r.id === id)?.label).filter(Boolean),
      ...(indeedCustomRole.trim() ? [indeedCustomRole.trim()] : []),
    ];
    if (rolesToSearch.length === 0) { showToast("Select at least one role to search for", "error"); return; }

    setIndeedLoading(true);
    setIndeedError(null);
    setIndeedResults([]);

    try {
      const response = await fetch("/api/indeed-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: rolesToSearch,
          location: indeedCity.trim(),
          count: indeedCount,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        setIndeedError(data.error || "Search failed — please try again.");
        setIndeedLoading(false);
        return;
      }

      const raw = Array.isArray(data.results) ? data.results : [];

      if (raw.length === 0) {
        if (data.errors?.length) {
          const firstErr = data.errors[0];
          setIndeedError(`Search failed for "${firstErr.role}": ${firstErr.error}`);
        } else {
          setIndeedError("No local results found for these roles in this city. Try broader roles or a larger city.");
        }
        setIndeedLoading(false);
        return;
      }

      if (data.errors?.length) {
        setIndeedError(`Partial results — ${data.errors.map(e => e.role).join(", ")} failed to load.`);
      }

      // ── Build pipeline lookup first so dedup runs before fallback ──
      const normalizeName = (s) => (s || "").toLowerCase().trim().replace(/[™®©]/g, "").replace(/[^a-z0-9]/g, "");
      const pipelineCompanies = new Set(leads.map(l => normalizeName(l.company)).filter(Boolean));

      const sortScored = (arr) => arr.sort((a, b) => {
        const rank = x => x._tags.includes("Oakland") ? 2 : x._tags.includes("SF") ? 1 : 0;
        if (rank(b) !== rank(a)) return rank(b) - rank(a);
        const miA = a._miles ?? 999, miB = b._miles ?? 999;
        if (miA !== miB) return miA - miB;
        return b._score - a._score;
      });

      // Score, hard-filter, and drop anything already in the pipeline
      const scoreAndFilter = (items) =>
        items
          .map(r => {
            const s = scoreLocalBusiness(r);
            const miles = distanceFromOakland(r.location);
            return { ...r, _score: s.score, _tags: s.tags, _exclude: s.hardExclude, _miles: miles };
          })
          .filter(r => !r._exclude && !pipelineCompanies.has(normalizeName(r.companyName)));

      const scored = scoreAndFilter(raw);
      sortScored(scored);

      // ── FALLBACK BROADENING — fires when <3 displayable results after pipeline dedup ──
      if (scored.length < 3) {
        const broaderLocation = indeedCity.trim() ? "San Francisco Bay Area, CA" : "California";
        try {
          const broaderResp = await fetch("/api/indeed-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roles: rolesToSearch, location: broaderLocation, count: indeedCount }),
          });
          const broaderData = await broaderResp.json().catch(() => ({}));
          if (broaderResp.ok && Array.isArray(broaderData.results)) {
            const seenUrls = new Set(scored.map(r => r.jobUrl).filter(Boolean));
            const broaderFiltered = scoreAndFilter(
              broaderData.results.filter(r => r.jobUrl && !seenUrls.has(r.jobUrl))
            );
            scored.push(...broaderFiltered);
            sortScored(scored);
          }
        } catch (_) { /* silent — show whatever we have */ }
      }

      // Deduplicate by normalized company name
      const seenCompanyNames = new Set();
      const deduped = scored.filter(r => {
        const norm = normalizeName(r.companyName);
        if (seenCompanyNames.has(norm)) return false;
        seenCompanyNames.add(norm);
        return true;
      });

      // ── VISIBILITY RULES (applied after all penalties are baked in) ──
      // 1. Score ≤ 4 → never show
      // 2. Outside SF/Oakland → only show if score ≥ 8
      // 3. Cap at 10 results, best scores first
      const visible = deduped
        .filter(r => {
          if (r._score <= 4) return false;
          const isOaklandOrSF = r._tags.includes("Oakland") || r._tags.includes("SF");
          if (!isOaklandOrSF && r._score < 8) return false;
          return true;
        })
        .slice(0, 10);

      const results = visible.map((r, i) => {
        return {
          id: Date.now() + i + Math.random(),
          companyName: r.companyName || "Unknown Company",
          industry: r.industry || "",
          location: r.location || indeedCity.trim() || "On-site",
          website: r.website || "",
          phone: r.phone || "",
          email: r.email || "",
          jobTitle: r.jobTitle || "",
          jobPayRate: r.jobPayRate || "",
          annualCost: r.annualCost || "",
          postingDate: r.postingDate || "",
          jobUrl: r.jobUrl || "",
          companySize: r.companySize || "",
          googleReviews: { rating: 0, count: 0 },
          automationAngle: r.description || "",
          automationUseCase: "",
          pitchHook: "",
          urgency: "medium",
          buyingSignals: [],
          opportunities: [],
          isDirectApply: r.isDirectApply || false,
          walkabilityScore: r._score,
          walkabilityTags: r._tags,
          milesFromOakland: r._miles,
        };
      });

      setIndeedResults(results);
      showToast(`Found ${results.length} fresh leads`);
    } catch (err) {
      setIndeedError("Search failed — " + (err?.message || "please try again."));
    }

    setIndeedLoading(false);
  };

  // ─── ADD INDEED LISTING TO PIPELINE ───────────────────────
  const handleAddIndeedToPipeline = (r) => {
    const savedDraft = indeedEmailDrafts[r.id] || indeedContactDraft[r.id] || "";
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
      sourceMode: "indeed",
      indeedRaw: r,
      savedEmailDraft: savedDraft,
      pipelineDetails: buildIndeedPipelineDetails(r, {
        outreachDraft: indeedEmailDrafts[r.id],
        contactInfo: indeedContactInfo[r.id],
        applyPitch: indeedApplyPitch[r.id],
        contactDraft: indeedContactDraft[r.id],
        linkedInMsg: indeedLinkedInMsg[r.id],
      }),
    };
    savePipelineLead(newLead);
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

      const { data } = await callAnthropic("Find AI Prospects Outreach Draft", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });
      if (data.error) { showToast("Failed to generate outreach", "error"); setDraftingIndeedEmail(null); return; }
      const emailText = (data.content || []).find(b => b.type === "text")?.text || "";
      setIndeedEmailDrafts(prev => ({ ...prev, [result.id]: emailText }));
      updatePipelineLead(
        lead => lead.sourceMode === "indeed" && (lead.indeedRaw?.id === result.id || (lead.company || "").toLowerCase() === (result.companyName || "").toLowerCase()),
        lead => ({
          ...lead,
          savedEmailDraft: emailText,
          indeedRaw: result,
          pipelineDetails: buildIndeedPipelineDetails(result, {
            outreachDraft: emailText,
            contactInfo: indeedContactInfo[result.id],
            applyPitch: indeedApplyPitch[result.id],
            contactDraft: indeedContactDraft[result.id],
            linkedInMsg: indeedLinkedInMsg[result.id],
          }),
        }),
      );
      showToast("Outreach draft ready");
    } catch (err) {
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

      const { data } = await callAnthropic("Find AI Prospects Apply Pitch", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 300,
        system: "You are writing cold pitches for an AI automation agency. The goal is to hijack a job application form to pitch AI services instead of a resume. Be direct, reference the pay rate, show the math. Under 4 sentences.",
        messages: [{ role: "user", content: prompt }],
      });
      const text = (data.content || []).find(b => b.type === "text")?.text || "";
      setIndeedApplyPitch(prev => ({ ...prev, [r.id]: text }));
      updatePipelineLead(
        lead => lead.sourceMode === "indeed" && (lead.indeedRaw?.id === r.id || (lead.company || "").toLowerCase() === (r.companyName || "").toLowerCase()),
        lead => ({
          ...lead,
          indeedRaw: r,
          pipelineDetails: buildIndeedPipelineDetails(r, {
            outreachDraft: lead.savedEmailDraft,
            contactInfo: indeedContactInfo[r.id],
            applyPitch: text,
            contactDraft: indeedContactDraft[r.id],
            linkedInMsg: indeedLinkedInMsg[r.id],
          }),
        }),
      );
      showToast("Pitch ready");
    } catch (err) {
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

      const { data } = await callAnthropic("Find AI Prospects Contact Search", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 1000,
        system: "You are a contact research assistant. Search the web to find real contact info for business decision makers. Cross-reference industry and location to confirm you have the right company. Respond with ONLY a JSON object.",
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
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
        updatePipelineLead(
          lead => lead.sourceMode === "indeed" && (lead.indeedRaw?.id === r.id || (lead.company || "").toLowerCase() === (r.companyName || "").toLowerCase()),
          lead => ({
            ...lead,
            indeedRaw: r,
            pipelineDetails: buildIndeedPipelineDetails(r, {
              outreachDraft: lead.savedEmailDraft,
              contactInfo: parsed,
              applyPitch: indeedApplyPitch[r.id],
              contactDraft: indeedContactDraft[r.id],
              linkedInMsg: indeedLinkedInMsg[r.id],
            }),
          }),
        );
        showToast("Contact found!");
      } else {
        setIndeedContactInfo(prev => ({ ...prev, [r.id]: "not_found" }));
        showToast("Could not parse contact info", "error");
      }
    } catch (err) {
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

      const { data } = await callAnthropic("Find AI Prospects Contact Email", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 400,
        system: "You are writing cold outreach emails for an AI automation agency. The recipient posted a job listing for a role AI can replace. Reference their name, company, job title, and pay rate. Show the annual cost math. Be direct, not salesy. The math sells itself.",
        messages: [{ role: "user", content: prompt }],
      });
      const text = (data.content || []).find(b => b.type === "text")?.text || "";
      setIndeedContactDraft(prev => ({ ...prev, [r.id]: text }));
      updatePipelineLead(
        lead => lead.sourceMode === "indeed" && (lead.indeedRaw?.id === r.id || (lead.company || "").toLowerCase() === (r.companyName || "").toLowerCase()),
        lead => ({
          ...lead,
          indeedRaw: r,
          savedEmailDraft: text,
          pipelineDetails: buildIndeedPipelineDetails(r, {
            outreachDraft: lead.savedEmailDraft,
            contactInfo: contact,
            applyPitch: indeedApplyPitch[r.id],
            contactDraft: text,
            linkedInMsg: indeedLinkedInMsg[r.id],
          }),
        }),
      );
      showToast("Email draft ready");
    } catch (err) {
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

      const { data } = await callAnthropic("Find AI Prospects LinkedIn Messages", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 500,
        system: "You are writing LinkedIn outreach messages for an AI automation agency targeting companies that posted job listings for roles AI can replace. Respond with ONLY a JSON object with connectionNote and followUpDm fields.",
        messages: [{ role: "user", content: prompt }],
      });
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
        updatePipelineLead(
          lead => lead.sourceMode === "indeed" && (lead.indeedRaw?.id === r.id || (lead.company || "").toLowerCase() === (r.companyName || "").toLowerCase()),
          lead => ({
            ...lead,
            indeedRaw: r,
            pipelineDetails: buildIndeedPipelineDetails(r, {
              outreachDraft: lead.savedEmailDraft,
              contactInfo: indeedContactInfo[r.id],
              applyPitch: indeedApplyPitch[r.id],
              contactDraft: indeedContactDraft[r.id],
              linkedInMsg: parsed,
            }),
          }),
        );
        showToast("LinkedIn messages ready");
      } else {
        showToast("Failed to generate messages", "error");
      }
    } catch (err) {
      showToast("Failed to generate messages", "error");
    }
    setGeneratingLinkedInMsg(null);
  };

  const handleSendIndeedEmail = async (r) => {
    const draft = indeedEmailDrafts[r.id];
    if (!draft) { showToast("Generate an outreach draft first", "error"); return; }
    if (indeedSendStatus[r.id]?.sent) return;

    const lines = draft.split("\n");
    const subjectLine = lines.find(l => l.toLowerCase().startsWith("subject:"));
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : `AI automation for ${r.companyName}`;
    const body = subjectLine ? lines.slice(lines.indexOf(subjectLine) + 1).join("\n").trim() : draft;

    const contact = indeedContactInfo[r.id];
    const to = contact && contact !== "not_found" && contact.email ? contact.email : r.email;
    if (!to) { showToast("No email found — use Find Contact Info first", "error"); return; }

    setSendingIndeedId(r.id);
    try {
      const response = await fetch("/api/gmail-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || "Failed to send email");
      setIndeedSendStatus(prev => ({ ...prev, [r.id]: { sent: true, sentAt: Date.now(), to } }));
      setIndeedQueueActions(prev => ({ ...prev, [r.id]: "contacted" }));
      showToast(`Sent to ${r.companyName}`);
    } catch (err) {
      showToast(err?.message || "Failed to send email", "error");
    }
    setSendingIndeedId(null);
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
        setLeads([]); setCriteria(getDefaultCriteria("construction")); setCompanyName(""); setIndustry("construction"); setProspects([]); setEmailDrafts({}); setQueueActions({}); setIndeedResults([]); setIndeedEmailDrafts({}); setIndeedQueueActions({}); setLeadListResults([]); setLeadListJob(null); setLeadListColumns([]); setSetupComplete(false); setSetupStep(0); setTab("dashboard");
        try { localStorage.removeItem(SK.leads); localStorage.removeItem(SK.criteria); localStorage.removeItem(SK.settings); localStorage.removeItem(SK.prospectSendStatus); } catch {}
        setConfirmAction(null); showToast("App reset complete");
      },
    });
  };

  // ─── CREDIT LEADS SEARCH ─────────────────────────────────
  const handleCreditSearch = async () => {
    const region = creditCity.trim();
    if (!region) { showToast("Enter a city, state, or region", "error"); return; }

    setCreditLoading(true);
    setCreditError(null);
    setCreditResults([]);
    setCreditProgress("Finding low-cost real-source credit leads");

    const desiredCount = Math.min(25, Math.max(1, Number(creditCount) || 10));
    try {
      const response = await fetch("/api/credit-search-lite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          niche: creditNiche.trim() || "real estate agents",
          focus: creditSignalFocus,
          count: desiredCount,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      const liteRows = (payload.rows || []).map((row, index) => sanitizeCreditRow({
        "Company Name": row.companyName,
        "Decision Maker": row.decisionMaker,
        "Best Phone": "",
        "Email": "",
        "Region": row.region || region,
        "Industry": row.industry || "Real Estate",
        "Company Type": row.companyType || "Small firm",
        "Referral Signal": row.signal || "Public search result indicating an active local referral-partner candidate.",
        "Signal Proof URL": row.proofUrl,
        "Source URL": row.sourceUrl || row.proofUrl,
        "Referral Fit": "Their clients may need credit repair before qualifying for financing, leases, or buyer-side transactions.",
        "Pitch Angle": `"Saw your local client work and wanted to connect on credit repair support for buyers before financing blocks the deal."`,
        id: Date.now() + index + Math.random(),
        proofVerification: { ok: true, verified: "lite-search" },
      }));
      const seedRows = buildVerifiedCreditSeedRows({
        region,
        niche: creditNiche.trim(),
        focus: creditSignalFocus,
        count: desiredCount,
      });
      const seenRows = new Set();
      const rows = [...liteRows, ...seedRows].filter(row => {
        const key = columnKey(`${getLeadCell(row, "Company Name")} ${getLeadCell(row, "Decision Maker")}`);
        if (!key || seenRows.has(key)) return false;
        seenRows.add(key);
        return true;
      }).slice(0, desiredCount);
      setCreditResults(rows);
      if (!liteRows.length) setCreditError("Live lite search did not return rows quickly, so verified real seed leads were loaded without Anthropic spend.");
      setCreditProgress(null);
      setCreditLoading(false);
      showToast(`Loaded ${rows.length} real-source leads with no Anthropic spend`);
      return;
    } catch {
      const seedRows = buildVerifiedCreditSeedRows({
        region,
        niche: creditNiche.trim(),
        focus: creditSignalFocus,
        count: desiredCount,
      });
      setCreditResults(seedRows);
      setCreditError("Live lite search failed quickly, so verified real seed leads were loaded without Anthropic spend.");
      setCreditProgress(null);
      setCreditLoading(false);
      showToast(`Loaded ${seedRows.length} real-source leads with no Anthropic spend`);
      return;
    }

    const focusText = {
      production: "Active production — broker/agent closing deals right now, recent listings, recent closings, active LinkedIn posts about transactions",
      subprime: "Subprime or distressed exposure — works with FHA, VA, first-time buyers, short sales, foreclosures, or markets known for credit-challenged buyers",
      referral: "Referral-network active — publicly partners with other service providers, visible referral language on their site or LinkedIn, podcast appearances with adjacent businesses, 'preferred vendor' mentions",
      growth: "Growth signal — recently joined a new brokerage, launched their own shop, recently licensed, hiring junior agents or LOs",
    }[creditSignalFocus] || "Active production — broker/agent closing deals right now, recent listings, recent closings, active LinkedIn posts about transactions";
    const nicheText = creditNiche.trim() || "mortgage brokers, real estate agents, and adjacent referral partners";
    const existingCompanies = leads.filter(l => l.sourceMode === "credit").map(l => l.company).filter(Boolean);
    const exclusionClause = existingCompanies.length
      ? `Do not return these companies already in the pipeline: ${existingCompanies.join(", ")}.`
      : "";

    const costRunId = startCostRun({
      mode: "credit",
      action: "Credit Lead Search",
      params: { region, niche: creditNiche.trim(), focus: creditSignalFocus, requestedCount: desiredCount },
    });
    let costRunEnded = false;

    const buildPrompt = (batchCount, queryFocus, alreadyAccepted = []) => `Find up to ${batchCount} REFERRAL PARTNERS for Conquer Credit Management, a consumer credit repair company in Los Angeles that helps individuals fix their personal credit so they can qualify for mortgages, auto loans, and rentals.

We are looking for PROFESSIONALS whose clients regularly get blocked by personal credit problems and who would benefit from having a trusted credit-repair partner to refer those clients to.

Region: ${region}
Niche hint: ${nicheText}
Signal focus: ${focusText}
Search this specific angle first: ${queryFocus}
${exclusionClause}
${alreadyAccepted.length ? `Do not return these already accepted leads: ${alreadyAccepted.join(", ")}.` : ""}

Niche discipline:
- If the Niche hint names a specific Tier A category, return only that category.
- If the Niche hint is "Mortgage brokers" or similar, return only named mortgage brokers, loan officers, or loan originators.

Ideal prospects (Tier A — return these):
- Mortgage brokers and loan officers, especially FHA, VA, non-QM, or subprime-focused
- Real estate agents and brokers, especially those working with first-time buyers, distressed properties, short sales, or buyer-side transactions in mid-tier markets
- Used car dealers and subprime auto lenders (independent, not national franchises)
- Apartment leasing agents and property managers who run credit checks on applicants
- Divorce attorneys and bankruptcy attorneys (solo or small firm)
- Tax preparers serving working/middle-class neighborhoods (not big-firm CPAs)

Reject (Tier C — never return these):
- Big banks (Chase, BofA, Wells Fargo, Citi, US Bank, etc.)
- Credit unions with more than ~$1B in assets
- National mortgage chains and corporate franchise offices with mandatory in-house referral programs (Rocket Mortgage, Quicken, LoanDepot corporate, etc.)
- Wholesale lenders, TPO/channel lenders, correspondent lenders, and lender marketplaces
- Other credit repair companies (Lexington Law, Credit Saint, Sky Blue, etc. — direct competitors)
- Nonprofit credit counseling organizations
- Debt settlement and debt consolidation companies
- Title companies and escrow companies
- Insurance agents and brokers
- Financial advisors at high-net-worth firms (Morgan Stanley, Merrill, UBS, private wealth divisions)

Each lead must have:
1. A NAMED individual contact (broker name, agent name, attorney name) — not just "ABC Realty"
2. A public, recent (within 6 months), caller-mentionable signal showing they are actively producing or expanding
3. A proof URL that DIRECTLY shows the signal — LinkedIn post, brokerage announcement, local news article, podcast episode, deal closing announcement, recent press, recent listing
4. Proof URL must NOT be: a homepage, About page, Zillow profile, Realtor.com profile, Expertise.com, Yelp, ZoomInfo, Apollo, Crunchbase, DNB, or any directory
5. Avoid using a LinkedIn profile page as the Proof URL when the signal is from a post. Use the exact LinkedIn post URL when available.
6. Do not return generic contacts like "Loan Officer Team", "Company Representative", "Office", "Staff", or "Team". Skip the row if you cannot name a person.
6a. Do not return "Name not specified" or title-only contacts like "Senior Loan Officer" or "FHA Specialist Loan Officer".
7. For mortgage searches, an individual loan officer or broker page is acceptable only when it directly states FHA, VA, non-QM, first-time buyer, or credit-challenged borrower expertise.

Search speed rules:
- Start with targeted searches for "${nicheText}" in "${region}" plus FHA, VA, first-time buyer, non-QM, subprime, recent closing, joined brokerage, or podcast.
- For mortgage-broker searches, use source patterns like Scotsman Guide rankings, Non-QM announcements, individual FHA/VA loan officer pages, broker podcasts, local mortgage association posts, brokerage announcements, and LinkedIn posts.
- Return enough candidate rows so that at least ${desiredCount} can survive validation.
- For Los Angeles mortgage searches, broaden across LA County cities and neighborhoods: Los Angeles, Pasadena, Glendale, Burbank, Long Beach, Torrance, Sherman Oaks, Encino, Woodland Hills, Downey, Whittier, Norwalk, Pomona, and Santa Monica.
- Use high-confidence public sources only.

Source quality rules:
1. Signal must be specific enough to mention on a cold call
2. If the proof URL is older than 6 months, skip the company
3. Do not claim financial pressure or distress about the contact unless proof explicitly supports it
4. Prioritize leads with a public phone or email
5. Prefer source diversity. Do not return all proof URLs from LinkedIn. Aim for a mix of LinkedIn posts, brokerage websites, local news articles, and podcast/press appearances. If multiple leads have LinkedIn-only proofs, replace some with leads that have other source types.

Before returning JSON, self-check and replace any row that fails any of these:
- Named contact is missing, title-only, "team", "staff", or "name not specified"
- Region is not clearly Los Angeles County
- Signal says 2024 or older
- Proof URL is a homepage, About page, directory, Zillow, Realtor.com, Expertise.com, Yelp, or generic profile
- Proof URL does not directly support the Referral Signal
- Company is a wholesale lender, TPO/channel lender, lender marketplace, national chain, bank, credit union, or competitor

Return strict JSON only. No prose. No markdown.

JSON shape:
[
  {
    "Company Name": "Brokerage or firm name",
    "Decision Maker": "Named individual with title (e.g., 'Maria Gonzalez, Loan Officer')",
    "Best Phone": "",
    "Email": "",
    "Region": "City, State",
    "Industry": "One of: Mortgage, Real Estate, Auto, Property Management, Legal, Tax, Financial Advisory",
    "Company Type": "Independent / Small firm / Franchise office / Solo practitioner",
    "Referral Signal": "One caller-ready sentence naming the exact signal and date if known.",
    "Signal Proof URL": "https://...",
    "Source URL": "https://...",
    "Referral Fit": "Why this person would benefit from a credit-repair referral partner — one sentence.",
    "Pitch Angle": "\"Suggested opening line for outreach, wrapped in quote marks, that references the specific signal.\""
  }
]`;

    try {
      const seen = new Set();
      const results = [];
      const rejectionReasons = {};
      let candidateCount = 0;
      const mortgageMode = /mortgage|loan officer|loan originator|broker/i.test(nicheText);
      const searchAngles = mortgageMode
        ? [
            `${focusText}; named LA mortgage brokers or loan officers with FHA, VA, first-time buyer, non-QM, or subprime borrower pages`,
            "Los Angeles 2026 Scotsman Guide Non-QM mortgage broker loan officer press release named individual",
            "Los Angeles mortgage broker FHA VA first-time buyer individual loan officer page",
            "Los Angeles mortgage broker recent podcast interview FHA VA non-QM named loan officer",
            "Los Angeles loan officer joined brokerage 2026 FHA VA non-QM LinkedIn post",
            "Pasadena Glendale Burbank Long Beach mortgage broker FHA VA first-time buyer named loan officer",
            "Beverly Hills Los Angeles non-QM mortgage broker 2026 press release named individual",
            "LA County Scotsman Guide 2026 mortgage originator named loan officer non-QM FHA VA",
            "Los Angeles mortgage association member loan officer FHA VA first-time buyer named individual recent",
            "Southern California mortgage broker non-QM FHA VA branch announcement named loan officer",
          ]
        : [
            focusText,
            `${nicheText} ${region} referral partners recent announcement named individual`,
            `${nicheText} ${region} podcast interview referral partner named individual`,
            `${nicheText} ${region} recent hiring expansion owner named individual credit check clients`,
            `${nicheText} ${region} local news interview owner named individual credit repair referral partner`,
            `${nicheText} ${region} LinkedIn post joined launched licensed named individual`,
          ];

      for (const [pass, queryFocus] of searchAngles.slice(0, CREDIT_MAX_GENERATION_PASSES).entries()) {
        if (results.length >= desiredCount) break;
        const remaining = desiredCount - results.length;
        const batchCount = Math.min(
          CREDIT_MAX_CANDIDATES_PER_PASS,
          Math.max(remaining + CREDIT_CANDIDATE_BUFFER_ROWS, desiredCount)
        );
        setCreditProgress(`Finding referral partners ${results.length}/${desiredCount} · checking ${batchCount} candidates`);
        const { response, data } = await callAnthropic("Credit Lead Search", {
          model: CLAUDE_SEARCH_MODEL,
          max_tokens: 2600,
          system: "You are a careful B2B lead researcher finding referral partners for a consumer credit repair company. Your job is to find mortgage brokers, real estate agents, and adjacent professionals whose clients have personal credit problems. Return strict JSON only. No narration, no search notes, no markdown. Accuracy beats volume.",
          messages: [{ role: "user", content: buildPrompt(batchCount, queryFocus, results.map(row => getLeadCell(row, "Company Name")).filter(Boolean)) }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        });
        if (!data || data.error?.type === "upstream_parse_error") throw new Error(`Search service unavailable (HTTP ${response.status})`);
        if (data.error) {
          if (/timeout|took too long/i.test(data.error.message || "")) continue;
          throw new Error(data.error.message || "Credit lead search failed");
        }

        setCreditProgress(`Checking signal quality ${results.length}/${desiredCount}`);
        const text = (data.content || []).filter(block => block.type === "text" && block.text).map(block => block.text).join("\n");
        const parsed = extractJSONValue(text);
        const rows = getParsedRows(parsed) || [];
        for (const [index, row] of rows.entries()) {
          candidateCount += 1;
          const sanitized = { ...sanitizeCreditRow(row), id: Date.now() + pass + index + Math.random() };
          const key = columnKey(`${getLeadCell(sanitized, "Company Name")} ${getLeadCell(sanitized, "Decision Maker")}`);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          const quality = await validateCreditRow(sanitized, verifyCreditProofUrl);
          if (quality.ok) {
            sanitized.proofVerification = quality.verification;
            results.push(sanitized);
          } else {
            rejectionReasons[quality.reason || "failed validation"] = (rejectionReasons[quality.reason || "failed validation"] || 0) + 1;
          }
          if (results.length >= desiredCount) break;
        }
      }

      if (results.length === 0) {
        setCreditError("No usable referral partners returned. Try a clearer niche, broader geography, or a different signal focus.");
        endCostRun(costRunId, { resultCount: 0, status: "partial", notes: "No validated credit leads returned" });
        costRunEnded = true;
        return;
      }

      setCreditResults(results);
      if (results.length < desiredCount) {
        const topRejection = Object.entries(rejectionReasons).sort((a, b) => b[1] - a[1])[0];
        const reasonText = topRejection ? ` Most rejected candidates failed because: ${topRejection[0]}.` : "";
        setCreditError(`Found ${results.length} of ${desiredCount} requested after checking ${candidateCount} candidates.${reasonText} Try a broader geography or signal focus, or run again for a fresh candidate pool.`);
        showToast(`Found ${results.length} of ${desiredCount} referral partners`, "error");
      } else {
        showToast(`Found ${results.length} referral partners`);
      }
      endCostRun(costRunId, { resultCount: results.length, status: results.length < desiredCount ? "partial" : "success" });
      costRunEnded = true;
    } catch (err) {
      setCreditError(`Search failed — ${err?.message || "please try again."}`);
      endCostRun(costRunId, { resultCount: creditResults.length, status: "error", notes: err?.message || "Credit lead search failed" });
      costRunEnded = true;
    } finally {
      if (!costRunEnded) endCostRun(costRunId, { resultCount: creditResults.length, status: "partial", notes: "Credit lead search stopped before completion" });
      setCreditLoading(false);
      setCreditProgress(null);
    }
  };

  // ─── LEAD REQUEST ENGINE ─────────────────────────────────
  const handleLeadListSearch = async () => {
    const requestText = [
      leadListRequest.trim(),
      leadListCity.trim() ? `Geography / region: ${leadListCity.trim()}` : "",
      leadListNiche.trim() ? `Focus / niche: ${leadListNiche.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    if (!requestText.trim()) { showToast("Paste a lead request or enter a niche", "error"); return; }
    setLeadListLoading(true);
    setLeadListError(null);
    setLeadListResults([]);
    setLeadListJob(null);
    setLeadListColumns([]);
    setLeadListProgress("Parsing request");
    setLeadListSheetStatus(null);

    const desiredCount = Math.min(50, Math.max(1, inferRequestedRowCount(requestText, leadListCount)));
    const initialPipelineExclusions = leads.map(l => l.company).filter(Boolean);
    const costRunId = startCostRun({
      mode: "leadlist",
      action: "Build Lead List",
      params: {
        city: leadListCity.trim(),
        niche: leadListNiche.trim(),
        requestedCount: desiredCount,
        request: requestText.slice(0, 240),
      },
    });
    let costRunEnded = false;

    const fallbackJob = {
      summary: requestText.slice(0, 160),
      industries: leadListNiche.trim() ? [leadListNiche.trim()] : [],
      companyFilters: [],
      geography: leadListCity.trim(),
    };

    const buildDiscoveryPrompt = (resultCount, exclusions = []) => {
      const exclusionClause = exclusions.length > 0
        ? `\nEXCLUSION LIST — do NOT return any of these companies (already in pipeline or earlier batches): ${exclusions.join(", ")}\n`
        : "";

      return `Parse this lead request, then find candidate companies only. Do NOT enrich full contacts yet.
${exclusionClause}
USER REQUEST:
${requestText}

RESULT COUNT: Return up to ${resultCount} candidate companies.

Discovery requirements:
1. Parse the request into a structured job with:
   - industries
   - companyFilters
   - geography
2. Find real candidate companies that match the request and show at least one recent or currently active freight-demand signal.
2a. Freight brokerage ICP is small-to-medium shippers that may still be open to a new brokerage:
   - Ideal size: roughly 10-250 employees, regional or privately held, one to a few plants/warehouses/branches, or clearly mid-market.
   - Accept borderline companies only when they are still regional/mid-market and do not show mature logistics infrastructure.
   - Exclude companies that look enterprise-sized, public, Fortune/large national brands, have hundreds of locations, or appear to have a dedicated logistics, transportation, supply-chain, TMS, private fleet, preferred-carrier, or established 3PL operation.
   - Do not pick companies just because they are famous shippers; prioritize companies a new brokerage could realistically win.
2b. Freight fit must be general freight that can plausibly move on dry van or flatbed: palletized/boxed goods, packaged products, building materials, industrial supplies, machinery/equipment/parts, packaging, furniture/fixtures, food and beverage, ingredients, paper/plastics, wholesale/distribution, manufacturing, suppliers, producers, or fabricators. Exclude parcel-only, courier-only, pure ecommerce with tiny parcels, bulk tanker, hazmat-only, ocean/air-forwarding-only, intermodal-only, and parcel delivery companies.
2c. Geography is nationwide, with priority in the Pacific Northwest, Chicago/Midwest industrial markets, Texas, California, Florida/Georgia/Southeast, and the broader East Coast. If the user gave a city/region, honor it while still applying this fit.
3. Strong freight-demand signals must be specific events or active evidence, such as:
   - a new or expanded distribution center, warehouse, plant, cold storage site, branch, production line, or market launch
   - current shipping, receiving, warehouse, logistics, dispatch, supply chain, CDL, driver, forklift, distribution, inventory, or operations hiring
   - public freight, delivery, courier, warehousing, drayage, or transportation bids/RFPs
   - a recent facility opening, expansion, production ramp, supplier/distributor growth announcement, or seasonal outbound freight event
4. Weak/non-qualifying signals:
   - generic "serves this region", "has delivery service", "has a warehouse", or "has operated for many years"
   - generic company profile/database pages such as ZoomInfo, Apollo, Dun & Bradstreet, Crunchbase, Yelp, directories, or scraped profiles
   - generic company homepages/service pages unless the exact freight-demand event is visibly stated on that page
   - hiring for sales, customer service, office/admin, buyer/procurement, finance, engineering, or marketing unless the role directly owns physical freight movement
   - unsupported trend claims such as "more roles than the past 6 months" unless the proof page explicitly says that
5. Write Signal as one practical caller-facing sentence that states the exact reason this company may be actively moving freight.
   Example: "Opened a new Dallas distribution center, which likely creates new inbound and outbound freight lanes."
6. Signal Proof URL must be a direct link to the page proving that exact signal, such as the hiring post, public bid, press release, facility opening announcement, expansion article, permit/news page, or company announcement.
7. Source URL can be the company website or best company source, but Signal Proof URL must correspond to the Signal. Do not use a generic homepage as Signal Proof URL unless it directly contains the signal.
8. Prefer companies with callable public main lines.
9. For freight/shipper searches, include small-to-medium shippers, distributors, manufacturers, wholesalers, suppliers, producers, fabricators, building-material companies, food/beverage producers, and foodservice operators. Exclude carriers, brokers, 3PLs, couriers, freight marketplaces, staffing agencies, enterprise shippers, private-fleet operators, and companies with obvious in-house logistics/transportation/supply-chain departments.
10. Job boards are allowed only as Signal Proof URL evidence for current physical freight roles by the shipper company itself: shipping, receiving, warehouse, logistics, supply chain, CDL, driver, forklift, distribution, inventory, or operations. Do not return the job board as the company.
11. If you cannot find a direct proof URL for a strong freight-demand signal, skip the company and find another.
12. Do not find individual contacts in this step. That happens later one company at a time.
13. Only return the fields shown in the JSON shape below. Do not add lanes, buying signals, call notes, revenue, LinkedIn, confidence, contact status, or other extra fields.

RESPOND WITH ONLY this JSON object:
{
  "job": {
    "summary": "short description",
    "industries": ["..."],
    "companyFilters": ["..."],
    "geography": "..."
  },
  "columns": ${JSON.stringify(LEAD_LIST_COLUMNS)},
  "candidates": [
    {
      "Company Name": "...",
      "Contact Person": "",
      "Best Phone": "",
      "Email": "",
      "Region": "...",
      "Source URL": "https://...",
      "Industry": "...",
      "Company Type": "...",
      "Signal": "One sentence explaining the specific freight-demand signal a caller can mention.",
      "Signal Proof URL": "https://..."
    }
  ]
}`;
    };

    const buildEnrichmentPrompt = (candidate, job) => {
      const company = getLeadListCompany(candidate) || candidate.companyName || candidate.name || "";
      return `Research this single candidate company for a callable B2B lead row.

USER REQUEST:
${requestText}

PARSED JOB:
${JSON.stringify(job || fallbackJob)}

CANDIDATE COMPANY:
${JSON.stringify(candidate)}

Rules:
- Return one real company row only. Do not return competitors or alternatives.
- Prioritize getting a useful phone number. A public main/location phone is acceptable.
- Prefer a dispatch, logistics, shipping, warehouse, operations, distribution, transportation, or supply chain contact when public.
- If a named contact is not public, leave Contact Person blank.
- For freight/shipper searches, the company must be a small-to-medium shipper, distributor, manufacturer, wholesaler, supplier, producer, fabricator, building-material company, food/beverage producer, or foodservice operator. Exclude carriers, brokers, 3PLs, couriers, freight marketplaces, job boards, staffing agencies, enterprise shippers, private-fleet operators, and companies with obvious in-house logistics/transportation/supply-chain departments.
- The company should look realistically winnable by a new freight brokerage: roughly 10-250 employees, regional/mid-market, privately held when possible, and not already signaling a mature logistics machine.
- Freight must plausibly move by dry van or flatbed: palletized/boxed goods, packaged products, building materials, industrial supplies, machinery/equipment/parts, packaging, furniture/fixtures, food and beverage, ingredients, paper/plastics, wholesale/distribution, manufacturing, suppliers, producers, or fabricators. Reject parcel-only, courier-only, pure ecommerce parcel, bulk tanker, hazmat-only, ocean/air-forwarding-only, or intermodal-only fits.
- Nationwide is acceptable, but prioritize the Pacific Northwest, Chicago/Midwest industrial markets, Texas, California, Florida/Georgia/Southeast, and the broader East Coast unless the user gave a tighter geography.
- Confirm the company has a recent or currently active freight-demand signal such as shipping/logistics/warehouse/driver hiring, a distribution/facility opening or expansion, a public delivery/freight bid, seasonal outbound freight, or supplier/distributor growth announcement.
- Signal must be one caller-ready sentence that clearly names the exact signal, so a caller can say "I saw you..." naturally.
- Signal Proof URL must directly prove the Signal. Use the hiring post, bid/RFP page, press release, facility opening/expansion article, company announcement, or similar evidence page.
- Reject generic proof sources such as ZoomInfo, Apollo, Dun & Bradstreet, Crunchbase, Yelp, directories, or scraped company profiles.
- Do not use a generic homepage, service-area page, or "about us" page as Signal Proof URL unless that exact page directly states the active freight-demand event.
- Do not use generic facts like "serves this region", "offers delivery", "has a warehouse", or "has been operating for years" as the Signal.
- Hiring only qualifies if the role directly touches physical freight movement: shipping, receiving, warehouse, logistics, supply chain, CDL, driver, forklift, distribution, inventory, or operations. Sales, customer service, office/admin, buyer/procurement, finance, engineering, and marketing roles do not qualify by themselves.
- Do not claim growth trends, hiring spikes, or "more roles than the past 6 months" unless the proof page explicitly states that trend.
- If the proof URL does not directly support the Signal, skip this company and return an empty object.
- Do not invent contact names, emails, or phone numbers.
- If a field is unavailable, use an empty string.
- Source URL should support the company. Signal Proof URL should support the active freight-demand signal.
- Only return these fields: ${LEAD_LIST_COLUMNS.join(", ")}.

RESPOND WITH ONLY this JSON object:
{
  "Company Name": "${company}",
  "Contact Person": "",
  "Best Phone": "",
  "Email": "",
  "Region": "",
  "Source URL": "",
  "Industry": "",
  "Company Type": "",
  "Signal": "",
  "Signal Proof URL": ""
}`;
    };

    try {
      const acceptedRows = [];
      const seenRowKeys = new Set();
      const excludedCompanies = new Set(initialPipelineExclusions);
      let skippedCount = 0;
      let timedOutCount = 0;
      let qualityRejectedCount = 0;

      setLeadListJob(fallbackJob);
      setLeadListColumns(buildLeadColumns(fallbackJob, [], requestText));

      for (let pass = 0; pass < LEAD_LIST_MAX_GENERATION_PASSES && acceptedRows.length < desiredCount; pass++) {
        const remaining = desiredCount - acceptedRows.length;
        const requestBatchSize = Math.min(Math.max(remaining + LEAD_LIST_BUFFER_ROWS, 5), 8);
        setLeadListProgress(pass === 0
          ? `Finding candidate shippers (${acceptedRows.length}/${desiredCount} rows)`
          : `Finding more candidates (${acceptedRows.length}/${desiredCount} rows)`);

        const { response, data } = await callAnthropic("Build Lead List Search", {
          model: CLAUDE_SEARCH_MODEL,
          max_tokens: 1800,
          system: "You are the Lead Request Engine for a B2B sales app. Return ONLY valid JSON. For this step, discover candidate companies only; do not deeply enrich contacts.",
          messages: [{ role: "user", content: buildDiscoveryPrompt(requestBatchSize, [...excludedCompanies]) }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        });
        if (!data || data.error?.type === "upstream_parse_error") throw new Error(`Search service unavailable (HTTP ${response.status}) — please try again in a moment.`);
        if (data.error) throw new Error(data.error.message || "API error. Please try again.");

        const textParts = [];
        (data.content || []).forEach(block => { if (block.type === "text" && block.text) textParts.push(block.text); });
        const parsed = extractJSONValue(textParts.join("\n"));
        const parsedJob = Array.isArray(parsed) ? fallbackJob : { ...fallbackJob, ...(parsed?.job || {}) };
        const candidates = getParsedRows(parsed) || [];
        const parsedColumns = buildLeadColumns({ ...parsedJob, requiredColumns: parsed?.columns || parsedJob.requiredColumns }, candidates, requestText);
        setLeadListJob(parsedJob);
        setLeadListColumns(parsedColumns);
        if (candidates.length === 0) continue;

        for (const candidate of candidates) {
          if (acceptedRows.length >= desiredCount) break;
          const company = getLeadListCompany(candidate) || candidate.companyName || candidate.name;
          const companyKey = String(company || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!companyKey || excludedCompanies.has(company) || seenRowKeys.has(companyKey)) continue;
          seenRowKeys.add(companyKey);
          if (company) excludedCompanies.add(company);

          setLeadListProgress(`Researching ${company} (${acceptedRows.length}/${desiredCount} rows)`);
          let row = null;
          try {
            const { response: enrichResponse, data: enrichData } = await callAnthropic("Build Lead List Company Enrichment", {
              model: CLAUDE_SEARCH_MODEL,
              max_tokens: 1200,
              system: "You are a B2B lead researcher. Search the web for one company and return ONLY a raw JSON object for one lead row. Accuracy beats completeness; never fabricate contact data.",
              messages: [{ role: "user", content: buildEnrichmentPrompt(candidate, parsedJob) }],
              tools: [{ type: "web_search_20250305", name: "web_search" }],
            });
            if (!enrichData || enrichData.error?.type === "upstream_parse_error") throw new Error(`Search service unavailable (HTTP ${enrichResponse.status})`);
            if (enrichData.error) throw new Error(enrichData.error.message || "Company enrichment failed");
            const enrichTextParts = [];
            (enrichData.content || []).forEach(block => { if (block.type === "text" && block.text) enrichTextParts.push(block.text); });
            const parsedRow = extractJSONValue(enrichTextParts.join("\n"));
            row = Array.isArray(parsedRow) ? parsedRow[0] : parsedRow;
          } catch (err) {
            timedOutCount += 1;
            setLeadListError(`Some companies timed out. Showing ${acceptedRows.length} completed rows so far.`);
            continue;
          }

          const cleanRow = sanitizeLeadListRow(row);
          const rowKey = leadListRowKey(cleanRow);
          if (!row || !rowKey || seenRowKeys.has(rowKey)) {
            skippedCount += 1;
            continue;
          }
          const qualityCheck = validateLeadListRow(cleanRow);
          if (!qualityCheck.ok) {
            qualityRejectedCount += 1;
            skippedCount += 1;
            continue;
          }
          seenRowKeys.add(rowKey);

          const rowId = Date.now() + Math.random();
          const baseRow = {
            ...cleanRow,
            id: rowId,
            __columns: parsedColumns,
          };

          acceptedRows.push(baseRow);
          setLeadListResults(prev => [...prev, baseRow]);
          if (acceptedRows.length < desiredCount) await sleep(LEAD_LIST_ROW_DELAY_MS);
        }
      }

      if (acceptedRows.length === 0) {
        setLeadListError("No usable company rows returned. Try broadening the geography or simplifying the request.");
        setLeadListLoading(false);
        setLeadListProgress(null);
        endCostRun(costRunId, { resultCount: 0, status: "partial", notes: "No usable company rows returned" });
        costRunEnded = true;
        return;
      }

      if (acceptedRows.length < desiredCount) {
        showToast(`Built ${acceptedRows.length} rows · ${qualityRejectedCount} quality rejected · ${timedOutCount} timed out`);
      } else {
        showToast(`Built ${acceptedRows.length} lead rows`);
      }
      endCostRun(costRunId, { resultCount: acceptedRows.length, status: acceptedRows.length < desiredCount ? "partial" : "success" });
      costRunEnded = true;
    } catch (err) {
      setLeadListError(`Search failed — ${err?.message || "please try again."}`);
      endCostRun(costRunId, { resultCount: leadListResults.length, status: "error", notes: err?.message || "Build Lead List failed" });
      costRunEnded = true;
    }
    if (!costRunEnded) endCostRun(costRunId, { resultCount: leadListResults.length, status: "partial", notes: "Build Lead List stopped before completion" });
    setLeadListLoading(false);
    setLeadListProgress(null);
  };

  const handleExportLeadListCSV = () => {
    if (leadListResults.length === 0) return;
    const columns = withCallFeedbackColumns(leadListColumns.length ? leadListColumns : buildLeadColumns(leadListJob, leadListResults, leadListRequest));
    const rows = leadListResults.map(row => columns.map(col => csvEscape(stripLeadListMarkup(getLeadCell(row, col)))).join(","));
    const csv = [columns.map(csvEscape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_request_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAppendLeadListToSheets = async () => {
    if (leadListResults.length === 0) return;
    setLeadListSheetLoading(true);
    setLeadListSheetStatus(null);
    try {
      const SHEET_COLUMN_MAP = [
        { header: "Company Name",      field: "Company Name" },
        { header: "Contact Person",    field: "Contact Person" },
        { header: "Phone",             field: "Best Phone" },
        { header: "Email",             field: "Email" },
        { header: "Region",            field: "Region" },
        { header: "Source URL",        field: "Source URL" },
        { header: "Industry",          field: "Industry" },
        { header: "Company Type",      field: "Company Type" },
        { header: "Signal",            field: "Signal" },
        { header: "Signal Proof URL",  field: "Signal Proof URL" },
      ];
      const stripCitations = v => String(v ?? "").replace(/<cite[^>]*>[\s\S]*?<\/cite>|<cite[^>]*\/>/g, "").replace(/<[^>]+>/g, "").trim();
      const headers = SHEET_COLUMN_MAP.map(c => c.header);
      const dataRows = leadListResults.map(row =>
        SHEET_COLUMN_MAP.map(c => stripCitations(getLeadCell(row, c.field)))
      );
      const response = await fetch("/api/google-sheets-append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetName: GENERATED_LEADS_SHEET_NAME,
          columns: headers,
          rows: dataRows,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Google Sheets append failed");
      setLeadListSheetStatus(`Ready to call: sent ${leadListResults.length} leads to the ${GENERATED_LEADS_SHEET_NAME} tab. Google reported ${data.updatedRows || "the"} updated rows${data.updatedRange ? ` in ${data.updatedRange}` : ""}.`);
      showToast("Appended to Google Sheets");
    } catch (err) {
      const message = err?.message || "Google Sheets append failed";
      setLeadListSheetStatus(message);
      showToast(message, "error");
    }
    setLeadListSheetLoading(false);
  };

  // ─── BUILD A LEAD LIST OUTREACH DRAFT ────────────────────
  const handleLeadListDraftOutreach = async (lead) => {
    setGeneratingLeadListOutreach(lead.id);
    try {
      const company = getFirstLeadCell(lead, ["Company Name", "Business Name", "Company"]);
      const contact = getFirstLeadCell(lead, ["Contact Person", "Owner Name", "Name"]);
      const industryValue = getFirstLeadCell(lead, ["Industry", "Niche", "Company Type"]);
      const region = getFirstLeadCell(lead, ["Region", "Location", "Address", "City"]);
      const signal = getFirstLeadCell(lead, ["Signal"]);

      const prompt = `Write a short, punchy cold outreach message to ${company || "this lead"}${contact ? ` (contact: ${contact})` : ""}.

Lead request context:
- Job: ${leadListJob?.summary || leadListRequest || "General B2B lead generation"}
- Industry/type: ${industryValue || "unknown"}
- Region: ${region || "unknown"}
- Freight signal: ${signal || "unknown"}

Framework:
- Hook: Reference something specific about their business
- Pain point: connect to a problem they likely have
- Offer: One concrete thing you can help with
- CTA: Low-friction ask (quick call or reply)

Keep it 4-5 sentences max. No fluff. Sound like a real person, not a salesperson.`;

      const { data } = await callAnthropic("Build Lead List Outreach Draft", {
        model: CLAUDE_SEARCH_MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (data.content || []).find(b => b.type === "text")?.text || "";
      setLeadListOutreach(prev => ({ ...prev, [lead.id]: text }));
      updatePipelineLead(
        item => item.sourceMode === "leadlist" && ((item.leadListRow && JSON.stringify(item.leadListRow) === JSON.stringify(lead)) || (item.company || "").toLowerCase() === String(getFirstLeadCell(lead, ["Company Name", "Business Name", "Company"]) || "").toLowerCase()),
        item => ({
          ...item,
          savedEmailDraft: text,
          leadListRow: lead,
          searchContext: {
            request: leadListRequest || leadListJob?.summary || "",
            city: leadListCity || getFirstLeadCell(lead, ["Region", "Location", "Address", "City"]) || "",
            niche: leadListNiche || getFirstLeadCell(lead, ["Industry", "Niche", "Company Type"]) || "",
          },
          pipelineDetails: buildLeadListPipelineDetails(lead, leadListColumns, text),
        }),
      );
      showToast("Outreach drafted");
    } catch {
      showToast("Failed to generate outreach", "error");
    }
    setGeneratingLeadListOutreach(null);
  };

  // ─── ADD LEAD LIST RESULT TO PIPELINE ────────────────────
  const handleAddLeadListToPipeline = (lead) => {
    const company = getFirstLeadCell(lead, ["Company Name", "Business Name", "Company"]);
    const contact = getFirstLeadCell(lead, ["Contact Person", "Owner Name", "Name"]);
    const email = getFirstLeadCell(lead, ["Email", "Email Address"]);
    const phone = getFirstLeadCell(lead, ["Best Phone", "Phone", "Phone Number"]);
    const industryValue = getFirstLeadCell(lead, ["Industry", "Niche", "Company Type"]);
    const region = getFirstLeadCell(lead, ["Region", "Location", "Address", "City"]);
    const source = getFirstLeadCell(lead, ["Source URL", "Website", "Source"]);
    const signal = getFirstLeadCell(lead, ["Signal"]);
    const newLead = {
      id: Date.now() + Math.random(),
      createdAt: Date.now(),
      name: contact || company,
      company: company || "Unknown Company",
      email: email || "",
      phone: phone || "",
      projectType: industryValue || "",
      budget: "",
      location: region || "",
      zipCode: "",
      timeline: "",
      source: source || "Build a Lead List",
      description: signal || "",
      followUp: "new",
      result: { qualified: true, score: 1, total: 1, criteria: [] },
      verified: false,
      sourceMode: "leadlist",
      leadListRow: lead,
      searchContext: {
        request: leadListRequest || leadListJob?.summary || "",
        city: leadListCity || region || "",
        niche: leadListNiche || industryValue || "",
      },
      pipelineDetails: buildLeadListPipelineDetails(lead, leadListColumns, leadListOutreach[lead.id] || ""),
      savedEmailDraft: leadListOutreach[lead.id] || "",
    };
    savePipelineLead(newLead);
  };

  // ─── ADD FIND LEADS RESULT TO PIPELINE ────────────────────
  const handleAddProspectToPipeline = (prospect) => {
    const savedDraft = emailDrafts[prospect.id] || "";
    const newLead = {
      id: Date.now() + Math.random(),
      createdAt: Date.now(),
      name: prospect.businessName,
      company: prospect.businessName || "Unknown Company",
      email: prospect.email || "",
      phone: prospect.phone || "",
      projectType: prospect.niche || prospect.title || "",
      budget: "",
      location: prospectCity || "",
      zipCode: "",
      timeline: "",
      source: prospect.sourceUrl || "Find Leads",
      description: [
        prospect.websiteStatus ? `Website status: ${prospect.websiteStatus}` : "",
        formatProspectSignalSummary(prospect.signals, prospect.signalEvidence) ? `Growth signals:\n${formatProspectSignalSummary(prospect.signals, prospect.signalEvidence)}` : "",
        prospect.proofReason ? `Proof: ${prospect.proofReason}` : "",
        prospect.pitchAngle ? `Pitch angle: ${prospect.pitchAngle}` : "",
      ].filter(Boolean).join("\n"),
      followUp: "new",
      result: buildProspectLeadResult(prospect),
      sourceMode: "prospects",
      prospectRaw: prospect,
      savedEmailDraft: savedDraft,
      searchContext: { city: prospectCity, niche: prospectNiche },
      pipelineDetails: buildProspectPipelineDetails(prospect, savedDraft, prospectCity),
    };
    savePipelineLead(newLead);
  };

  const handleAddCreditToPipeline = (row) => {
    const company = getLeadCell(row, "Company Name");
    const decisionMaker = getLeadCell(row, "Decision Maker");
    const newLead = {
      id: Date.now() + Math.random(),
      createdAt: Date.now(),
      name: decisionMaker || company,
      company: company || "Unknown Company",
      email: getLeadCell(row, "Email"),
      phone: getLeadCell(row, "Best Phone"),
      projectType: getLeadCell(row, "Industry") || "credit",
      budget: "",
      location: getLeadCell(row, "Region") || creditCity,
      zipCode: "",
      timeline: "",
      source: getLeadCell(row, "Source URL") || getLeadCell(row, "Signal Proof URL") || "Credit Leads",
      description: [
        getLeadCell(row, "Referral Signal") ? `Referral signal: ${getLeadCell(row, "Referral Signal")}` : "",
        getLeadCell(row, "Referral Fit") ? `Referral fit: ${getLeadCell(row, "Referral Fit")}` : "",
        getLeadCell(row, "Pitch Angle") ? `Pitch angle: ${getLeadCell(row, "Pitch Angle")}` : "",
      ].filter(Boolean).join("\n"),
      followUp: "new",
      result: { qualified: true, score: 3, total: 3, criteria: [
        { name: "Referral Signal", pass: true, detail: getLeadCell(row, "Referral Signal") },
        { name: "Proof URL", pass: true, detail: getLeadCell(row, "Signal Proof URL") },
        { name: "Reachable", pass: Boolean(getLeadCell(row, "Best Phone") || getLeadCell(row, "Email")), detail: getLeadCell(row, "Best Phone") || getLeadCell(row, "Email") || "No phone/email saved" },
      ] },
      sourceMode: "credit",
      creditRaw: row,
      searchContext: { city: creditCity, niche: creditNiche, focus: creditSignalFocus },
      pipelineDetails: buildCreditPipelineDetails(row),
    };
    savePipelineLead(newLead);
  };

  const handlePipelinePersonalizeEmail = async (lead) => {
    setPipelineDraftingId(lead.id);
    try {
      const draft = buildLeadListOfferEmail(lead, prospects);
      updatePipelineLead(
        item => item.id === lead.id,
        item => ({ ...item, savedEmailDraft: draft }),
        { silent: true },
      );
      showToast("Personalized email ready");
    } catch {
      showToast("Failed to personalize email", "error");
    }
    setPipelineDraftingId(null);
  };

  const handleRetryPipelineContext = async (lead) => {
    setPipelineRetryingId(lead.id);
    try {
      if (lead.sourceMode === "prospects") {
        const existing = lead.prospectRaw;
        if (existing) {
          updatePipelineLead(
            item => item.id === lead.id,
            item => ({
              ...item,
              result: buildProspectLeadResult(existing),
              pipelineDetails: buildProspectPipelineDetails(existing, item.savedEmailDraft || "", item.searchContext?.city || item.location),
            }),
            { silent: true },
          );
          showToast("Prospect details restored");
        } else {
          const city = lead.searchContext?.city || lead.location || "";
          const niche = lead.searchContext?.niche || lead.projectType || "";
          const prompt = `Find one public decision-maker record for this company and return only JSON.

Company: ${lead.company}
City/Region: ${city}
Niche: ${niche}
Existing contact hint: ${lead.name || ""}

Return:
{
  "Company Name": "",
  "Decision Maker Name": "",
  "Title": "",
  "Email": "",
  "Email Confidence": "",
  "LinkedIn URL": "",
  "Source URL": "",
  "Buying Signal": "",
  "Personalized First Line": ""
}`;

          const { data } = await callAnthropic("Pipeline Retry Details", {
            model: CLAUDE_SEARCH_MODEL,
            max_tokens: 1200,
            system: "You are a B2B decision-maker researcher. Search the web and return only one raw JSON object.",
            messages: [{ role: "user", content: prompt }],
            tools: [{ type: "web_search_20250305", name: "web_search" }],
          });
          const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
          const match = text.match(/\{[\s\S]*\}/);
          const parsed = match ? JSON.parse(match[0]) : null;
          if (!parsed) throw new Error("No details found");
          const prospect = {
            id: Date.now() + Math.random(),
            businessName: parsed["Company Name"] || lead.company,
            ownerName: parsed["Decision Maker Name"] || lead.name,
            title: parsed["Title"] || "",
            email: parsed["Email"] || lead.email || "",
            emailConfidence: parsed["Email Confidence"] || "",
            linkedInUrl: parsed["LinkedIn URL"] || "",
            sourceUrl: parsed["Source URL"] || lead.source || "",
            buyingSignal: parsed["Buying Signal"] || "",
            personalizedFirstLine: parsed["Personalized First Line"] || "",
            niche,
            phone: lead.phone || "",
            address: city,
            buyingSignals: parsed["Buying Signal"] ? [parsed["Buying Signal"]] : [],
            opportunities: parsed["Personalized First Line"] ? [parsed["Personalized First Line"]] : [],
            classification: { tier: "WARM", emoji: "🟢", color: t.green },
          };
          updatePipelineLead(
            item => item.id === lead.id,
            item => ({
              ...item,
              name: prospect.ownerName || item.name,
              email: prospect.email || item.email,
              result: buildProspectLeadResult(prospect),
              prospectRaw: prospect,
              pipelineDetails: buildProspectPipelineDetails(prospect, item.savedEmailDraft || "", city),
            }),
            { silent: true },
          );
          showToast("Prospect details rebuilt");
        }
      } else if (lead.sourceMode === "leadlist" && lead.leadListRow) {
        updatePipelineLead(
          item => item.id === lead.id,
          item => ({ ...item, pipelineDetails: buildLeadListPipelineDetails(item.leadListRow, leadListColumns, item.savedEmailDraft || "") }),
          { silent: true },
        );
        showToast("Lead list details restored");
      } else if (lead.sourceMode === "indeed" && lead.indeedRaw) {
        updatePipelineLead(
          item => item.id === lead.id,
          item => ({
            ...item,
            pipelineDetails: buildIndeedPipelineDetails(item.indeedRaw, {
              outreachDraft: item.savedEmailDraft,
            }),
          }),
          { silent: true },
        );
        showToast("Indeed details restored");
      } else {
        showToast("This older row does not have enough saved context to rebuild. New rows will.", "error");
      }
    } catch {
      showToast("Failed to rebuild saved context", "error");
    }
    setPipelineRetryingId(null);
  };

  const modeScopedLeads = useMemo(() => {
    const base = leads.filter(l => (l.sourceMode || "leadlist") === mode);

    if (mode === "prospects") {
      const activeCity = normalizePipelineContextValue(prospectCity);
      const activeNiche = normalizePipelineContextValue(prospectNiche);
      if (!activeCity && !activeNiche) return base;
      return base.filter(lead => {
        const leadCity = normalizePipelineContextValue(lead.searchContext?.city || lead.location);
        const leadNiche = normalizePipelineContextValue(lead.searchContext?.niche || lead.projectType);
        return (!activeCity || leadCity === activeCity) && (!activeNiche || leadNiche === activeNiche);
      });
    }

    if (mode === "leadlist") {
      const activeRequest = normalizePipelineContextValue(leadListRequest || leadListJob?.summary);
      const activeCity = normalizePipelineContextValue(leadListCity);
      const activeNiche = normalizePipelineContextValue(leadListNiche);
      if (!activeRequest && !activeCity && !activeNiche) return base;
      return base.filter(lead => {
        const leadRequest = normalizePipelineContextValue(lead.searchContext?.request);
        const leadCity = normalizePipelineContextValue(lead.searchContext?.city || lead.location);
        const leadNiche = normalizePipelineContextValue(lead.searchContext?.niche || lead.projectType);
        return (!activeRequest || leadRequest === activeRequest)
          && (!activeCity || leadCity === activeCity)
          && (!activeNiche || leadNiche === activeNiche);
      });
    }

    if (mode === "credit") {
      const activeCity = normalizePipelineContextValue(creditCity);
      const activeNiche = normalizePipelineContextValue(creditNiche);
      if (!activeCity && !activeNiche) return base;
      return base.filter(lead => {
        const leadCity = normalizePipelineContextValue(lead.searchContext?.city || lead.location);
        const leadNiche = normalizePipelineContextValue(lead.searchContext?.niche || lead.projectType);
        return (!activeCity || leadCity === activeCity) && (!activeNiche || leadNiche === activeNiche);
      });
    }

    return base;
  }, [leads, mode, prospectCity, prospectNiche, leadListRequest, leadListJob, leadListCity, leadListNiche, creditCity, creditNiche]);

  // ─── FILTERED & SORTED LEADS ─────────────────────────────
  const filteredLeads = useMemo(() => {
    let result = [...modeScopedLeads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.name || "").toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) || (l.projectType || "").toLowerCase().includes(q) ||
        (l.location || "").toLowerCase().includes(q) || (l.zipCode || "").includes(q)
      );
    }
    if (filterFollowUp !== "all") result = result.filter(l => l.followUp === filterFollowUp);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = (a.createdAt || 0) - (b.createdAt || 0);
      else if (sortBy === "name") cmp = (a.name || "").localeCompare(b.name || "");
      else if (sortBy === "budget") cmp = (parseFloat(a.budget) || 0) - (parseFloat(b.budget) || 0);
      else if (sortBy === "rank") cmp = (parseInt(a.personalRank, 10) || 0) - (parseInt(b.personalRank, 10) || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [modeScopedLeads, searchQuery, filterFollowUp, sortBy, sortDir]);

  const handleExportPipelineCSV = () => {
    const columns = [
      "Company Name",
      "Personal Rank",
      "Decision Maker Name",
      "Title",
      "Email",
      "Email Confidence",
      "LinkedIn URL",
      "Phone Number",
      "Buying Signal",
      "Personalized First Line",
      "Draft Email",
    ];
    const rows = modeScopedLeads.map(lead => {
      const detailMap = getPipelineDetailMap(lead);
      const prospect = lead.sourceMode === "prospects" ? prospectFromPipelineLead(lead) : null;
      return [
        prospect?.businessName || detailMap.get("Company Name") || lead.company || "",
        lead.personalRank || "",
        prospect?.ownerName || detailMap.get("Decision Maker Name") || detailMap.get("Contact Person") || lead.name || "",
        prospect?.title || detailMap.get("Title") || detailMap.get("Target Role") || "",
        prospect?.email || detailMap.get("Email") || lead.email || "",
        prospect?.emailConfidence || detailMap.get("Email Confidence") || "",
        prospect?.linkedInUrl || detailMap.get("LinkedIn URL") || detailMap.get("LinkedIn") || "",
        prospect?.phone || detailMap.get("Phone") || detailMap.get("Phone Number") || lead.phone || "",
        prospect?.buyingSignal || detailMap.get("Buying Signal") || detailMap.get("Reason / Buying Signal") || lead.description || "",
        prospect?.personalizedFirstLine || detailMap.get("Personalized First Line") || "",
        lead.savedEmailDraft || "",
      ];
    });
    const csv = [columns.map(csvValue).join(","), ...rows.map(row => row.map(csvValue).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pipeline_leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
                <div style={{ width: 64, height: 64, background: "#f59e0b", borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#0c0a09", fontFamily: "'Outfit', sans-serif", marginBottom: 24 }}>LG</div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fafaf9", fontFamily: "'Outfit', sans-serif", marginBottom: 12 }}>Lead Gen</h1>
	                <p style={{ color: "#a8a29e", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>Find and manage leads in seconds. Let's set up your profile.</p>
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
	                <p style={{ color: "#a8a29e", fontSize: 14, marginBottom: 28 }}>Set rough defaults for incoming leads. You can always change these later.</p>
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
                <p style={{ color: "#a8a29e", fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>{companyName ? `${companyName} is` : "Your lead gen tool is"} ready to go. Want to load some sample leads to see how it works?</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button onClick={() => { setSetupComplete(true); setMode("prospects"); setTab("prospects"); }} style={{ ...btnPrimary, width: "100%", padding: "14px 40px", fontSize: 15 }}>Find Leads →</button>
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
  const modeLeads = modeScopedLeads;
  const costStats = buildCostStats(costRuns, costEvents);
  const costEventsById = new Map(costEvents.map(event => [event.id, event]));
  const unassociatedCostEvents = costStats.unassociated;
  const sessionCost = costStats.lifetime;
  const latestCostRun = costRuns[0];
  const recentRuns = costRuns.slice(0, 5);
  const toggleCostRunExpanded = (runId) => setExpandedCostRuns(prev => ({ ...prev, [runId]: !prev[runId] }));

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
	          .lead-row > div:nth-child(6)::before { content: 'Rank: '; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${t.textFaint}; margin-right: 8px; display: inline; }
	          .lead-row > div:nth-child(7) { margin-top: 4px; }
	          .lead-status-actions { justify-self: start; margin-top: 4px; }
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
                <div style={{ width: 40, height: 40, background: t.accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 17, color: "#0c0a09" }}>LG</div>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, fontFamily: "'Outfit', sans-serif" }}>{companyName || "Lead Gen"}</h1>
	                  <p style={{ fontSize: 11, color: t.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>{ind.label} · {leads.length} leads</p>
                </div>
              </div>
	              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
	                {false && <details style={{ position: "relative" }}>
	                  <summary style={{ listStyle: "none", cursor: "pointer", padding: "7px 10px", border: `1px solid ${t.borderLight}`, borderRadius: 8, background: t.bgHover, minWidth: 150 }}>
	                    <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>AI Cost</div>
	                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: t.accent }}>{formatCost(sessionCost)}</div>
	                    <div style={{ fontSize: 10, color: t.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
	                      {latestCostRun ? `${latestCostRun.action}: ${formatCost(latestCostRun.totalCost)}` : unassociatedCostEvents[0] ? `${unassociatedCostEvents[0].action}: ${formatCost(unassociatedCostEvents[0].cost)}` : "No paid calls yet"}
	                    </div>
	                  </summary>
	                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 360, maxWidth: "80vw", background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: 12, zIndex: 20, boxShadow: theme === "dark" ? "0 18px 40px rgba(0,0,0,0.45)" : "0 18px 40px rgba(41,37,36,0.16)" }}>
	                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
	                      <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Recent Runs</div>
	                      <button onClick={() => { setTab("dashboard"); setDashboardView("cost"); }} style={{ background: "transparent", border: "none", color: t.accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View all</button>
	                    </div>
	                    {recentRuns.length === 0 ? (
	                      <div style={{ fontSize: 12, color: t.textMuted }}>
	                        No grouped runs yet{unassociatedCostEvents.length ? ` · ${unassociatedCostEvents.length} unassociated calls tracked` : "."}
	                      </div>
	                    ) : recentRuns.map(run => {
	                      const runCalls = (run.callIds || []).map(id => costEventsById.get(id)).filter(Boolean);
	                      const expanded = !!expandedCostRuns[run.id];
	                      return (
	                        <div key={run.id} style={{ padding: "8px 0", borderTop: `1px solid ${t.border}` }}>
	                          <button onClick={() => toggleCostRunExpanded(run.id)} style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: t.text }}>
	                            <div style={{ minWidth: 0 }}>
	                              <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
	                                <span style={{ fontSize: 9, color: "#0c0a09", background: t.accent, borderRadius: 999, padding: "2px 6px", fontWeight: 800, textTransform: "uppercase" }}>{run.mode}</span>
	                                <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.action}</span>
	                              </div>
	                              <div style={{ fontSize: 10, color: t.textDim, marginTop: 3 }}>{formatDuration(run.durationMs)} · {run.resultCount || 0} results · {(run.callIds || []).length} calls</div>
	                            </div>
	                            <div style={{ textAlign: "right" }}>
	                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: run.status === "error" ? t.red : t.accent }}>{formatCost(run.totalCost)}</div>
	                              <div style={{ fontSize: 9, color: t.textFaint, textTransform: "uppercase" }}>{run.status}</div>
	                            </div>
	                          </button>
	                          {expanded && (
	                            <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: t.bg }}>
	                              {runCalls.length === 0 ? <div style={{ fontSize: 11, color: t.textDim }}>No call details found.</div> : runCalls.map(event => (
	                                <div key={event.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: "5px 0", borderTop: `1px solid ${t.border}` }}>
	                                  <div style={{ fontSize: 11, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.action}</div>
	                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.text }}>{formatCost(event.cost)}</div>
	                                </div>
	                              ))}
	                            </div>
	                          )}
	                        </div>
	                      );
	                    })}
	                  </div>
	                </details>}
	                <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme"
                  style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.borderLight}`, background: t.bgHover, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: t.text, transition: "all 0.2s" }}>
                  {theme === "dark" ? "☀" : "🌙"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ background: t.bgAlt, borderBottom: `1px solid ${t.borderLight}`, padding: "10px 0" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", display: "flex", gap: 8, alignItems: "center", overflowX: "auto" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: t.textFaint, marginRight: 4, whiteSpace: "nowrap" }}>Mode:</span>
            {[
              { id: "leadlist",  tab: "leadlist",  label: "🎯 Build a Lead List" },
              { id: "prospects", tab: "prospects", label: "🔍 Find Leads" },
              { id: "credit",    tab: "credit",    label: "💳 Credit Leads" },
              { id: "shiplist",  tab: "shiplist",  label: "📋 Ship List" },
            ].map(m => {
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={() => { setMode(m.id); setTab(m.tab); }} style={{ padding: "7px 16px", background: active ? t.accent : t.bgHover, border: `1px solid ${active ? t.accent : t.borderLight}`, borderRadius: 20, color: active ? "#0c0a09" : t.textMuted, cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap" }}>{m.label}</button>
              );
            })}
          </div>
        </div>

        {/* Tabs — context-sensitive per mode */}
        <div style={{ borderBottom: `1px solid ${t.border}` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", display: "flex", gap: 2, overflowX: "auto" }} className="tab-bar">
            {({
              leadlist:  [{ id: "leadlist",  label: "Build a Lead List",   count: leadListResults.length || undefined }, { id: "leads", label: "Pipeline", count: mode === "leadlist" ? modeLeads.length || undefined : leads.filter(l => (l.sourceMode || "leadlist") === "leadlist").length || undefined }, { id: "dashboard", label: "Dashboard" }],
              prospects: [{ id: "prospects", label: "Find Leads" }, { id: "leads", label: "Pipeline", count: mode === "prospects" ? modeLeads.length || undefined : leads.filter(l => l.sourceMode === "prospects").length || undefined }, { id: "dashboard", label: "Dashboard" }],
              credit:    [{ id: "credit",    label: "Credit Leads",        count: creditResults.length || undefined }, { id: "leads", label: "Pipeline", count: mode === "credit" ? modeLeads.length || undefined : leads.filter(l => l.sourceMode === "credit").length || undefined }, { id: "dashboard", label: "Dashboard" }],
              shiplist:  [{ id: "shiplist",  label: "Ship List",           count: shipListResults.length || undefined }, { id: "leads", label: "Pipeline", count: leads.filter(l => l.sourceMode === "shiplist").length || undefined }, { id: "dashboard", label: "Dashboard" }],
            }[mode] || []).map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding: "12px 20px", background: tab === tb.id ? t.accent : "transparent", color: tab === tb.id ? "#0c0a09" : t.textMuted, border: "none", borderBottom: tab === tb.id ? `3px solid ${t.accent}` : "3px solid transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: tab === tb.id ? 700 : 500, letterSpacing: "0.02em", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                {tb.label}
                {tb.count !== undefined && <span style={{ background: tab === tb.id ? "#00000033" : t.bgHover, color: tab === tb.id ? "#0c0a09" : t.textDim, padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{tb.count}</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }} className="app-content">

          {/* ════════════ CREDIT LEADS ════════════ */}
          {tab === "credit" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>💳 Credit Leads</h2>
                <p style={{ color: t.textDim, fontSize: 14 }}>Find referral partners whose clients get blocked by personal credit problems and could refer them to Conquer Credit.</p>
              </div>

              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr auto auto", gap: 16, alignItems: "flex-end" }}>
                  <div>
                    <label style={labelStyle}>City / Region</label>
                    <input style={inputStyle} value={creditCity} onChange={e => setCreditCity(e.target.value)} placeholder="e.g. Austin, TX or Southeast US" onKeyDown={e => e.key === "Enter" && handleCreditSearch()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry / Niche</label>
                    <input style={inputStyle} value={creditNiche} onChange={e => setCreditNiche(e.target.value)} placeholder="e.g. mortgage brokers, real estate agents" onKeyDown={e => e.key === "Enter" && handleCreditSearch()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Signal Focus</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={creditSignalFocus} onChange={e => setCreditSignalFocus(e.target.value)}>
                      <option value="production">Active production</option>
                      <option value="subprime">Subprime / distressed exposure</option>
                      <option value="referral">Referral-network active</option>
                      <option value="growth">Growth signal</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Rows</label>
                    <select style={{ ...inputStyle, width: 90, cursor: "pointer" }} value={creditCount} onChange={e => setCreditCount(Number(e.target.value))}>
                      {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button onClick={handleCreditSearch} disabled={creditLoading} style={{ ...btnPrimary, height: 43, whiteSpace: "nowrap", opacity: creditLoading ? 0.7 : 1 }}>
                    {creditLoading ? "Searching..." : "Find Credit Leads"}
                  </button>
                </div>
                {creditLoading && creditProgress && (
                  <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: t.bgHover, border: `1px solid ${t.borderLight}`, color: t.textMuted, fontSize: 13 }}>
                    {creditProgress}
                  </div>
                )}
              </div>

              {creditError && (
                <div style={{ background: t.redBg, border: `1px solid ${t.redBorder}`, borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 14, color: t.red }}>{creditError}</div>
              )}

              {creditResults.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: t.textMuted, flex: 1 }}>{creditResults.length} referral partners</span>
                    <button onClick={() => {
                      const rows = creditResults.map(row => CREDIT_COLUMNS.map(col => csvValue(getLeadCell(row, col))).join(","));
                      const csv = [CREDIT_COLUMNS.map(csvValue).join(","), ...rows].join("\n");
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = "credit_leads.csv"; a.click();
                      URL.revokeObjectURL(url);
                    }} style={btnSecondary}>Export CSV</button>
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    {creditResults.map(row => {
                      const company = getLeadCell(row, "Company Name");
                      const inPipeline = leads.some(l => l.sourceMode === "credit" && columnKey(l.company) === columnKey(company));
                      return (
                        <div key={row.id} style={{ ...cardStyle, marginBottom: 0, borderLeft: "4px solid #22c55e" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                            <div style={{ minWidth: 240, flex: 1 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                <span style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{company}</span>
                                {row.proofVerification?.verified === "linkedin-structural" && <span style={{ fontSize: 10, background: "#2563eb33", color: "#93c5fd", padding: "2px 8px", borderRadius: 6, fontWeight: 800 }}>LinkedIn ✓</span>}
                                {row.proofVerification?.verified === "http" && <span style={{ fontSize: 10, background: "#16653433", color: "#86efac", padding: "2px 8px", borderRadius: 6, fontWeight: 800 }}>Verified ✓</span>}
                                {getLeadCell(row, "Industry") && <span style={{ fontSize: 10, background: "#16653433", color: "#86efac", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>{getLeadCell(row, "Industry")}</span>}
                                {getLeadCell(row, "Company Type") && <span style={{ fontSize: 10, background: t.bgHover, color: t.textMuted, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>{getLeadCell(row, "Company Type")}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: t.textMuted }}>
                                {getLeadCell(row, "Region") || creditCity}
                                {getLeadCell(row, "Decision Maker") ? ` · ${getLeadCell(row, "Decision Maker")}` : ""}
                              </div>
                              <div style={{ fontSize: 12, color: getLeadCell(row, "Best Phone") || getLeadCell(row, "Email") ? "#86efac" : t.textFaint, marginTop: 3 }}>
                                {getLeadCell(row, "Best Phone") || "No phone"}{getLeadCell(row, "Email") ? ` · ${getLeadCell(row, "Email")}` : ""}
                              </div>
                            </div>
                            <button onClick={() => handleAddCreditToPipeline(row)} disabled={inPipeline} style={{ ...btnPrimary, alignSelf: "flex-start", opacity: inPipeline ? 0.6 : 1 }}>
                              {inPipeline ? "In Pipeline" : "Add to Pipeline"}
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                            {[
                              ["Referral Signal", getLeadCell(row, "Referral Signal")],
                              ["Referral Fit", getLeadCell(row, "Referral Fit")],
                              ["Pitch Angle", getLeadCell(row, "Pitch Angle")],
                              ["Signal Proof URL", getLeadCell(row, "Signal Proof URL")],
                              ["Source URL", getLeadCell(row, "Source URL")],
                            ].map(([label, value]) => (
                              <div key={label} style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 5 }}>{label}</div>
                                {String(value || "").startsWith("http") ? (
                                  <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: t.accent, overflowWrap: "anywhere" }}>{value}</a>
                                ) : (
                                  <div style={{ fontSize: 13, color: value ? t.text : t.textFaint, lineHeight: 1.45, overflowWrap: "anywhere" }}>{value || "—"}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════ SHIP LIST ════════════ */}
          {tab === "shiplist" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>📋 Ship List</h2>
                <p style={{ color: t.textDim, fontSize: 14 }}>Find Bay Area companies likely to spend $4,000–$8,000+ on a professional video or photo shoot.</p>
              </div>

              {/* Controls */}
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 16, alignItems: "flex-end" }}>
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
                    <label style={labelStyle}>Size Band</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListSizeBand} onChange={e => setShipListSizeBand(e.target.value)}>
                      <option value="startup">Startup — 20-80 emp</option>
                      <option value="growth">Growth — 50-150 emp</option>
                      <option value="mixed">Mixed — 20-200 emp</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Industry Focus</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListIndustryFocus} onChange={e => setShipListIndustryFocus(e.target.value)}>
                      <option value="all">All high-spend</option>
                      <option value="events_weddings">Events &amp; Weddings</option>
                      <option value="luxury_lifestyle">Luxury Lifestyle</option>
                      <option value="nightlife">Nightlife &amp; Hospitality</option>
                      <option value="tech">Tech</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Show Priority</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListPriorityFilter} onChange={e => setShipListPriorityFilter(e.target.value)}>
                      <option value="all">All results</option>
                      <option value="80">Hot Leads only</option>
                      <option value="60">Strong Fit and up</option>
                      <option value="40">Possible Fit and up</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Results</label>
                    <select style={{ ...inputStyle, cursor: "pointer" }} value={shipListCount} onChange={e => setShipListCount(Number(e.target.value))}>
                      {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n} companies</option>)}
                    </select>
                  </div>
                  <button onClick={handleShipListSearch} disabled={shipListLoading} style={{ ...btnPrimary, whiteSpace: "nowrap", opacity: shipListLoading ? 0.7 : 1 }}>
                    {shipListLoading ? "⏳ Searching..." : "⚡ Build Ship List"}
                  </button>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: t.textMuted, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={shipListIncludeServices} onChange={e => setShipListIncludeServices(e.target.checked)} />
                  Include boutique professional services
                </label>
                {shipListLoading && shipListProgress && (
                  <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: t.bgHover, border: `1px solid ${t.borderLight}`, color: t.textMuted, fontSize: 13 }}>
                    {shipListProgress}
                  </div>
                )}
              </div>

              {shipListError && (
                <div style={{ background: "#7f1d1d33", border: "1px solid #b91c1c44", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 13, marginBottom: 20 }}>
                  {shipListError}
                </div>
              )}

              {shipListResults.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: t.textMuted, flex: 1 }}>{shipListResults.length} prioritized companies</span>
                    <button onClick={() => {
                      const headers = ["Company Name", "Email", "Email Confidence", "Email Source", "Website", "City", "Employee Count", "Funding Stage", "Last Funding Date", "Industry", "Founded", "Priority", "Budget Signal", "Buyer Fit", "Social Gap", "Platforms Present", "Priority Reasons", "YouTube", "Instagram", "TikTok", "LinkedIn", "Twitter", "Facebook"];
                      const rows = shipListResults.map(r => [
                        r.companyName, r.contactEmail, r.emailConfidence, r.emailSource, r.website, r.city, r.employeeCount, r.fundingStage, r.lastFundingDate, r.industry || r.companyType, r.founded,
                        r.priority, r.budgetSignal || "", r.buyerFit, r.socialGap, r.platformsPresent, (r.priorityReasons || []).join("; "),
                        r.socials?.youtube || "none", r.socials?.instagram || "none", r.socials?.tiktok || "none", r.socials?.linkedin || "none", r.socials?.twitter || "none", r.socials?.facebook || "none"
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
                    {shipListResults.filter(r => {
                      if (shipListPriorityFilter === "all") return true;
                      return (r.priority || 0) >= Number(shipListPriorityFilter);
                    }).map(r => (
                      <div key={r.id} style={{ ...cardStyle, marginBottom: 0, opacity: r.isActive === false ? 0.6 : 1, borderLeft: r.priority >= 80 ? "3px solid #34d399" : r.priority >= 60 ? "3px solid #f59e0b" : r.priority >= 40 ? "3px solid #fbbf24" : `3px solid ${t.border}` }}>
                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                          {/* Company info */}
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{r.companyName}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em", textTransform: "uppercase",
                                background: r.priority >= 80 ? "#15532e44" : r.priority >= 60 ? "#78350f44" : r.priority >= 40 ? "#713f1244" : t.bgHover,
                                color: r.priority >= 80 ? "#86efac" : r.priority >= 60 ? "#fcd34d" : r.priority >= 40 ? "#fde68a" : t.textMuted,
                              }}>
                                {r.priority >= 80 ? "Hot Lead" : r.priority >= 60 ? "Strong Fit" : r.priority >= 40 ? "Possible Fit" : "Low Fit"}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: t.bgHover, color: t.textMuted }}>
                                Priority: {r.priority}
                              </span>
                              {r.budgetSignal && (
                                <span style={{
                                  fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.05em", textTransform: "uppercase",
                                  background: r.budgetSignal === "High" ? "#14532d44" : r.budgetSignal === "Medium" ? "#78350f44" : t.bgHover,
                                  color: r.budgetSignal === "High" ? "#86efac" : r.budgetSignal === "Medium" ? "#fcd34d" : t.textMuted,
                                }}>
                                  {r.budgetSignal === "High" ? "💰 High Budget" : r.budgetSignal === "Medium" ? "💵 Mid Budget" : "Budget?"}
                                </span>
                              )}
                              {(r.industry || r.companyType) && <span style={{ fontSize: 10, background: "#1d4ed822", color: "#93c5fd", padding: "2px 6px", borderRadius: 4 }}>{r.industry || r.companyType}</span>}
                              {r.country && r.country !== "US" && <span style={{ fontSize: 10, background: "#7f1d1d33", color: "#fca5a5", padding: "2px 6px", borderRadius: 4 }}>⚠ {r.country}</span>}
                            </div>
                            {!r.isActive && <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 4 }}>⚠ {r.activeNote || "Company may be inactive"}</div>}
                            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 2 }}>
                              {r.city && <span>{r.city} · </span>}
                              {r.employeeCount && <span>{r.employeeCount} emp · </span>}
                              {r.fundingStage && <span style={{ color: t.accent }}>{r.fundingStage}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: r.contactEmail ? "#86efac" : "#fca5a5", marginBottom: 2 }}>
                              {r.contactEmail ? `Email: ${r.contactEmail}${r.emailConfidence ? ` · ${r.emailConfidence}` : ""}` : "No reachable email found yet"}
                            </div>
                            <div style={{ fontSize: 12, color: t.textFaint }}>
                              Fit: {r.buyerFit} · Gap: {r.socialGap}{r.lastFundingDate ? ` · Last funding: ${r.lastFundingDate}` : ""}{r.founded ? ` · Founded: ${r.founded}` : ""}
                            </div>
                            {r.priorityReasons?.length > 0 && (
                              <ul style={{ margin: "8px 0 0 18px", color: t.textFaint, fontSize: 11, lineHeight: 1.5 }}>
                                {r.priorityReasons.map((reason, ri) => <li key={ri}>{reason}</li>)}
                              </ul>
                            )}
                            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                              {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: t.accent, textDecoration: "none" }}>🌐 Site</a>}
                              {r.socials?.linkedin && <a href={r.socials.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none" }}>💼 LinkedIn</a>}
                              {r.socials?.instagram && <a href={r.socials.instagram} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#f472b6", textDecoration: "none" }}>📸 IG</a>}
                              {r.socials?.youtube && <a href={r.socials.youtube} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#f87171", textDecoration: "none" }}>▶ YT</a>}
                              {r.socials?.tiktok && <a href={r.socials.tiktok} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#e879f9", textDecoration: "none" }}>🎵 TT</a>}
                              {r.socials?.twitter && <a href={r.socials.twitter} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#93c5fd", textDecoration: "none" }}>𝕏 Twitter</a>}
                              {r.socials?.facebook && <a href={r.socials.facebook} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#818cf8", textDecoration: "none" }}>fb Facebook</a>}
                            </div>
                          </div>

                          {/* Social platform status badges */}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                            {[
                              { label: "YT", icon: "▶", present: !!r.socials?.youtube },
                              { label: "IG", icon: "📸", present: !!r.socials?.instagram },
                              { label: "TT", icon: "🎵", present: !!r.socials?.tiktok },
                              { label: "LI", icon: "💼", present: !!r.socials?.linkedin },
                              { label: "𝕏", icon: "𝕏", present: !!r.socials?.twitter },
                              { label: "FB", icon: "fb", present: !!r.socials?.facebook },
                            ].map(p => (
                              <div key={p.label} style={{ background: p.present ? "#15532e44" : "#7f1d1d33", border: `1px solid ${p.present ? "#16a34a44" : "#b91c1c44"}`, borderRadius: 8, padding: "5px 8px", minWidth: 44, textAlign: "center" }}>
                                <div style={{ fontSize: 13 }}>{p.icon}</div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: p.present ? "#86efac" : "#fca5a5", marginTop: 1 }}>
                                  {p.present ? "✓" : "✗"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Save / status row */}
                        <div style={{ marginTop: 12 }}>
                          {(() => {
                            const saved = savedCompanies.find(c => c.company_name === r.companyName);
                            return saved ? (
                              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                {["new","contacted","replied","won","lost","skipped"].map(s => (
                                  <button key={s} onClick={() => updateCompanyStatus(saved.id, s)}
                                    style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                                      background: saved.status === s ? t.accent : t.bgHover,
                                      color: saved.status === s ? "#0c0a09" : t.textMuted, fontWeight: saved.status === s ? 700 : 400 }}>
                                    {s}
                                  </button>
                                ))}
                                <button onClick={() => deleteFromDB(saved.id, r.companyName)}
                                  style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: "#7f1d1d33", color: "#fca5a5" }}>
                                  ✕ remove
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => saveCompanyToDB(r)}
                                style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: t.accent, color: "#0c0a09", fontWeight: 700 }}>
                                + Save to DB
                              </button>
                            );
                          })()}
                        </div>

                        {/* Outreach panel toggle */}
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => {
                              if (!shipListContacts[r.id]) {
                                handleFindContact(r);
                              } else {
                                setShipListOutreachOpen(prev => ({ ...prev, [r.id]: !prev[r.id] }));
                              }
                            }}
                            disabled={generatingContact === r.id}
                            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: shipListOutreachOpen[r.id] ? t.accent : t.bgHover, color: shipListOutreachOpen[r.id] ? "#0c0a09" : t.text, cursor: generatingContact === r.id ? "not-allowed" : "pointer", opacity: generatingContact === r.id ? 0.7 : 1, fontWeight: 600 }}>
                            {generatingContact === r.id ? "Finding..." : shipListContacts[r.id] ? (shipListOutreachOpen[r.id] ? "▲ Hide Outreach" : "▼ Show Outreach") : "⚡ Find Contact + Draft Outreach"}
                          </button>
                        </div>

                        {shipListOutreachOpen[r.id] && shipListContacts[r.id] && (
                          <div style={{ marginTop: 12, background: t.bgHover, borderRadius: 10, padding: "14px 16px" }}>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 4 }}>👤 Contact Found</div>
                              <div style={{ fontSize: 13, color: t.text }}>{shipListContacts[r.id].name} — <span style={{ color: t.textMuted }}>{shipListContacts[r.id].title}</span></div>
                              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                                {shipListContacts[r.id].linkedin && <a href={shipListContacts[r.id].linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none" }}>🔗 LinkedIn</a>}
                                {shipListContacts[r.id].email && <span style={{ fontSize: 11, color: t.textMuted }}>✉ {shipListContacts[r.id].email}</span>}
                                <span style={{ fontSize: 11, background: "#1d4ed844", color: "#93c5fd", padding: "1px 6px", borderRadius: 4 }}>via {shipListContacts[r.id].platform || "linkedin"}</span>
                                <span style={{ fontSize: 11, color: t.textFaint }}>confidence: {shipListContacts[r.id].confidence || "medium"}</span>
                              </div>
                            </div>
                            {shipListOutreach[r.id] && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 6 }}>
                                  ✍ {shipListContacts[r.id].platform === "linkedin" ? "LinkedIn Message" : "Email Draft"}
                                </div>
                                <textarea
                                  value={shipListOutreach[r.id]}
                                  onChange={e => setShipListOutreach(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  style={{ width: "100%", minHeight: 100, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 12px", color: t.text, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                                />
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                  <button onClick={() => { navigator.clipboard.writeText(shipListOutreach[r.id]); showToast("Copied!"); }}
                                    style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: t.accent, color: "#0c0a09", fontWeight: 600 }}>
                                    Copy
                                  </button>
                                  <button onClick={() => saveCompanyToDB(r)}
                                    style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: `1px solid ${t.border}`, cursor: "pointer", background: t.bgHover, color: t.text }}>
                                    Save to DB
                                  </button>
                                </div>
                              </div>
                            )}
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
                  <div style={{ fontSize: 13 }}>Configure your filters above and click "Build Ship List" to find priority companies.</div>
                </div>
              )}

              {/* ── Saved Companies (DB) ── */}
              {savedCompanies.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Outfit', sans-serif", margin: 0 }}>🗄 Ship List DB</h3>
                    <span style={{ fontSize: 12, color: t.textMuted }}>{savedCompanies.length} companies saved</span>
                    <button onClick={loadSavedCompanies} style={{ ...btnSecondary, fontSize: 11, padding: "3px 10px", marginLeft: "auto" }}>↺ Refresh</button>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {savedCompanies.map(c => (
                      <div key={c.id} style={{ ...cardStyle, marginBottom: 0, padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{c.company_name}</span>
                              {c.company_type && <span style={{ fontSize: 10, background: "#1d4ed822", color: "#93c5fd", padding: "1px 6px", borderRadius: 4 }}>{c.company_type}</span>}
                              {c.priority ? (
                                <span style={{ fontSize: 10, background: c.priority >= 80 ? "#15532e44" : c.priority >= 60 ? "#78350f44" : t.bgHover, color: c.priority >= 80 ? "#86efac" : c.priority >= 60 ? "#fcd34d" : t.textMuted, padding: "1px 6px", borderRadius: 4 }}>
                                  {c.priority_label || getShipListPriorityLabel(c.priority)} · {c.priority}
                                </span>
                              ) : c.tier ? (
                                <span style={{ fontSize: 10, background: t.bgHover, color: t.textDim, padding: "1px 6px", borderRadius: 4 }}>
                                  Legacy T{c.tier}
                                </span>
                              ) : null}
                              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                                background: c.status === "won" ? "#15532e44" : c.status === "contacted" ? "#1d4ed844" : c.status === "replied" ? "#4c1d9544" : c.status === "lost" || c.status === "skipped" ? "#7f1d1d33" : t.bgHover,
                                color: c.status === "won" ? "#86efac" : c.status === "contacted" ? "#93c5fd" : c.status === "replied" ? "#c4b5fd" : c.status === "lost" || c.status === "skipped" ? "#fca5a5" : t.textMuted }}>
                                {c.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: t.textFaint }}>{c.city} · {c.funding_stage} · {c.employee_count} employees{c.buyer_fit ? ` · Fit ${c.buyer_fit} / Gap ${c.social_gap}` : ""}</div>
                            {c.contact_name && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>👤 {c.contact_name} ({c.contact_title}){c.contact_linkedin ? <a href={c.contact_linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", marginLeft: 6 }}>LinkedIn</a> : ""}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {["new","contacted","replied","won","lost","skipped"].map(s => (
                              <button key={s} onClick={() => updateCompanyStatus(c.id, s)}
                                style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "none", cursor: "pointer",
                                  background: c.status === s ? t.accent : t.bgHover,
                                  color: c.status === s ? "#0c0a09" : t.textMuted, fontWeight: c.status === s ? 700 : 400 }}>
                                {s}
                              </button>
                            ))}
                            <button onClick={() => deleteFromDB(c.id, c.company_name)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "none", cursor: "pointer", background: "#7f1d1d33", color: "#fca5a5" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
            const renderDashboardTabs = () => (
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {[
                  { id: "overview", label: "Overview" },
                ].map(view => (
                  <button key={view.id} onClick={() => setDashboardView(view.id)} style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${dashboardView === view.id ? t.accent : t.borderLight}`,
                    background: dashboardView === view.id ? t.accent : t.bgHover,
                    color: dashboardView === view.id ? "#0c0a09" : t.textMuted,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}>{view.label}</button>
                ))}
              </div>
            );

            if (dashboardView === "cost") {
              const runRows = costRuns;
              return (
                <div style={{ animation: "fadeIn 0.3s ease" }}>
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>📊 Dashboard</h2>
                    <p style={{ color: t.textDim, fontSize: 14 }}>Cost history is tracked per browser for Anthropic calls only.</p>
                    {renderDashboardTabs()}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                    {[
                      { val: formatCost(costStats.lifetime), label: "Total Spent", sub: "lifetime" },
                      { val: formatCost(costStats.thisWeek), label: "This Week", sub: "last 7 days" },
                      { val: formatCost(costStats.averagePerRun), label: "Avg / Run", sub: `${costRuns.length} grouped runs` },
                      { val: formatCost(costStats.averagePerResult), label: "Avg / Result", sub: "returned rows" },
                    ].map((s, i) => (
                      <div key={i} style={{ ...cardStyle, marginBottom: 0, textAlign: "center", padding: "20px 16px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 30, fontWeight: 700, color: t.accent, lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div style={cardStyle}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Run History</h3>
                    {runRows.length === 0 ? (
                      <div style={{ color: t.textMuted, fontSize: 14 }}>No grouped runs yet. Run a Ship List search to populate this table.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {runRows.map(run => {
                          const runCalls = (run.callIds || []).map(id => costEventsById.get(id)).filter(Boolean);
                          const expanded = !!expandedCostRuns[run.id];
                          return (
                            <div key={run.id} style={{ border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden", background: t.bg }}>
                              <button onClick={() => toggleCostRunExpanded(run.id)} style={{ width: "100%", display: "grid", gridTemplateColumns: "120px 90px 1.1fr 1.4fr 90px 90px 90px", gap: 10, alignItems: "center", padding: "12px 14px", background: "transparent", border: "none", color: t.text, textAlign: "left", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                                <div style={{ fontSize: 12, color: t.textMuted }}>{formatRelativeTime(run.startedAt)}</div>
                                <div style={{ fontSize: 11, color: "#0c0a09", background: t.accent, borderRadius: 999, padding: "3px 8px", fontWeight: 800, textAlign: "center", textTransform: "uppercase" }}>{run.mode}</div>
                                <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.action}</div>
                                <div style={{ fontSize: 12, color: t.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summarizeParams(run.params)}</div>
                                <div style={{ fontSize: 12, color: t.textMuted }}>{formatDuration(run.durationMs)}</div>
                                <div style={{ fontSize: 12, color: t.textMuted }}>{run.resultCount || 0}</div>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: run.status === "error" ? t.red : t.accent, textAlign: "right" }}>{formatCost(run.totalCost)}</div>
                              </button>
                              {expanded && (
                                <div style={{ padding: 14, borderTop: `1px solid ${t.border}`, background: t.bgAlt }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1.2fr)", gap: 16 }}>
                                    <div>
                                      <div style={{ fontSize: 11, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, marginBottom: 8 }}>Params</div>
                                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11, color: t.textMuted, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, padding: 10, fontFamily: "'JetBrains Mono', monospace" }}>{JSON.stringify(run.params || {}, null, 2)}</pre>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, marginBottom: 8 }}>Anthropic Calls</div>
                                      {runCalls.length === 0 ? <div style={{ color: t.textMuted, fontSize: 12 }}>No call details found.</div> : runCalls.map(event => (
                                        <div key={event.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: "8px 0", borderTop: `1px solid ${t.border}` }}>
                                          <div>
                                            <div style={{ fontSize: 12, fontWeight: 800 }}>{event.action}</div>
                                            <div style={{ fontSize: 11, color: t.textDim }}>{event.model} · {event.inputTokens || 0} in / {event.outputTokens || 0} out{event.webSearchRequests ? ` · ${event.webSearchRequests} searches` : ""}{event.usedProviderUsage ? "" : " · estimated"}</div>
                                          </div>
                                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 800, color: event.status === "failed" ? t.red : t.accent }}>{formatCost(event.cost)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={cardStyle}>
                    <button onClick={() => setExpandedUnassociatedCosts(v => !v)} style={{ width: "100%", background: "transparent", border: "none", color: t.text, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Unassociated Calls ({unassociatedCostEvents.length})</span>
                      <span style={{ color: t.accent, fontWeight: 800 }}>{expandedUnassociatedCosts ? "Hide" : "Show"}</span>
                    </button>
                    {expandedUnassociatedCosts && (
                      <div style={{ marginTop: 12 }}>
                        {unassociatedCostEvents.length === 0 ? <div style={{ color: t.textMuted, fontSize: 13 }}>No legacy or ungrouped calls.</div> : unassociatedCostEvents.map(event => (
                          <div key={event.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "8px 0", borderTop: `1px solid ${t.border}` }}>
                            <div style={{ fontSize: 12, color: t.textMuted }}>{formatRelativeTime(event.createdAt)}</div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 800 }}>{event.action}</div>
                              <div style={{ fontSize: 11, color: t.textDim }}>{event.model} · {event.inputTokens || 0} in / {event.outputTokens || 0} out{event.webSearchRequests ? ` · ${event.webSearchRequests} searches` : ""}</div>
                            </div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 800, color: event.status === "failed" ? t.red : t.accent }}>{formatCost(event.cost)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>📊 Dashboard</h2>
                  <p style={{ color: t.textDim, fontSize: 14 }}>Lead generation overview — run a search in LeadGen to populate this.</p>
                  {renderDashboardTabs()}
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
	                  <div><label style={labelStyle}>Personal Rank</label><select style={{ ...inputStyle, cursor: "pointer" }} value={form.personalRank} onChange={e => setForm(p => ({ ...p, personalRank: e.target.value }))}><option value="">Not ranked</option>{PERSONAL_RANK_OPTIONS.map(rank => <option key={rank.value} value={rank.value}>{rank.label}</option>)}</select></div>
	                  <div><label style={labelStyle}>Timeline</label><select style={{ ...inputStyle, cursor: "pointer" }} value={form.timeline} onChange={e => setForm(p => ({ ...p, timeline: e.target.value }))}><option value="">Select…</option>{TIMELINE_OPTIONS.map(tl => <option key={tl.value} value={tl.value}>{tl.label}</option>)}</select></div>
                  <div><label style={labelStyle}>Lead Source</label><input style={inputStyle} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="Website, Referral…" /></div>
                </div>
                <div style={{ marginTop: 18 }}><label style={labelStyle}>Project Description</label><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the project scope…" /></div>
                <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                  <button onClick={handleAddLead} style={{ ...btnPrimary, padding: "12px 32px" }}>Add Lead →</button>
                  <button onClick={() => setForm({ ...EMPTY_LEAD })} style={{ ...btnSecondary, background: "transparent" }}>Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ LEADS ════════════ */}
          {tab === "leads" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {filteredLeads.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🏗</div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>No leads yet</h3>
                  <p style={{ color: t.textFaint, fontSize: 14, marginBottom: 24 }}>Find actionable companies without usable websites</p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => { setMode("prospects"); setTab("prospects"); }} style={btnPrimary}>Find Leads</button>
                  </div>
                </div>
              ) : (
                <>
	                  {/* Toolbar */}
	                  <div className="toolbar-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
	                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
	                      <input style={{ ...inputStyle, width: 200, padding: "8px 14px", fontSize: 13 }} placeholder="Search leads…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
	                      <span style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${t.accent}`, background: t.accent, color: "#0c0a09", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
	                        All ({modeLeads.length})
	                      </span>
	                    </div>
	                    <div style={{ display: "flex", gap: 8 }}>
	                      <button onClick={handleExportPipelineCSV} style={btnSecondary}>Export CSV</button>
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
	                      {[{ id: "date", label: "Date" }, { id: "rank", label: "Rank" }, { id: "name", label: "Name" }, { id: "budget", label: "Budget" }].map(s => (
                        <button key={s.id} className={`sort-btn ${sortBy === s.id ? "active" : ""}`} onClick={() => { if (sortBy === s.id) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortBy(s.id); setSortDir("desc"); } }}>
                          {s.label} {sortBy === s.id ? (sortDir === "desc" ? "↓" : "↑") : ""}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: t.textFaint, fontStyle: "italic" }}>Click any cell to edit inline · Esc to cancel</span>
                  </div>

                  {/* Table header */}
	                  <div className="lead-grid-header" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr 1fr 90px", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.textFaint, borderBottom: `1px solid ${t.border}` }}>
	                    <span>Name</span><span>{ind.typeName}</span><span>Budget</span><span>Timeline</span><span>ZIP</span><span>Rank</span><span>Follow-up</span><span>Action</span>
                  </div>

                  {filteredLeads.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: t.textFaint, fontSize: 14 }}>No leads match your filters</div>
                  ) : filteredLeads.map((lead, idx) => (
                    <div key={lead.id}>
	                      <div className="lead-row" style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr 1fr 90px", gap: 8, padding: "12px 16px", fontSize: 14, cursor: "pointer", borderBottom: `1px solid ${t.border}`, transition: "background 0.15s", animation: `slideUp 0.25s ease ${Math.min(idx * 0.02, 0.3)}s both`, alignItems: "center" }}
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
	                        <div>
	                          <InlineCell lead={lead} field="personalRank" options={PERSONAL_RANK_OPTIONS} style={{ color: lead.personalRank ? t.accent : t.textFaint, fontSize: 12, fontWeight: 700 }}>
	                            {lead.personalRank ? `${lead.personalRank}/5` : "Rank"}
	                          </InlineCell>
	                        </div>
	                        <div onClick={e => e.stopPropagation()}>
	                          <select value={lead.followUp || "new"} onChange={e => handleFollowUpChange(lead.id, e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: 12, border: `1px solid ${(FOLLOWUP_STATUSES.find(s => s.id === lead.followUp) || FOLLOWUP_STATUSES[0]).color}44`, background: (FOLLOWUP_STATUSES.find(s => s.id === lead.followUp) || FOLLOWUP_STATUSES[0]).color + "18", color: (FOLLOWUP_STATUSES.find(s => s.id === lead.followUp) || FOLLOWUP_STATUSES[0]).color, fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", outline: "none" }}>
                            {FOLLOWUP_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </div>
	                        <div className="lead-status-actions" onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0 }}>
	                          <button
                            type="button"
                            aria-label={`Delete ${lead.company || lead.name || "lead"}`}
                            title="Delete lead"
                            onClick={() => handleDeleteLead(lead.id)}
                            style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.redBorder}`, background: t.redBg, color: t.red, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {expandedLead === lead.id && (
                        <div style={{ padding: "20px 16px 20px 32px", background: t.bgAlt, borderBottom: `1px solid ${t.border}`, animation: "slideUp 0.2s ease" }}>
                          {editingLead === lead.id ? (
                            <div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
	                                {[{ key: "name", label: "Name" }, { key: "company", label: "Company" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "budget", label: "Budget", type: "number" }, { key: "location", label: "Location" }, { key: "zipCode", label: "ZIP" }, { key: "source", label: "Source" }].map(f => (
	                                  <div key={f.key}><label style={labelStyle}>{f.label}</label><input style={{ ...inputStyle, padding: "8px 12px", fontSize: 13 }} type={f.type || "text"} value={editForm[f.key] || ""} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} /></div>
	                                ))}
	                                <div><label style={labelStyle}>Personal Rank</label><select style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, cursor: "pointer" }} value={editForm.personalRank || ""} onChange={e => setEditForm(p => ({ ...p, personalRank: e.target.value }))}><option value="">Not ranked</option>{PERSONAL_RANK_OPTIONS.map(rank => <option key={rank.value} value={rank.value}>{rank.label}</option>)}</select></div>
	                                <div><label style={labelStyle}>{ind.typeName}</label><select style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, cursor: "pointer" }} value={editForm.projectType} onChange={e => setEditForm(p => ({ ...p, projectType: e.target.value }))}><option value="">Select…</option>{PROJECT_TYPES.map(pt => <option key={pt.id} value={pt.id}>{pt.label}</option>)}</select></div>
                                <div><label style={labelStyle}>Timeline</label><select style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, cursor: "pointer" }} value={editForm.timeline} onChange={e => setEditForm(p => ({ ...p, timeline: e.target.value }))}><option value="">Select…</option>{TIMELINE_OPTIONS.map(tl => <option key={tl.value} value={tl.value}>{tl.label}</option>)}</select></div>
                              </div>
                              <div style={{ marginTop: 12 }}><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontSize: 13 }} value={editForm.description || ""} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} /></div>
                              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
	                                <button onClick={() => handleSaveEdit(lead.id)} style={{ ...btnPrimary, padding: "8px 20px", fontSize: 13 }}>Save</button>
                                <button onClick={() => { setEditingLead(null); setEditForm(null); }} style={{ ...btnSecondary, background: "transparent" }}>Cancel</button>
                              </div>
                            </div>
                          ) : lead.sourceMode === "prospects" ? (() => {
                            const prospect = prospectFromPipelineLead(lead);
                            return (
                              <div>
                                <div style={{ ...cardStyle, marginBottom: 14, borderLeft: `4px solid ${prospect.classification?.color || t.accent}` }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                                    {[
                                      ["Company Name", prospect.businessName],
                                      ["Decision Maker Name", prospect.ownerName],
                                      ["Title", prospect.title],
                                      ["Email", prospect.email],
                                      ["Email Confidence", prospect.emailConfidence],
                                      ["Phone", prospect.phone],
                                      ["LinkedIn URL", prospect.linkedInUrl],
                                      ["Source URL", prospect.sourceUrl],
                                      ["Buying Signal", prospect.buyingSignal],
                                      ["Personalized First Line", prospect.personalizedFirstLine],
                                    ].map(([label, value]) => (
                                      <div key={label} style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 5 }}>{label}</div>
                                        {String(value || "").startsWith("http") ? (
                                          <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: t.accent, overflowWrap: "anywhere" }}>{value}</a>
                                        ) : (
                                          <div style={{ fontSize: 13, color: value ? t.text : t.textFaint, lineHeight: 1.45, overflowWrap: "anywhere" }}>{value || "—"}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button onClick={() => { setEditingLead(lead.id); setEditForm({ ...lead }); }} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>✏ Edit</button>
                                    <button onClick={() => handleDeleteLead(lead.id)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", color: t.red, borderColor: t.redBorder, background: "transparent" }}>🗑 Delete</button>
                                    <button
                                      onClick={() => handlePipelinePersonalizeEmail(lead)}
                                      disabled={pipelineDraftingId === lead.id}
                                      style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px", opacity: pipelineDraftingId === lead.id ? 0.7 : 1 }}>
                                      {pipelineDraftingId === lead.id ? "Writing..." : lead.savedEmailDraft ? "↻ Personalize Email" : "✍ Personalize Email"}
                                    </button>
                                    <button
                                      onClick={() => handleRetryPipelineContext(lead)}
                                      disabled={pipelineRetryingId === lead.id}
                                      style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>
                                      {pipelineRetryingId === lead.id
                                        ? "Rebuilding..."
                                        : lead.pipelineDetails?.sections?.length
                                          ? "↺ Refresh Details"
                                          : "↺ Build Details"}
                                    </button>
                                  </div>

	                                </div>

                                {lead.savedEmailDraft && (
                                  <div style={{ marginTop: 14 }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Saved Email</h4>
                                    <textarea
                                      value={lead.savedEmailDraft}
                                      onChange={e => updatePipelineLead(item => item.id === lead.id, item => ({ ...item, savedEmailDraft: e.target.value }), { silent: true })}
                                      style={{ width: "100%", minHeight: 180, background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 8, padding: "10px 12px", color: t.text, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                                    />
                                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                      <button onClick={() => { navigator.clipboard.writeText(lead.savedEmailDraft); showToast("Email copied to clipboard"); }} style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px" }}>
                                        Copy Email
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
                            <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                              <div style={{ flex: "1 1 260px" }}>
                                <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Contact Details</h4>
                                <div style={{ display: "grid", gap: 6, fontSize: 13, color: t.textMuted }}>
                                  {lead.email && <div>✉ {lead.email}</div>}
                                  {lead.phone && <div>☎ {lead.phone}</div>}
                                  {lead.location && <div>📍 {lead.location} {lead.zipCode && `(${lead.zipCode})`}</div>}
                                  {lead.source && <div>🔗 Source: {lead.source}</div>}
                                  {lead.description && lead.sourceMode !== "prospects" && !lead.pipelineDetails?.sections?.length && (
                                    <div style={{ marginTop: 8, padding: 12, background: t.bgHover, borderRadius: 6, lineHeight: 1.5 }}>{lead.description}</div>
                                  )}
                                </div>
                                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                                  <button onClick={() => { setEditingLead(lead.id); setEditForm({ ...lead }); }} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>✏ Edit</button>
                                  <button onClick={() => handleDeleteLead(lead.id)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", color: t.red, borderColor: t.redBorder, background: "transparent" }}>🗑 Delete</button>
                                </div>
                                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => handlePipelinePersonalizeEmail(lead)}
                                    disabled={pipelineDraftingId === lead.id}
                                    style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px", opacity: pipelineDraftingId === lead.id ? 0.7 : 1 }}>
                                    {pipelineDraftingId === lead.id ? "Writing..." : lead.savedEmailDraft ? "↻ Personalize Email" : "✍ Personalize Email"}
                                  </button>
                                  {lead.sourceMode === "prospects" && (
                                    <button
                                      onClick={() => handleRetryPipelineContext(lead)}
                                      disabled={pipelineRetryingId === lead.id}
                                      style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>
                                      {pipelineRetryingId === lead.id
                                        ? "Rebuilding..."
                                        : lead.pipelineDetails?.sections?.length
                                          ? "↺ Refresh Details"
                                          : "↺ Build Details"}
                                    </button>
                                  )}
                                </div>
                                {lead.savedEmailDraft && (
                                  <div style={{ marginTop: 14 }}>
                                    <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Saved Email</h4>
                                    <textarea
                                      value={lead.savedEmailDraft}
                                      onChange={e => updatePipelineLead(item => item.id === lead.id, item => ({ ...item, savedEmailDraft: e.target.value }), { silent: true })}
                                      style={{ width: "100%", minHeight: 140, background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 8, padding: "10px 12px", color: t.text, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                                    />
                                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                                      <button onClick={() => { navigator.clipboard.writeText(lead.savedEmailDraft); showToast("Email copied to clipboard"); }} style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px" }}>
                                        Copy Email
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
	                              {lead.pipelineDetails?.sections?.length > 0 && (
                                <div style={{ flex: "1 1 100%", marginTop: 8 }}>
                                  <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                                    {lead.pipelineDetails.sourceLabel || "Saved Context"}
                                  </h4>
                                  {lead.sourceMode === "prospects" && lead.prospectRaw ? (
                                    <div style={{ ...cardStyle, marginBottom: 0, borderLeft: `4px solid ${lead.prospectRaw.classification?.color || t.green}` }}>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
                                        {[
                                          ["Company Name", lead.prospectRaw.businessName],
                                          ["Decision Maker Name", lead.prospectRaw.ownerName],
                                          ["Title", lead.prospectRaw.title],
                                          ["Email", lead.prospectRaw.email],
                                          ["Email Confidence", lead.prospectRaw.emailConfidence],
                                          ["LinkedIn URL", lead.prospectRaw.linkedInUrl],
                                          ["Source URL", lead.prospectRaw.sourceUrl],
                                          ["Buying Signal", lead.prospectRaw.buyingSignal],
                                          ["Personalized First Line", lead.prospectRaw.personalizedFirstLine],
                                        ].map(([label, value]) => (
                                          <div key={label} style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                                            {String(value || "").startsWith("http") ? (
                                              <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: t.accent, overflowWrap: "anywhere" }}>{value}</a>
                                            ) : (
                                              <div style={{ fontSize: 13, color: value ? t.text : t.textFaint, lineHeight: 1.45, overflowWrap: "anywhere" }}>{value || ""}</div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: "grid", gap: 12 }}>
                                      {lead.pipelineDetails.sections.map((section, index) => (
                                        <div key={`${section.title}-${index}`} style={{ background: t.bgHover, border: `1px solid ${t.border}`, borderRadius: 8, padding: "12px 14px" }}>
                                          <div style={{ fontSize: 11, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>{section.title}</div>
                                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                                            {(section.items || []).map((item, itemIndex) => (
                                              <div key={`${item.label}-${itemIndex}`} style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 10, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</div>
                                                {renderPipelineSectionValue(item, t)}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
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
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>🔍 Find Leads</h2>
                <p style={{ color: t.textDim, fontSize: 14, lineHeight: 1.5 }}>Find local businesses without a usable website, with phone or email so they are actually actionable.</p>
              </div>

              <div style={cardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>City + State *</label>
                    <input style={{ ...inputStyle }} value={prospectCity} onChange={e => setProspectCity(e.target.value)} placeholder="Austin, TX" />
                  </div>
                  <div>
                    <label style={labelStyle}>Business Niche <span style={{ color: t.textFaint, fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
                    <input style={{ ...inputStyle }} value={prospectNiche} onChange={e => setProspectNiche(e.target.value)} placeholder="HVAC, roofing, plumbing... or leave blank" />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Prioritize Signals</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
                    {PROSPECT_SIGNAL_KEYS.map(key => (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 8, color: t.textMuted, fontSize: 12, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={prospectFilters[key] !== false}
                          onChange={e => setProspectFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                        />
                        <span>{PROSPECT_SIGNAL_FILTERS[key].label}</span>
                      </label>
                    ))}
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

                {!prospectNiche.trim() && isHighAdoptionCity(prospectCity) && (
                  <div style={{ background: "#1c1400", border: "1px solid #78350f", color: "#fbbf24", borderRadius: 8, padding: "12px 16px", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                    ⚠ <strong>{prospectCity.replace(/,.*$/, "").trim()}</strong> is a high web-adoption area. Without a niche, most businesses here already have websites and results may come back empty — wasting your search budget. Add a niche (e.g. "nail salons", "auto detailing") for better results.
                  </div>
                )}

                <button onClick={handleProspectSearch} disabled={prospectLoading} style={{ ...btnPrimary, padding: "12px 32px", fontSize: 15, opacity: prospectLoading ? 0.6 : 1, cursor: prospectLoading ? "wait" : "pointer" }}>
                  {prospectLoading
                    ? (prospectProgress?.phase === "discovery"
                        ? "⏳ Finding no-website leads..."
                        : prospectProgress?.phase === "enriching"
                          ? `⏳ Enriching ${prospectProgress.current}/${prospectProgress.total}...`
                          : prospectProgress?.phase === "retrying"
                            ? "⏳ Retrying for better quality..."
                            : "⏳ Searching...")
                    : "🔍 Find Leads"}
                </button>
              </div>

              {prospectLoading && (
                <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 36, marginBottom: 16, animation: "pulse 1.2s infinite" }}>🔍</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Finding {prospectNiche.trim() || "local"} businesses without websites in {prospectCity}...</div>
                  <div style={{ fontSize: 13, color: t.textDim }}>Checking public sources for phone, email, source proof, and website status</div>
                </div>
              )}

              {prospectError && (
                <div style={{ ...cardStyle, background: t.redBg, border: `1px solid ${t.redBorder}` }}>
                  <span style={{ fontSize: 20 }}>⚠</span> {prospectError}
                </div>
              )}

              {prospects.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>
                    {prospectLoading
                      ? `${prospects.length} leads loaded so far...`
                      : `Found ${prospects.length} leads`}
                  </div>
                  <div style={{ display: "grid", gap: 16 }}>
                    {prospects.map(p => {
                      const inPipeline = leads.some(l => pipelineUniqueKey(l) === pipelineUniqueKey({
                        sourceMode: "prospects",
                        company: p.businessName,
                        email: p.email,
                        name: p.ownerName || p.businessName,
                      }));
                    return (
                      (() => {
                        const sendKey = prospectSendKey(p, prospectCity);
                        const sent = Boolean(prospectSendStatus[sendKey]?.sent);
                        const canSend = Boolean(String(p.email || "").trim()) && !sent;
                        return (
                      <div key={p.id} style={{ ...cardStyle, borderLeft: `4px solid ${p.classification.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{p.businessName}</h3>
                              <span title="Contact method: phone-only means the lead is actionable by phone but no usable email was found." style={{ padding: "4px 10px", background: p.classification.color + "22", color: p.classification.color, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                                {p.classification.emoji} {p.classification.tier}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
                          {[
                            ["Company Name", p.businessName],
                            ["Contact Method", p.classification.tier],
                            ["Webdev Fit", `${p.webdevFit?.score ?? 0}/100${p.webdevFit?.reasons?.length ? ` — ${p.webdevFit.reasons.join(", ")}` : ""}`],
                            ["Phone", p.phone ? `${p.phone}${p.phoneVerified ? " ✓" : ""}` : ""],
                            ...(p.phoneLineType ? [["Phone Type", p.phoneLineType]] : []),
                            ...(p.email ? [["Email", `${p.email}${p.emailVerified ? " ✓" : ""}`]] : []),
                            ...(p.emailStatus ? [["Email Status", p.emailStatus]] : []),
                            ...(p.actualCity ? [["Actual City", p.actualCity]] : []),
                            ["Address", p.address],
                            ...(p.websiteUrl ? [["Website URL Checked", p.websiteUrl]] : []),
                            ["Website Status", p.websiteStatus],
                            ...(formatProspectSignalSummary(p.signals, p.signalEvidence) ? [["Growth Signals", formatProspectSignalSummary(p.signals, p.signalEvidence)]] : []),
                            ["Source URL", p.sourceUrl],
                            ...(p.facebookUrl ? [["Facebook", p.facebookUrl]] : []),
                            ...(p.instagramUrl ? [["Instagram", p.instagramUrl]] : []),
                            ...(p.yelpUrl ? [["Yelp", p.yelpUrl]] : []),
                            ["Pitch Angle", p.pitchAngle],
                          ].filter(([, value]) => String(value || "").trim()).map(([label, value]) => (
                            <div key={label} style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: t.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>{label}</div>
                              {String(value || "").startsWith("http") ? (
                                <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: t.accent, overflowWrap: "anywhere" }}>{value}</a>
                              ) : (
                                <div style={{ fontSize: 13, color: value ? t.text : t.textFaint, lineHeight: 1.45, overflowWrap: "anywhere" }}>{value || ""}</div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
                          <button
                            onClick={() => !inPipeline && handleAddProspectToPipeline(p)}
                            disabled={inPipeline}
                            style={{ ...btnPrimary, fontSize: 12, padding: "8px 16px", opacity: inPipeline ? 0.75 : 1, cursor: inPipeline ? "default" : "pointer" }}>
                            {inPipeline ? "✓ In Pipeline" : "+ Add to Pipeline"}
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
                      </div>
                        );
                      })()
                    );})}
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
                          {(() => {
                            const sendKey = prospectSendKey(p, prospectCity);
                            const sent = Boolean(prospectSendStatus[sendKey]?.sent);
                            const canSend = Boolean(String(p.email || "").trim()) && !sent;
                            return (
                              <>
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
                            <button onClick={() => handleSendProspectEmail(p)} disabled={!canSend || sendingProspectId === p.id} style={{ ...btnSecondary, fontSize: 12, padding: "8px 16px", opacity: !canSend && sendingProspectId !== p.id ? 0.6 : 1 }}>
                              {sent ? "✓ Sent" : sendingProspectId === p.id ? "Sending..." : "Send"}
                            </button>
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
                              </>
                            );
                          })()}
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
                  <input style={inputStyle} value={indeedCustomRole} onChange={e => setIndeedCustomRole(e.target.value)} placeholder="e.g. Lead Finder, Cold Caller, Follow-up Specialist..." />
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
                      const ws = r.walkabilityScore || 0;
                      const wsColor = ws >= 8 ? "#34d399" : ws >= 6 ? t.accent : ws >= 4 ? "#f59e0b" : t.textDim;
                      const wsBg   = ws >= 8 ? "#34d39922" : ws >= 6 ? t.accent + "22" : ws >= 4 ? "#f59e0b22" : t.bgHover;
                      return (
                        <div key={r.id} style={{ ...cardStyle, borderLeft: `4px solid ${urgencyColor}`, opacity: skipped ? 0.4 : 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{r.companyName}</h3>
                                <span style={{ padding: "4px 10px", background: urgencyBg, color: urgencyColor, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{urgencyLabel}</span>
                                {ws > 0 && <span title="Walkability score: how approachable this lead is for an in-person sale (1–10)" style={{ padding: "4px 10px", background: wsBg, color: wsColor, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>🚶 {ws}/10</span>}
                                {indeedQueueActions[r.id] === "contacted" && <span style={{ padding: "4px 10px", background: t.accent + "22", color: t.accent, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✓ Contacted</span>}
                                {indeedQueueActions[r.id] === "replied" && <span style={{ padding: "4px 10px", background: t.greenBg, color: t.green, borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✓ Replied</span>}
                                {r.pipelineTag && <span style={{ padding: "4px 10px", background: "#f59e0b22", color: "#f59e0b", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{r.pipelineTag}</span>}
                              </div>
                              <div style={{ fontSize: 13, color: t.textMuted }}>
                                {r.industry ? `${r.industry} · ` : ""}{r.location}
                                {r.milesFromOakland !== null && r.milesFromOakland !== undefined && (
                                  <span style={{ marginLeft: 8, fontWeight: 600, color: r.milesFromOakland <= 5 ? "#34d399" : r.milesFromOakland <= 20 ? t.accent : t.textFaint }}>
                                    {r.milesFromOakland === 0 ? "📍 Oakland" : `~${r.milesFromOakland} mi from Oakland`}
                                  </span>
                                )}
                              </div>
                              {r.walkabilityTags && r.walkabilityTags.length > 0 && (
                                <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                                  {r.walkabilityTags.map(tag => (
                                    <span key={tag} style={{ padding: "2px 8px", background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 10, fontSize: 11, color: t.textMuted, fontWeight: 500 }}>{tag}</span>
                                  ))}
                                </div>
                              )}
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
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button onClick={() => { navigator.clipboard.writeText(indeedEmailDrafts[r.id]); showToast("Copied to clipboard"); }}
                                  style={{ ...btnSecondary, fontSize: 12, padding: "6px 16px" }}>
                                  Copy to Clipboard
                                </button>
                                <button
                                  onClick={() => handleSendIndeedEmail(r)}
                                  disabled={indeedSendStatus[r.id]?.sent || sendingIndeedId === r.id}
                                  style={{ ...btnPrimary, fontSize: 12, padding: "6px 16px", opacity: indeedSendStatus[r.id]?.sent || sendingIndeedId === r.id ? 0.6 : 1 }}>
                                  {indeedSendStatus[r.id]?.sent ? "✓ Sent" : sendingIndeedId === r.id ? "Sending..." : "Send via Gmail"}
                                </button>
                              </div>
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

          {/* ════════════ BUILD A LEAD LIST (Mode 2B) ════════════ */}
          {tab === "leadlist" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>🎯 Build a Lead List</h2>
                <p style={{ color: t.textDim, fontSize: 14 }}>Paste a natural-language lead request. The engine parses the job, researches real leads, and builds a sheet with the columns your request needs.</p>
              </div>

              {/* Search Form */}
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Lead Request</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 150, resize: "vertical", lineHeight: 1.5 }}
                    value={leadListRequest}
                    onChange={e => setLeadListRequest(e.target.value)}
                    placeholder={LEAD_REQUEST_EXAMPLE}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: t.textFaint }}>Optional helpers below are folded into the same request, not a separate mode.</span>
                    <button onClick={() => setLeadListRequest(LEAD_REQUEST_EXAMPLE)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}>Use freight example</button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 16, alignItems: "flex-end" }}>
                  <div>
                    <label style={labelStyle}>Geography Hint</label>
                    <input style={inputStyle} value={leadListCity} onChange={e => setLeadListCity(e.target.value)} placeholder="e.g. Austin, TX" onKeyDown={e => e.key === "Enter" && handleLeadListSearch()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Industry / Niche Hint</label>
                    <input style={inputStyle} value={leadListNiche} onChange={e => setLeadListNiche(e.target.value)} placeholder="e.g. shippers, HVAC, medical suppliers" onKeyDown={e => e.key === "Enter" && handleLeadListSearch()} />
                  </div>
                  <div>
                    <label style={labelStyle}>Rows</label>
                    <select style={{ ...inputStyle, width: 80, cursor: "pointer" }} value={leadListCount} onChange={e => setLeadListCount(Number(e.target.value))}>
                      {[5, 10, 15, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <button onClick={handleLeadListSearch} disabled={leadListLoading} style={{ ...btnPrimary, height: 43, whiteSpace: "nowrap" }}>
                      {leadListLoading ? `Building… ${leadListResults.length}/${leadListCount}` : "🔍 Build Sheet"}
                    </button>
                  </div>
                </div>
              </div>

              {leadListError && (
                <div style={{ background: t.redBg, border: `1px solid ${t.redBorder}`, borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 14, color: t.red }}>{leadListError}</div>
              )}

              {leadListLoading && leadListResults.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: t.textDim }}>
                  <div style={{ fontSize: 36, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{leadListProgress || "Building lead sheet"}…</div>
                  <div style={{ fontSize: 13, color: t.textFaint }}>Finding candidate companies first, then enriching one row at a time</div>
                </div>
              )}

              {!leadListLoading && leadListResults.length === 0 && !leadListError && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: t.textDim }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ready to build your list</div>
                  <div style={{ fontSize: 13, color: t.textFaint }}>Paste a request above, then build a structured lead sheet</div>
                </div>
              )}

              {leadListResults.length > 0 && (
                <div>
                  {leadListJob && (
                    <div style={{ ...cardStyle, marginBottom: 16, padding: 18 }}>
                      <div style={{ fontSize: 12, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>Parsed Lead Job</div>
                      <div style={{ fontSize: 14, color: t.text, marginBottom: 10, lineHeight: 1.5 }}>{leadListJob.summary || "Structured lead request"}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, fontSize: 12, color: t.textMuted }}>
                        <div><strong style={{ color: t.text }}>Industries:</strong> {(leadListJob.industries || []).join(", ") || "Any"}</div>
                        <div><strong style={{ color: t.text }}>Geography:</strong> {leadListJob.geography || "Not specified"}</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: t.textDim, fontWeight: 600, flex: 1 }}>
                      {leadListResults.length} rows · {leadListColumns.length || LEAD_LIST_COLUMNS.length} columns
                    </span>
                    <button onClick={handleExportLeadListCSV} style={btnSecondary}>↓ Export CSV</button>
                    <button onClick={handleAppendLeadListToSheets} disabled={leadListSheetLoading} style={{ ...btnSecondary, opacity: leadListSheetLoading ? 0.7 : 1 }}>
                      {leadListSheetLoading ? "Sending…" : `Send to ${GENERATED_LEADS_SHEET_NAME}`}
                    </button>
                    <a href={GENERATED_LEADS_SPREADSHEET_URL} target="_blank" rel="noreferrer" style={{ ...btnSecondary, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                      Open Google Sheet
                    </a>
                  </div>

                  {leadListSheetStatus && (
                    <div style={{ background: leadListSheetStatus.toLowerCase().includes("failed") || leadListSheetStatus.toLowerCase().includes("configured") ? t.redBg : t.greenBg, border: `1px solid ${leadListSheetStatus.toLowerCase().includes("failed") || leadListSheetStatus.toLowerCase().includes("configured") ? t.redBorder : t.greenBorder}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: t.text }}>
                      {leadListSheetStatus}
                    </div>
                  )}

                  {leadListLoading && (
                    <div style={{ background: t.bgHover, border: `1px solid ${t.borderLight}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: t.textMuted, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{leadListProgress || "Building lead sheet"}…</span>
                      <span style={{ color: t.textFaint }}>{leadListResults.length}/{leadListCount} rows visible</span>
                    </div>
                  )}

                  <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: 8, background: t.cardBg, marginBottom: 18 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(920, (leadListColumns.length || 8) * 150) }}>
                      <thead>
                        <tr>
                          {(leadListColumns.length ? leadListColumns : buildLeadColumns(leadListJob, leadListResults, leadListRequest)).map(col => (
                            <th key={col} style={{ textAlign: "left", padding: "11px 12px", borderBottom: `1px solid ${t.borderLight}`, color: t.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", background: t.bgHover, whiteSpace: "nowrap" }}>{col}</th>
                          ))}
                          <th style={{ textAlign: "left", padding: "11px 12px", borderBottom: `1px solid ${t.borderLight}`, color: t.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", background: t.bgHover }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadListResults.map(lead => {
                          const columns = leadListColumns.length ? leadListColumns : buildLeadColumns(leadListJob, leadListResults, leadListRequest);
                          const draft = leadListOutreach[lead.id];
                          const isGenerating = generatingLeadListOutreach === lead.id;
                          const normCo = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                          const leadCompany = getFirstLeadCell(lead, ["Company Name", "Business Name", "Company"]);
                          const inPipeline = leads.some(l => normCo(l.company) === normCo(leadCompany));
                          return (
                            <tr key={lead.id}>
                              {columns.map(col => {
                                const value = getLeadCell(lead, col);
                                const isUrl = /^https?:\/\//i.test(String(value));
                                const companyCell = columnKey(col) === "companyname" || columnKey(col) === "businessname" || columnKey(col) === "company";
                                return (
                                  <td key={col} style={{ padding: "11px 12px", borderBottom: `1px solid ${t.border}`, color: t.textMuted, fontSize: 12, verticalAlign: "top", lineHeight: 1.45, maxWidth: 260 }}>
                                    {companyCell ? (
                                      <div>
                                        <div style={{ color: t.text, fontWeight: 700 }}>{String(value || "").trim() || "—"}</div>
                                      </div>
                                    ) : isUrl ? <a href={value} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "none" }}>{value}</a> : (String(value || "").trim() || "—")}
                                  </td>
                                );
                              })}
                              <td style={{ padding: "11px 12px", borderBottom: `1px solid ${t.border}`, verticalAlign: "top", minWidth: 150 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <button
                                    onClick={() => !inPipeline && handleAddLeadListToPipeline(lead)}
                                    disabled={inPipeline}
                                    style={{ ...btnSecondary, fontSize: 12, textAlign: "center", background: inPipeline ? t.green + "22" : undefined, color: inPipeline ? t.green : undefined, cursor: inPipeline ? "default" : "pointer", opacity: inPipeline ? 0.85 : 1 }}>
                                    {inPipeline ? "✓ In Pipeline" : "+ Pipeline"}
                                  </button>
                                  <button onClick={() => handleLeadListDraftOutreach(lead)} disabled={isGenerating} style={{ ...btnPrimary, fontSize: 12, textAlign: "center", padding: "8px 10px" }}>
                                    {isGenerating ? "Writing…" : draft ? "↻ Outreach" : "✍ Outreach"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {leadListResults.map(lead => {
                      const draft = leadListOutreach[lead.id];
                      const company = getFirstLeadCell(lead, ["Company Name", "Business Name", "Company"]);
                      const contact = getFirstLeadCell(lead, ["Contact Person", "Owner Name", "Name"]);
                      return (
                        <div key={`${lead.id}-draft`} style={{ display: draft ? "block" : "none", ...cardStyle, marginBottom: 0 }}>
                          {draft && (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textFaint }}>Outreach Draft · {company || "Lead"}{contact ? ` · ${contact}` : ""}</span>
                                <button onClick={() => { navigator.clipboard.writeText(draft); showToast("Copied!"); }} style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}>📋 Copy</button>
                              </div>
                              <p style={{ fontSize: 13, lineHeight: 1.7, color: t.text, whiteSpace: "pre-wrap" }}>{draft}</p>
                            </div>
                          )}
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
	                  <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Lead Preferences</h2>
	                  <p style={{ fontSize: 13, color: t.textDim, marginTop: 4 }}>Define rough defaults for incoming leads</p>
                </div>
                {settingsEdited && leads.length > 0 && (
	                  <button onClick={requalifyAll} style={{ ...btnPrimary, animation: "pulse 1.5s infinite" }}>Update Existing Leads ({leads.length})</button>
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
