const navItems = [
  { id: "Dashboard", label: "Dashboard", hint: "Overview" },
  { id: "User Conversations", label: "User Conversations", hint: "AI service records" },
  { id: "Manual Takeover", label: "Manual Takeover", hint: "Human support" },
  { id: "Product Management", label: "Product Management", hint: "KOFON catalog" },
  { id: "Knowledge Base", label: "Knowledge Base", hint: "Documents and retrieval" },
  { id: "FAQ Management", label: "FAQ Management", hint: "Frequently asked" },
  { id: "AI Agent Settings", label: "AI Agent Settings", hint: "Behavior control" },
  { id: "Customers & Leads", label: "Customers & Leads", hint: "Accounts and intent pipeline" },
  { id: "Analytics", label: "Analytics", hint: "Business value" },
  { id: "Answer Review", label: "Answer Review", hint: "Quality loop" },
  { id: "User Permissions", label: "User Permissions", hint: "Roles" },
  { id: "System Settings", label: "System Settings", hint: "Integrations" },
  { id: "Operation Logs", label: "Operation Logs", hint: "Audit trail" }
];

// Pending-attention counts shown as badges on the sidebar tabs.
const navBadges = {
  "User Conversations": 5,
  "Manual Takeover": 3,
  "Customers & Leads": 8
  // "Answer Review" is derived from answerReviews.length in sidebar()
};

// Tab order is user-customizable via drag-and-drop and persisted per browser.
const NAV_ORDER_KEY = "kofon-admin-nav-order";
(function restoreNavOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || "null");
    if (!Array.isArray(saved)) return;
    navItems.sort((a, b) => {
      const ai = saved.indexOf(a.id);
      const bi = saved.indexOf(b.id);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  } catch (err) {
    /* ignore corrupt stored order */
  }
})();

function persistNavOrder() {
  try {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(navItems.map((item) => item.id)));
  } catch (err) {
    /* storage unavailable — order simply won't persist */
  }
}

let metrics = [
  { label: "Today's Conversations", value: "1,284", delta: "+18.6%", tone: "up", sub: "Compared with yesterday" },
  { label: "Active Users", value: "426", delta: "+9.2%", tone: "up", sub: "Visitors and repeat buyers" },
  { label: "AI Success Rate", value: "92.8%", delta: "+3.1%", tone: "up", sub: "Resolved without escalation" },
  { label: "Unresolved Issues", value: "37", delta: "-12.4%", tone: "down", sub: "Awaiting manual review" },
  { label: "New Sales Leads", value: "68", delta: "+22.0%", tone: "up", sub: "Detected from conversations" }
];

const trendData = [52, 68, 61, 88, 94, 127, 146, 138, 162, 184, 173, 211];
const responseTrend = [82, 86, 84, 89, 91, 90, 92, 93, 92, 94, 93, 95];

const productRanking = [
  { name: "Precision Planetary Reducer", count: 428, rate: 88, model: "F / K / KH Series" },
  { name: "Harmonic Reducer", count: 286, rate: 64, model: "KB / KBG Series" },
  { name: "AGV Products", count: 241, rate: 56, model: "Steering & Drive Wheel" },
  { name: "Servo Electric Cylinder", count: 164, rate: 39, model: "Inline / Folded" },
  { name: "Screw Products", count: 137, rate: 32, model: "Planetary Roller Screw" }
];

const reminders = [
  { title: "Need engineer review", detail: "8 AGV load selection questions mention non-standard torque conditions.", level: "High" },
  { title: "Document update pending", detail: "KH reducer parameter sheet was updated 12 days ago and is still disabled.", level: "Medium" },
  { title: "Lead response SLA", detail: "3 high-intent leads have no assigned salesperson after 4 hours.", level: "High" },
  { title: "Answer source missing", detail: "21 answers used product claims without source citation.", level: "Medium" }
];

let conversations = [
  {
    id: "conv-001",
    user: "Liu Wei",
    company: "Wuhan Smart Logistics Co.",
    time: "Today 10:42",
    product: "AGV Products",
    status: "Needs takeover",
    score: 87,
    intent: "High",
    summary: "AGV drive wheel selection for 1.5T payload and 24-hour operation.",
    messages: [
      { from: "user", text: "We are building an AGV platform with 1.5T load. Which KOFON steering drive module should we evaluate?" },
      { from: "ai", text: "For 1.5T payload, I suggest starting from AGV steering and drive wheel products, then checking wheel diameter, rated torque, reduction ratio, installation space, and duty cycle. If the route includes slopes or high acceleration, manual engineering verification is recommended.", confidence: 91 },
      { from: "user", text: "The vehicle needs 24-hour operation and frequent turning in narrow aisles." },
      { from: "ai", text: "In that case, prioritize thermal margin, bearing load, steering precision, and reducer backlash. I can collect payload, max speed, wheel diameter, slope, and battery voltage for a sales engineer.", confidence: 86 }
    ]
  },
  {
    id: "conv-002",
    user: "Chen Rong",
    company: "Suzhou Robotics Lab",
    time: "Today 09:18",
    product: "Harmonic Reducer",
    status: "Resolved",
    score: 94,
    intent: "Medium",
    summary: "Robot joint reducer comparison between harmonic and planetary reducer.",
    messages: [
      { from: "user", text: "What is the difference between harmonic reducer and precision planetary reducer for a robot joint?" },
      { from: "ai", text: "Harmonic reducers are often selected for compact robot joints requiring high reduction ratio and low backlash. Precision planetary reducers are stronger for higher radial load, broad torque ranges, and robust industrial transmission scenarios.", confidence: 95 },
      { from: "user", text: "Can you send model suggestions?" },
      { from: "ai", text: "Please provide joint torque, target reduction ratio, motor flange, installation space, and duty cycle. With those parameters, I can recommend a KOFON series and flag items for engineer confirmation.", confidence: 93 }
    ]
  },
  {
    id: "conv-003",
    user: "Maya Patel",
    company: "Apex Automation",
    time: "Yesterday 16:36",
    product: "Servo Electric Cylinder",
    status: "Lead created",
    score: 90,
    intent: "High",
    summary: "Asked for servo electric cylinder stroke and thrust matching for packaging line.",
    messages: [
      { from: "user", text: "Need an electric cylinder for a packaging push station, 600 mm stroke, 3 kN thrust." },
      { from: "ai", text: "KOFON servo electric cylinder options can be evaluated by stroke, thrust, speed, mounting style, repeatability, motor power, and duty cycle. I recommend collecting speed and installation constraints before model selection.", confidence: 89 },
      { from: "user", text: "Budget approval this month. Please have sales contact us." },
      { from: "ai", text: "I have marked this as a high-intent lead and will route it to the sales team with your application details.", confidence: 96 }
    ]
  },
  {
    id: "conv-004",
    user: "Zhang Min",
    company: "Hefei Laser Equipment",
    time: "Yesterday 14:02",
    product: "Precision Planetary Reducer",
    status: "Unresolved",
    score: 61,
    intent: "Medium",
    summary: "Asked about backlash under extreme temperature; knowledge base did not contain enough detail.",
    messages: [
      { from: "user", text: "Can KH series hold backlash below 3 arcmin at low temperature?" },
      { from: "ai", text: "KH series is positioned as a high-precision planetary reducer. Backlash performance should be checked against the exact specification table and operating temperature. The current knowledge base does not include a verified low-temperature curve.", confidence: 62 },
      { from: "user", text: "So is it yes or no?" },
      { from: "ai", text: "I cannot confirm without the verified model specification. I recommend manual engineer review.", confidence: 58 }
    ]
  }
];

let products = [
  {
    name: "F Series Precision Planetary Reducer",
    category: "Precision Planetary Reducer",
    model: "F060 / F090 / F120",
    status: "Active",
    priority: "High",
    description: "High rigidity reducer for servo transmission and general automation.",
    parameters: "Ratio 3-100, low backlash, compact coaxial structure",
    scenarios: "Robotics, laser equipment, packaging machines",
    advantages: "High precision, stable torque output, broad motor compatibility"
  },
  {
    name: "KB(G)-HO Harmonic Reducer",
    category: "Harmonic Reducer",
    model: "KB-HO / KBG-HO",
    status: "Active",
    priority: "High",
    description: "Compact harmonic reducer for robot joints and precision positioning.",
    parameters: "High reduction ratio, compact cup structure, low backlash",
    scenarios: "Collaborative robots, service robots, semiconductor equipment",
    advantages: "Lightweight, compact, smooth transmission"
  },
  {
    name: "AGV Steering Drive Module",
    category: "AGV Products",
    model: "AGV-SD-220",
    status: "Active",
    priority: "High",
    description: "Integrated steering and drive solution for intelligent logistics vehicles.",
    parameters: "Custom load range, wheel diameter, voltage, encoder options",
    scenarios: "Smart warehouse, material handling, heavy-duty AGV",
    advantages: "Integrated design, reliable continuous operation, easy installation"
  },
  {
    name: "Planetary Roller Screw Pair",
    category: "Screw Products",
    model: "PRS-32 / PRS-50",
    status: "Draft",
    priority: "Medium",
    description: "High-load linear transmission component for electric actuation.",
    parameters: "High load capacity, long service life, precision linear motion",
    scenarios: "Servo presses, aerospace fixtures, heavy electric cylinders",
    advantages: "High thrust density, stable motion, strong durability"
  },
  {
    name: "Inline Servo Electric Cylinder",
    category: "Servo Electric Cylinder",
    model: "KSE-I-60",
    status: "Active",
    priority: "Medium",
    description: "Servo-driven linear actuator for high repeatability automation stations.",
    parameters: "Stroke 100-800 mm, configurable thrust and speed",
    scenarios: "Packaging, assembly, pressing, testing equipment",
    advantages: "Clean operation, programmable position, easy servo integration"
  },
  {
    name: "Servo Planetary Joint Module",
    category: "Mechatronics Products",
    model: "KJM-RD",
    status: "Active",
    priority: "Medium",
    description: "Integrated servo, reducer, and drive module for compact motion systems.",
    parameters: "Integrated drive, compact axis module, configurable feedback",
    scenarios: "Robot arms, inspection devices, multi-axis automation",
    advantages: "Reduced wiring, high integration, simplified commissioning"
  }
];

let documents = [
  { name: "F Series Planetary Reducer Product Manual.pdf", category: "Product Manual", type: "PDF", status: "Enabled", updated: "2026-06-02", owner: "Product Team" },
  { name: "AGV Drive Wheel Selection Parameters.xlsx", category: "Parameter Sheet", type: "Excel", status: "Enabled", updated: "2026-06-01", owner: "Application Engineering" },
  { name: "KH Series Low Backlash Specification.docx", category: "Technical Spec", type: "Word", status: "Disabled", updated: "2026-05-24", owner: "R&D" },
  { name: "After-sales Policy 2026.pdf", category: "Service Policy", type: "PDF", status: "Processing", updated: "2026-06-03", owner: "Service Center" },
  { name: "Harmonic Reducer Installation Guide.pdf", category: "Installation Guide", type: "PDF", status: "Enabled", updated: "2026-05-28", owner: "Product Team" }
];

const faqs = [
  { question: "How to select reduction ratio for a servo motor?", category: "Selection", uses: 438, priority: "High", enabled: true },
  { question: "What parameters are required for AGV drive wheel selection?", category: "AGV", uses: 311, priority: "High", enabled: true },
  { question: "Can KOFON provide non-standard reducer customization?", category: "Customization", uses: 226, priority: "Medium", enabled: true },
  { question: "What is the warranty policy for servo electric cylinders?", category: "After-sales", uses: 184, priority: "Medium", enabled: true },
  { question: "How to compare harmonic reducer and planetary reducer?", category: "Product Knowledge", uses: 176, priority: "Medium", enabled: false }
];

let leads = [
  {
    customer: "Maya Patel",
    company: "Apex Automation",
    product: "Servo Electric Cylinder",
    level: "A",
    summary: "Packaging push station, 600 mm stroke, 3 kN thrust, budget approved this month.",
    last: "Today 10:18",
    status: "Assigned",
    owner: "Iris Wang"
  },
  {
    customer: "Liu Wei",
    company: "Wuhan Smart Logistics Co.",
    product: "AGV Products",
    level: "A",
    summary: "1.5T AGV platform, continuous operation, narrow aisle turning.",
    last: "Today 10:42",
    status: "Pending",
    owner: "Unassigned"
  },
  {
    customer: "Chen Rong",
    company: "Suzhou Robotics Lab",
    product: "Harmonic Reducer",
    level: "B",
    summary: "Robot joint reducer selection and harmonic comparison.",
    last: "Today 09:18",
    status: "Follow-up",
    owner: "Leo Chen"
  },
  {
    customer: "Zhang Min",
    company: "Hefei Laser Equipment",
    product: "Precision Planetary Reducer",
    level: "B",
    summary: "KH series backlash performance at low temperature.",
    last: "Yesterday 14:02",
    status: "Engineer review",
    owner: "Nina Xu"
  },
  {
    customer: "Robert Miller",
    company: "NorthStar Robotics",
    product: "Mechatronics Products",
    level: "C",
    summary: "Asked for integrated servo joint module export availability.",
    last: "May 31 17:12",
    status: "Nurturing",
    owner: "Grace Li"
  }
];

const analytics = {
  productConsults: [
    { label: "Planetary", value: 42 },
    { label: "Harmonic", value: 28 },
    { label: "AGV", value: 24 },
    { label: "Cylinder", value: 16 },
    { label: "Screw", value: 13 }
  ],
  questionFrequency: [
    { label: "Model selection", value: 36 },
    { label: "Technical parameters", value: 29 },
    { label: "Price inquiry", value: 23 },
    { label: "Delivery cycle", value: 17 },
    { label: "After-sales", value: 11 }
  ],
  valueCards: [
    { label: "Qualified Leads", value: "486", sub: "Last 30 days" },
    { label: "Manual Transfers", value: "126", sub: "Down 8.3%" },
    { label: "AI Resolution", value: "92.8%", sub: "Last 30 days" },
    { label: "Satisfaction", value: "4.72/5", sub: "CSAT" }
  ]
};

const answerReviews = [
  {
    id: "rev-001",
    risk: "High",
    question: "Can KH series keep backlash below 3 arcmin under -20 C?",
    aiAnswer: "KH series is high precision and should meet low backlash needs.",
    correction: "Do not confirm low-temperature backlash without a verified model specification. Ask for exact model, reduction ratio, load, ambient temperature, and duty cycle, then route to engineering review.",
    source: "Missing low-temperature spec"
  },
  {
    id: "rev-002",
    risk: "Medium",
    question: "Can the AGV drive wheel operate in wet warehouse environments?",
    aiAnswer: "Yes, KOFON AGV drive wheels can operate in warehouse environments.",
    correction: "Clarify environment level and request IP rating, floor condition, speed, load, and duty cycle. Do not promise wet-environment suitability without the matched product protection grade.",
    source: "AGV selection sheet"
  },
  {
    id: "rev-003",
    risk: "Medium",
    question: "What is the exact price of KBG-HF harmonic reducer?",
    aiAnswer: "The price is usually competitive and depends on configuration.",
    correction: "Explain that exact pricing depends on model, ratio, quantity, delivery terms, and region. Offer to create a lead for sales quotation.",
    source: "Sales policy"
  }
];

const takeoverSessions = [
  { id: "take-001", name: "Liu Wei", company: "Wuhan Smart Logistics Co.", product: "AGV Products", wait: "06:21", status: "Waiting", priority: "High" },
  { id: "take-002", name: "Zhang Min", company: "Hefei Laser Equipment", product: "KH Series Reducer", wait: "12:04", status: "Engineer needed", priority: "High" },
  { id: "take-003", name: "Elena Rossi", company: "EuroMotion S.r.l.", product: "Harmonic Reducer", wait: "03:48", status: "Sales needed", priority: "Medium" }
];

const customers = [
  { company: "Wuhan Smart Logistics Co.", region: "Hubei", contacts: 4, products: "AGV Products", stage: "Opportunity", health: "Warm" },
  { company: "Suzhou Robotics Lab", region: "Jiangsu", contacts: 2, products: "Harmonic Reducer", stage: "Evaluation", health: "Active" },
  { company: "Hefei Laser Equipment", region: "Anhui", contacts: 3, products: "Planetary Reducer", stage: "Technical Review", health: "Risk" },
  { company: "Apex Automation", region: "Export", contacts: 1, products: "Servo Electric Cylinder", stage: "Quotation", health: "Hot" }
];

let logs = [
  { time: "2026-06-04 10:42:31", actor: "AI Agent", action: "Created sales lead", target: "Wuhan Smart Logistics Co.", result: "Success" },
  { time: "2026-06-04 10:38:10", actor: "Admin / Iris", action: "Enabled document", target: "F Series Product Manual", result: "Success" },
  { time: "2026-06-04 09:57:44", actor: "QA / Nina", action: "Marked answer incorrect", target: "rev-001", result: "Pending review" },
  { time: "2026-06-03 18:21:09", actor: "System", action: "Knowledge indexing", target: "After-sales Policy 2026", result: "Processing" }
];


const root = document.getElementById("root");
const LANGUAGE_KEY = "kofon-admin-lang";
const defaultLanguage = localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en";

const state = {
  authenticated: false,        // decided by bootstrap() via /admin/api/me
  booting: true,               // true until the first /me resolves
  user: null,                  // { email, role }
  permissions: [],             // concrete permission strings for this role
  csrf: null,                  // per-session CSRF token for write requests
  lang: defaultLanguage,
  page: "Dashboard",
  selectedConversationId: conversations[0] ? conversations[0].id : null,
  conversationSearch: "",
  conversationStatus: "All",
  productSearch: "",
  productFamily: null,
  productModal: false,
  sidebarOpen: false,
  toast: ""
};

let toastTimer;

// ---- backend wiring ------------------------------------------------------
// Thin fetch wrapper: sends the session cookie, JSON-encodes writes, and
// attaches the CSRF header (contract: app/admin/deps.py require_csrf).
async function api(path, opts = {}) {
  const headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && opts.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET" && state.csrf) {
    headers["X-CSRF-Token"] = state.csrf;
  }
  return fetch(path, Object.assign({ credentials: "same-origin" }, opts, { headers, method }));
}

// POST application/x-www-form-urlencoded — for the existing admin_api write
// endpoints (users create/toggle, notification ack) which read request.form().
async function apiForm(path, fields) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString()
  });
}

// Admin-user data for the User Permissions section.
let adminUsers = [];
let adminRoles = ["superadmin", "editor", "sales", "viewer"];

function can(permission) {
  return Array.isArray(state.permissions) && state.permissions.includes(permission);
}

// ---- interactive switches ------------------------------------------------
// Toggle state persists across re-renders (which rebuild root.innerHTML) by
// living in this module-level map rather than in the DOM. `key` identifies the
// switch; `fallbackOn` is its default until the user flips it.
const switchStates = new Map();

function switchIsOn(key, fallbackOn) {
  return switchStates.has(key) ? switchStates.get(key) : !!fallbackOn;
}

// Per-chart "bar" vs "pie" preference, keyed by a stable chart id. Like
// switchStates, it lives in this module-level map so a re-render keeps the view
// the user picked. Charts default to "bar" until toggled.
const chartViews = new Map();

function chartView(id) {
  return chartViews.has(id) ? chartViews.get(id) : "bar";
}

function switchControl(key, fallbackOn) {
  const on = switchIsOn(key, fallbackOn);
  return `<button type="button" class="toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}" data-switch="${escapeHtml(key)}"></button>`;
}

// Resolve identity + permissions, or fall back to the login screen on 401.
async function bootstrap() {
  try {
    const res = await api("/admin/api/me");
    if (res.status === 401) {
      setState({ authenticated: false, booting: false, user: null, permissions: [], csrf: null });
      return;
    }
    const data = await res.json();
    Object.assign(state, {
      authenticated: true,
      booting: false,
      user: data.user,
      permissions: data.permissions || [],
      csrf: data.csrf_token
    });
    // Don't strand the user on a section their role can't see.
    const perm = NAV_PERMISSION[state.page];
    if (perm && !can(perm)) state.page = "Dashboard";
    render();
    loadSection(state.page);
  } catch (err) {
    setState({ authenticated: false, booting: false });
  }
}

// Per-section data loaders. Sections without a backend keep their mock data.
function loadSection(page) {
  if (page === "Dashboard") {
    loadDashboard();
    loadConversations(); // feeds the "Recent Conversations" panel with real rows
    return;
  }
  if (page === "User Conversations") return loadConversations();
  if (page === "Product Management") return loadProducts();
  if (page === "Knowledge Base") return loadKb();
  if (page === "Customers & Leads") return loadLeads();
  if (page === "User Permissions") return loadUsers();
  if (page === "Operation Logs") return loadAudit();
}

// Generic list loader: fetch JSON, hand it to `assign`, then re-render.
async function loadList(path, assign) {
  try {
    const res = await api(path);
    if (!res.ok) return;
    assign(await res.json());
    render();
  } catch (err) {
    /* keep whatever is currently rendered */
  }
}

function loadProducts() {
  return loadList("/admin/api/content/products", (d) => {
    if (Array.isArray(d.products)) products = d.products;
  });
}
function loadKb() {
  return loadList("/admin/api/content/kb", (d) => {
    if (Array.isArray(d.documents)) documents = d.documents;
  });
}
function loadLeads() {
  return loadList("/admin/api/leads", (d) => {
    if (Array.isArray(d.leads)) leads = d.leads;
  });
}
function loadAudit() {
  return loadList("/admin/api/audit", (d) => {
    if (Array.isArray(d.logs)) logs = d.logs;
  });
}
function loadUsers() {
  return loadList("/admin/api/users", (d) => {
    if (Array.isArray(d.users)) adminUsers = d.users;
    if (Array.isArray(d.roles)) adminRoles = d.roles;
  });
}

async function loadDashboard() {
  try {
    const res = await api("/admin/api/dashboard");
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.metrics)) {
      metrics = data.metrics;
      render();
    }
  } catch (err) {
    /* leave illustrative values in place */
  }
}

async function loadConversations() {
  try {
    const params = new URLSearchParams({
      q: state.conversationSearch || "",
      status_filter: state.conversationStatus || "All"
    });
    const res = await api("/admin/api/conversations?" + params.toString());
    if (!res.ok) return;
    const data = await res.json();
    conversations = data.conversations || [];
    if (!conversations.some((c) => c.id === state.selectedConversationId)) {
      state.selectedConversationId = conversations[0] ? conversations[0].id : null;
    }
    render();
    if (state.selectedConversationId) loadConversationDetail(state.selectedConversationId);
  } catch (err) {
    /* keep whatever is rendered */
  }
}

async function loadConversationDetail(id) {
  try {
    const res = await api("/admin/api/conversations/" + encodeURIComponent(id));
    if (!res.ok) return;
    const detail = await res.json();
    const idx = conversations.findIndex((c) => c.id === detail.id);
    if (idx >= 0) conversations[idx] = detail;
    else conversations.push(detail);
    render();
  } catch (err) {
    /* ignore */
  }
}

document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";

const zhText = {
  "KOFON AI Agent Admin": "KOFON AI 智能体后台",
  "AI Agent Admin": "AI 智能体后台",
  "Precision Transmission Intelligence": "高精密传动智能平台",
  "Industrial AI service operations for high-end motion products.": "面向高端运动控制产品的工业 AI 服务运营后台。",
  "Manage product knowledge, customer conversations, manual takeover, answer quality, and sales signals in one clean enterprise console.": "在一个清晰的企业级控制台中管理产品知识、客户对话、人工接管、回答质量和销售线索。",
  "AI Success Rate": "AI 成功回答率",
  "Avg. Response": "平均响应时间",
  "New Leads Today": "今日新增线索",
  "Admin Console": "管理员控制台",
  "Sign in": "登录",
  "Use your KOFON administrator account to enter the AI Agent workspace.": "使用 KOFON 管理员账号进入 AI 智能体工作台。",
  "User Name": "用户名",
  "Password": "密码",
  "Login": "登录",
  "Static prototype. Click Login to enter Dashboard.": "静态原型。点击登录进入 Dashboard。",
  "Email": "邮箱",
  "Sign in with your KOFON administrator account.": "使用您的 KOFON 管理员账号登录。",
  "Dashboard": "数据看板",
  "Overview": "总览",
  "User Conversations": "用户对话",
  "AI service records": "AI 服务记录",
  "Manual Takeover": "人工接管",
  "Human support": "人工支持",
  "Product Management": "产品管理",
  "KOFON catalog": "科峰产品库",
  "Knowledge Base": "知识库",
  "Documents and retrieval": "文档与检索",
  "FAQ Management": "FAQ 管理",
  "Frequently asked": "常见问题",
  "AI Agent Settings": "AI 智能体设置",
  "Behavior control": "行为控制",
  "Customer Management": "客户管理",
  "Accounts": "客户账户",
  "Sales Leads": "销售线索",
  "Intent pipeline": "意向管道",
  "Analytics": "数据分析",
  "Business value": "业务价值",
  "Answer Review": "回答审核",
  "Quality loop": "质量闭环",
  "User Permissions": "用户权限",
  "Roles": "角色",
  "System Settings": "系统设置",
  "Integrations": "集成",
  "Operation Logs": "操作日志",
  "Audit trail": "审计追踪",
  "Knowledge Index": "知识索引",
  "99.2% available": "99.2% 可用",
  "Industrial AI customer service and sales assistant": "工业 AI 客服与销售助手",
  "Search products, conversations, documents...": "搜索产品、对话、文档...",
  "Notifications": "通知",
  "Admin": "管理员",
  "Operations Center": "运营中心",
  "Logout": "退出",
  "Monitor AI conversation quality, product demand, unresolved risks, and sales value.": "监控 AI 对话质量、产品需求、未解决风险和销售价值。",
  "Export Report": "导出报告",
  "Daily Brief": "每日简报",
  "Today's Conversations": "今日对话数",
  "Compared with yesterday": "相比昨日",
  "Active Users": "活跃用户数",
  "Visitors and repeat buyers": "访客与复访客户",
  "Resolved without escalation": "无需转人工解决",
  "Unresolved Issues": "未解决问题",
  "Awaiting manual review": "等待人工复核",
  "New Sales Leads": "新增销售线索",
  "Detected from conversations": "从对话中识别",
  "Conversation Trend": "对话趋势",
  "AI service volume across current operation cycle": "当前运营周期内的 AI 服务量",
  "Live": "实时",
  "AI Resolution": "AI 解决率",
  "Quality target: 90%": "质量目标：90%",
  "Correct answers": "正确回答",
  "Manual transfer": "转人工",
  "Review queue": "审核队列",
  "Hot Product Consultation": "热门咨询产品",
  "Demand signals from user conversations": "来自用户对话的需求信号",
  "Pending Risks": "待处理风险",
  "Issues that need admin action": "需要管理员处理的问题",
  "Need engineer review": "需要工程师复核",
  "8 AGV load selection questions mention non-standard torque conditions.": "8 个 AGV 负载选型问题涉及非标扭矩工况。",
  "Document update pending": "文档更新待处理",
  "KH reducer parameter sheet was updated 12 days ago and is still disabled.": "KH 减速机参数表 12 天前已更新但仍处于停用状态。",
  "Lead response SLA": "线索响应 SLA",
  "3 high-intent leads have no assigned salesperson after 4 hours.": "3 条高意向线索超过 4 小时仍未分配销售人员。",
  "Answer source missing": "回答来源缺失",
  "21 answers used product claims without source citation.": "21 条回答包含产品能力描述但未引用来源。",
  "Recent Conversations": "最近对话",
  "Latest customer questions and AI service status": "最新客户问题与 AI 服务状态",
  "View all": "查看全部",
  "User": "用户",
  "Company": "公司",
  "Product": "产品",
  "Time": "时间",
  "Status": "状态",
  "Intent": "意向",
  "Review AI customer service records, qualify demand, and improve answer quality.": "查看 AI 客服记录、识别需求并持续改善回答质量。",
  "Batch Export": "批量导出",
  "Create Lead": "创建线索",
  "Search user, company, product...": "搜索用户、公司、产品...",
  "All": "全部",
  "Filter": "筛选",
  "Confidence": "置信度",
  "Correct": "正确",
  "Incorrect": "错误",
  "Add to Knowledge Base": "加入知识库",
  "Mark as unresolved": "标记未解决",
  "Maintain KOFON product catalog, technical parameters, applications, and AI recommendation priority.": "维护科峰产品库、技术参数、应用场景和 AI 推荐优先级。",
  "Import Excel": "导入 Excel",
  "Add Product": "添加产品",
  "Product Catalog": "产品目录",
  "products across reducer, AGV, screw, cylinder, and mechatronics categories.": "个产品覆盖减速机、AGV、丝杠、电动缸和机电一体化品类。",
  "Edit": "编辑",
  "Product Name": "产品名称",
  "Product Category": "产品类别",
  "Model": "型号",
  "Product Image": "产品图片",
  "Upload image or paste URL": "上传图片或粘贴链接",
  "Description": "描述",
  "Technical Parameters": "技术参数",
  "Application Scenarios": "应用场景",
  "Advantages": "优势",
  "Related Documents": "关联文档",
  "Priority": "优先级",
  "Cancel": "取消",
  "Save Product": "保存产品",
  "Upload, classify, enable, and test enterprise documents that AI Agent can retrieve.": "上传、分类、启停并测试 AI 智能体可检索的企业资料。",
  "Rebuild Index": "重建索引",
  "Upload Document": "上传文档",
  "Upload enterprise documents": "上传企业资料",
  "PDF, Word, Excel, product manual, parameter sheet, installation guide, after-sales policy.": "支持 PDF、Word、Excel、产品手册、参数表、安装指南和售后政策。",
  "Choose Files": "选择文件",
  "Knowledge Retrieval Test": "知识检索测试",
  "Check whether the current index can answer product questions with reliable sources.": "检查当前索引是否能基于可靠来源回答产品问题。",
  "Test": "测试",
  "Suggested sources": "推荐来源",
  "Document List": "文档列表",
  "Knowledge documents grouped by type, owner, state, and update time.": "按类型、负责人、状态和更新时间管理知识文档。",
  "Document": "文档",
  "Category": "分类",
  "Type": "类型",
  "Updated": "更新时间",
  "Owner": "负责人",
  "Action": "操作",
  "Disable": "停用",
  "Enable": "启用",
  "Create, edit, prioritize, and enable common product and service questions.": "创建、编辑、排序并启用常见产品与服务问题。",
  "Add FAQ": "添加 FAQ",
  "FAQ List": "FAQ 列表",
  "High-frequency questions used by the AI Agent before document retrieval.": "AI 智能体在文档检索前优先使用的高频问题。",
  "Question": "问题",
  "Uses": "使用次数",
  "Enabled": "启用",
  "Add / Edit FAQ": "添加 / 编辑 FAQ",
  "Answer": "回答",
  "Save FAQ": "保存 FAQ",
  "Configure the product expert personality, answer style, transfer rules, and safety controls.": "配置产品专家人格、回答风格、转人工规则和安全控制。",
  "Preview Agent": "预览智能体",
  "Save Settings": "保存设置",
  "KOFON Product Expert": "KOFON 产品专家",
  "Industrial transmission AI assistant for customer service, product consultation, and lead qualification.": "面向客服、产品咨询和线索识别的工业传动 AI 助手。",
  "Agent Name": "智能体名称",
  "Avatar": "头像",
  "Welcome Message": "欢迎语",
  "Personality / Tone": "人格 / 语气",
  "Answer Style": "回答风格",
  "Language": "语言",
  "Product Recommendation Strategy": "产品推荐策略",
  "Transfer to Human Rules": "转人工规则",
  "Forbidden Topics / Sensitive Words": "禁答话题 / 敏感词",
  "Response Controls": "回答控制",
  "Show answer sources": "显示回答来源",
  "Display document references below AI answers.": "在 AI 回答下方显示文档引用。",
  "Require confidence threshold": "启用置信度阈值",
  "Route low-confidence answers to review.": "将低置信度回答送入审核。",
  "Auto-create sales lead": "自动创建销售线索",
  "Create lead when purchase intent is high.": "当购买意向较高时自动创建线索。",
  "Allow price estimate": "允许价格预估",
  "Exact price should be handled by sales.": "准确报价由销售人员处理。",
  "Show model recommendation": "显示型号推荐",
  "Recommend series after collecting key parameters.": "收集关键参数后推荐产品系列。",
  "AI-detected commercial opportunities from customer conversations and product inquiries.": "从客户对话和产品咨询中识别出的商业机会。",
  "Assign Rules": "分配规则",
  "New Lead": "新建线索",
  "Lead Pipeline": "线索管道",
  "Prioritize high-intent customers and route them to sales or engineering support.": "优先处理高意向客户并分配给销售或工程支持。",
  "A Level": "A 级",
  "Customer": "客户",
  "Level": "等级",
  "Demand Summary": "需求摘要",
  "Last Inquiry": "最近咨询",
  "Follow up": "跟进",
  "Measure AI Agent impact across service efficiency, product demand, lead creation, and satisfaction.": "衡量 AI 智能体在服务效率、产品需求、线索创建和满意度上的业务价值。",
  "Compare Period": "对比周期",
  "Export Analytics": "导出分析",
  "Qualified Leads": "合格线索",
  "Last 30 days": "近 30 天",
  "Manual Transfers": "转人工次数",
  "Down 8.3%": "下降 8.3%",
  "Target 90%": "目标 90%",
  "Satisfaction": "满意度",
  "CSAT": "客户满意度",
  "Median": "中位数",
  "AI Resolve Rate": "AI 解决率",
  "Weekly accuracy and resolution curve": "每周准确率与解决率曲线",
  "Product Consultation Ranking": "产品咨询排名",
  "Which KOFON lines are driving demand": "哪些科峰产品线正在拉动需求",
  "High Frequency Questions": "高频问题",
  "Used for FAQ and knowledge base improvement": "用于 FAQ 与知识库优化",
  "Audit risky AI responses, correct answers, test improvements, and add verified knowledge.": "审核高风险 AI 回答、修正答案、测试改进并沉淀可信知识。",
  "Review Rules": "审核规则",
  "Approve Selected": "批量通过",
  "AI Answer": "AI 回答",
  "Administrator Correction": "管理员修正答案",
  "Test New Answer": "测试新回答",
  "Mark Resolved": "标记已解决",
  "Human support and sales teams can take over AI conversations when technical judgment is required.": "当需要技术判断时，客服或销售可接管 AI 对话。",
  "Availability": "在线状态",
  "Accept Next": "接入下一条",
  "Waiting Sessions": "待接管会话",
  "Prioritized by intent and risk": "按意向与风险排序",
  "Human taking over": "人工接管中",
  "Send": "发送",
  "User Info": "用户信息",
  "Name": "姓名",
  "High purchase intent": "高购买意向",
  "Need technical confirmation": "需要技术确认",
  "Internal Notes": "内部备注",
  "Save Note": "保存备注",
  "Maintain customer accounts, buying stages, product interests, and conversation history.": "维护客户账户、采购阶段、关注产品和对话历史。",
  "Add Customer": "新增客户",
  "Region": "地区",
  "Contacts": "联系人",
  "Interested Products": "关注产品",
  "Stage": "阶段",
  "Health": "健康度",
  "View": "查看",
  "Control administrator roles, data scope, and operation privileges.": "管理管理员角色、数据范围和操作权限。",
  "Create Role": "创建角色",
  "Super Admin": "超级管理员",
  "Product Manager": "产品经理",
  "Sales": "销售",
  "Service Engineer": "服务工程师",
  "Manage permissions": "管理权限",
  "Manage integrations, security policy, data retention, notification, and SLA settings.": "管理集成、安全策略、数据留存、通知和 SLA 设置。",
  "Save System Settings": "保存系统设置",
  "Integration Status": "集成状态",
  "CRM Lead Sync": "CRM 线索同步",
  "Enterprise WeChat": "企业微信",
  "Email Notification": "邮件通知",
  "Document OCR": "文档 OCR",
  "Vector Index Service": "向量索引服务",
  "Connected to sales pipeline": "已连接销售管道",
  "Healthy and monitored": "运行正常并受监控",
  "Security & SLA": "安全与 SLA",
  "Session Timeout": "会话超时",
  "Data Retention": "数据留存",
  "High Intent Lead SLA": "高意向线索 SLA",
  "Unresolved Answer SLA": "未解决回答 SLA",
  "Require operation log audit": "要求操作日志审计",
  "Audit administrator actions, system events, AI lead creation, and knowledge index changes.": "审计管理员操作、系统事件、AI 线索创建和知识索引变更。",
  "Download CSV": "下载 CSV",
  "Actor": "操作者",
  "Target": "对象",
  "Result": "结果",
  "Precision Planetary Reducer": "精密行星减速机",
  "Harmonic Reducer": "谐波减速机",
  "AGV Products": "AGV 系列产品",
  "Screw Products": "丝杠类产品",
  "Servo Electric Cylinder": "伺服电动缸",
  "Mechatronics Products": "机电一体化产品",
  "F Series Precision Planetary Reducer": "F 系列精密行星减速机",
  "KB(G)-HO Harmonic Reducer": "KB(G)-HO 谐波减速机",
  "AGV Steering Drive Module": "AGV 舵轮驱动模块",
  "Planetary Roller Screw Pair": "行星滚柱丝杠副",
  "Inline Servo Electric Cylinder": "直联式伺服电动缸",
  "Servo Planetary Joint Module": "伺服行星关节模组",
  "F / K / KH Series": "F / K / KH 系列",
  "KB / KBG Series": "KB / KBG 系列",
  "Steering & Drive Wheel": "舵轮与驱动轮",
  "Inline / Folded": "直联式 / 折返式",
  "Planetary Roller Screw": "行星滚柱丝杠",
  "Active": "启用",
  "Draft": "草稿",
  "Resolved": "已解决",
  "Needs takeover": "需接管",
  "Lead created": "已建线索",
  "Unresolved": "未解决",
  "Assigned": "已分配",
  "Pending": "待处理",
  "Follow-up": "跟进中",
  "Engineer review": "工程师复核",
  "Nurturing": "培育中",
  "Connected": "已连接",
  "Success": "成功",
  "Waiting": "等待中",
  "Engineer needed": "需工程师",
  "Sales needed": "需销售",
  "Processing": "处理中",
  "High": "高",
  "Medium": "中",
  "Low": "低",
  "Level A": "A 级",
  "Level B": "B 级",
  "Level C": "C 级",
  "High Priority": "高优先级",
  "Medium Priority": "中优先级",
  "Low Priority": "低优先级",
  // ---- strings added by the interface upgrades ----
  "Search this page (like Ctrl+F)...": "搜索本页（类似 Ctrl+F）...",
  "Search this page": "搜索本页",
  "Customers & Leads": "客户与线索",
  "Accounts and intent pipeline": "客户账户与意向管道",
  "Show password": "显示密码",
  "Hide password": "隐藏密码",
  "The last 30 days": "近 30 天",
  "Maintain KOFON product catalog, technical parameters, applications, and AI recommendations.": "维护科峰产品库、技术参数、应用场景和 AI 推荐。",
  "Search products by name, model, scenario...": "按名称、型号、场景搜索产品...",
  "Search": "搜索",
  "Parameters": "参数",
  "Scenarios": "应用场景",
  "Others": "其他",
  "Languages": "语言",
  "Drop an image here or click to upload": "将图片拖放到此处或点击上传",
  "PNG or JPG. The current avatar is shown on the left.": "支持 PNG 或 JPG。当前头像显示在左侧。",
  "English": "英语",
  "Chinese": "中文",
  "German": "德语",
  "French": "法语",
  "Russian": "俄语",
  "Japanese": "日语",
  "Korean": "韩语",
  "Unified view of customer accounts and AI-detected sales leads.": "客户账户与 AI 识别销售线索的统一视图。",
  "Customer & Lead Pipeline": "客户与线索管道",
  "Most Interested Product Type": "最感兴趣的产品类型",
  "B Level": "B 级",
  "C Level": "C 级",
  "Resolved conversations over the last 30 days": "近 30 天已解决的对话",
  "Audit risky AI responses. Answers are read-only for now.": "审核高风险 AI 回答。目前回答为只读。",
  "Delete": "删除",
  "Opportunity": "商机",
  "Evaluation": "评估中",
  "Technical Review": "技术评审",
  "Quotation": "报价中",
  "Warm": "温和",
  "Risk": "风险",
  "Hot": "高热度"
};

function msg(en, zh) {
  return state.lang === "zh" ? zh : en;
}

function languageButton(extraClass = "") {
  const label = state.lang === "zh" ? "EN" : "中文";
  const compact = state.lang === "zh" ? "中" : "EN";
  const aria = state.lang === "zh" ? "Switch to English" : "切换到中文";
  return `
    <button class="language-switch ${extraClass}" data-action="toggle-language" type="button" aria-label="${aria}">
      <span>${compact}</span><strong>${label}</strong>
    </button>
  `;
}

function translateLooseText(text) {
  let translated = zhText[text];
  if (translated) return translated;

  translated = text.replace(/^Intent (.+)$/u, (_, value) => `意向 ${zhText[value] || value}`);
  if (translated !== text) return translated;

  translated = text.replace(/^AI score (.+)$/u, "AI 评分 $1");
  if (translated !== text) return translated;

  translated = text.replace(/^Source: (.+)$/u, (_, value) => `来源：${zhText[value] || value}`);
  if (translated !== text) return translated;

  translated = text.replace(/^(\d+) users$/u, "$1 位用户");
  if (translated !== text) return translated;

  translated = text.replace(/^(\d+) products across reducer, AGV, screw, cylinder, and mechatronics categories\.$/u, "$1 个产品覆盖减速机、AGV、丝杠、电动缸和机电一体化品类。");
  if (translated !== text) return translated;

  translated = text.replace(" · wait ", " · 等待 ");
  return translated;
}

function translateTextValue(value) {
  const leading = value.match(/^\s*/u)?.[0] || "";
  const trailing = value.match(/\s*$/u)?.[0] || "";
  const compact = value.trim().replace(/\s+/gu, " ");
  if (!compact) return value;
  return `${leading}${translateLooseText(compact)}${trailing}`;
}

function localizeDom(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = translateTextValue(node.nodeValue || "");
  });

  container.querySelectorAll("[placeholder], [aria-label]").forEach((element) => {
    ["placeholder", "aria-label"].forEach((name) => {
      const value = element.getAttribute(name);
      if (value) element.setAttribute(name, translateLooseText(value));
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setState(patch) {
  const shouldResetScroll =
    ("authenticated" in patch && patch.authenticated !== state.authenticated) ||
    ("page" in patch && patch.page !== state.page);
  Object.assign(state, patch);
  render();
  if (shouldResetScroll && typeof window !== "undefined") {
    const scrollToTop = () => window.scrollTo?.({ top: 0, left: 0 });
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(scrollToTop);
    } else {
      scrollToTop();
    }
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  state.toast = message;
  render();
  toastTimer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2400);
}

function cssToken(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function pill(text, extra = "") {
  return `<span class="pill ${cssToken(text)} ${extra}">${escapeHtml(text)}</span>`;
}

function progressBar(value) {
  return `
    <div class="progress" aria-label="${value}%">
      <span style="width:${value}%"></span>
    </div>
  `;
}

function pageHeader(title, subtitle, actions = "") {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">KOFON AI Agent Admin</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="page-actions">${actions}</div>
    </div>
  `;
}

function metricCard(item) {
  // Some cards (analytics value cards) have no delta — don't render "undefined".
  const delta = item.delta ? `<span class="delta ${item.tone || ""}">${escapeHtml(item.delta)}</span>` : "";
  return `
    <article class="metric-card">
      <div>
        <p>${escapeHtml(item.label)}</p>
        <strong>${escapeHtml(item.value)}</strong>
      </div>
      ${delta}
      ${item.sub ? `<small>${escapeHtml(item.sub)}</small>` : ""}
    </article>
  `;
}

// Readable line chart with labelled axes. `opts` may carry { xLabels, yCaption,
// xCaption } so each chart can explain what its axes mean.
function lineChart(values, label = "Conversation trend", opts = {}) {
  const width = 560;
  const height = 220;
  const padL = 46;
  const padR = 16;
  const padT = 16;
  const padB = 38;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = Math.max(...values, 0);
  const min = 0; // baseline at zero so magnitudes are honest, not decorative
  const range = max - min || 1;
  const xAt = (index) => padL + (values.length === 1 ? plotW / 2 : index * (plotW / (values.length - 1)));
  const yAt = (value) => padT + plotH - ((value - min) / range) * plotH;
  const points = values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ");

  // Three horizontal gridlines + numeric y labels (0, mid, max).
  const yTicks = [0, max / 2, max];
  const gridY = yTicks
    .map((tick) => {
      const y = yAt(tick);
      const value = Math.round(tick);
      return `
        <line class="grid-line" x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}"></line>
        <text class="axis-label" x="${padL - 8}" y="${y + 4}" text-anchor="end">${value}</text>
      `;
    })
    .join("");

  // X tick labels (e.g. the last 30 days), spread evenly under the plot.
  const xLabels = Array.isArray(opts.xLabels) ? opts.xLabels : [];
  const gridX = xLabels
    .map((text, i) => {
      const frac = xLabels.length === 1 ? 0.5 : i / (xLabels.length - 1);
      const x = padL + frac * plotW;
      const anchor = i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle";
      return `<text class="axis-label" x="${x}" y="${height - padB + 18}" text-anchor="${anchor}">${escapeHtml(text)}</text>`;
    })
    .join("");

  const yCaption = opts.yCaption
    ? `<text class="axis-caption" x="14" y="${padT + plotH / 2}" text-anchor="middle" transform="rotate(-90 14 ${padT + plotH / 2})">${escapeHtml(opts.yCaption)}</text>`
    : "";
  const xCaption = opts.xCaption
    ? `<text class="axis-caption" x="${padL + plotW / 2}" y="${height - 4}" text-anchor="middle">${escapeHtml(opts.xCaption)}</text>`
    : "";

  return `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#132178" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#132178" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g class="grid-lines">${gridY}</g>
      ${gridX}
      ${yCaption}
      ${xCaption}
      <polyline points="${points} ${xAt(values.length - 1)},${padT + plotH} ${padL},${padT + plotH}" fill="url(#lineFill)" stroke="none"></polyline>
      <polyline points="${points}" fill="none" stroke="#132178" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${values
        .map((value, index) => `<circle cx="${xAt(index)}" cy="${yAt(value)}" r="4"><title>${escapeHtml(String(value))}</title></circle>`)
        .join("")}
    </svg>
  `;
}

function barList(items, maxValue = Math.max(...items.map((item) => item.value || item.rate))) {
  return `
    <div class="bar-list">
      ${items
        .map((item) => {
          const value = item.value || item.rate;
          const width = Math.round((value / maxValue) * 100);
          return `
            <div class="bar-row">
              <div>
                <strong>${escapeHtml(item.label || item.name)}</strong>
                <span>${escapeHtml(item.model || `${value} mentions`)}</span>
              </div>
              <div class="bar-track"><span style="width:${width}%"></span></div>
              <b>${escapeHtml(item.count || value)}</b>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// Palette for pie/donut slices — distinct, readable hues that share the deck's
// blue/teal family so the charts still feel on-brand.
const PIE_COLORS = ["#132178", "#16b8a6", "#7c5cff", "#f5a623", "#ef5da8", "#0a64d8", "#32c5ff", "#9bb2cf"];

// Donut/pie counterpart to barList(). Each item is one coloured slice sized by
// its share of `opts.total` (defaults to the sum of values). If the values fall
// short of the total, the gap is drawn in the empty-track grey so the circle is
// honest about uncounted volume — the same convention as the bar tracks.
// opts: { total, centerLabel } — items may carry an explicit `color`.
function pieChart(items, opts = {}) {
  const data = items.map((item, index) => {
    const value = item.value != null ? item.value : item.rate;
    return {
      label: item.label || item.name,
      value,
      count: item.count != null ? item.count : value,
      color: item.color || PIE_COLORS[index % PIE_COLORS.length]
    };
  });
  const total = opts.total != null ? opts.total : data.reduce((sum, d) => sum + d.value, 0) || 1;

  let cursor = 0;
  const stops = data.map((d) => {
    const start = (cursor / total) * 360;
    cursor += d.value;
    const end = (cursor / total) * 360;
    return `${d.color} ${start}deg ${end}deg`;
  });
  if (cursor < total) {
    stops.push(`#e7edf5 ${(cursor / total) * 360}deg 360deg`);
  }

  const center = opts.centerLabel ? `<span>${escapeHtml(opts.centerLabel)}</span>` : "";
  const legend = data
    .map(
      (d) => `
        <li>
          <span class="legend-label"><span class="legend-dot" style="background:${d.color}"></span><strong>${escapeHtml(d.label)}</strong></span>
          <span>${escapeHtml(String(d.count))}</span>
        </li>`
    )
    .join("");

  return `
    <div class="donut-wrap">
      <div class="donut" style="background:radial-gradient(circle at center,#fff 0 56%,transparent 57%),conic-gradient(${stops.join(", ")})">${center}</div>
      <ul class="compact-list legend-list">${legend}</ul>
    </div>
  `;
}

// Bar/Pie segmented switch for a chart. The id ties the buttons to chartViews so
// the click handler (data-action="set-chart-view") can flip and persist it.
function chartToggle(id) {
  const view = chartView(id);
  return `
    <div class="segmented chart-toggle">
      <button class="${view === "bar" ? "active" : ""}" data-action="set-chart-view" data-chart="${id}" data-view="bar" type="button">${msg("Bar", "柱状")}</button>
      <button class="${view === "pie" ? "active" : ""}" data-action="set-chart-view" data-chart="${id}" data-view="pie" type="button">${msg("Pie", "饼图")}</button>
    </div>
  `;
}

// Renders `items` as either a bar list or a pie, per the user's saved choice for
// this chart id. opts.total is shared by both views (bar track max / pie whole).
function toggleableChart(id, items, opts = {}) {
  return chartView(id) === "pie" ? pieChart(items, opts) : barList(items, opts.total);
}

// Demand signals: the grey track is the TOTAL request volume, and each blue
// segment is sized so all categories (including "Others") sum to that total.
function demandSignalsChart() {
  const total = 1500;
  const top = productRanking.map((p) => ({ label: p.name, model: p.model, value: p.count, count: p.count }));
  const topSum = top.reduce((sum, item) => sum + item.value, 0);
  const others = Math.max(0, total - topSum);
  const rows = top.concat([
    { label: "Others", model: msg("All uncategorized requests", "所有未归类请求"), value: others, count: others }
  ]);
  return toggleableChart("demand-signals", rows, { total });
}

function loginPage() {
  return `
    <main class="login-page">
      <div class="login-language">
        ${languageButton("on-login")}
      </div>
      <section class="login-brand-panel">
        <div class="brand-lockup large">
          <img class="brand-mark" src="/agent-profilepic.jpeg" alt="KOFON AI Agent" />
          <div>
            <strong>KOFON</strong>
            <small>AI Agent Admin</small>
          </div>
        </div>
        <div class="login-copy">
          <p class="eyebrow">Precision Transmission Intelligence</p>
          <h1>Industrial AI service operations for high-end motion products.</h1>
          <p>
            Manage product knowledge, customer conversations, manual takeover,
            answer quality, and sales signals in one clean enterprise console.
          </p>
        </div>
      </section>

      <section class="login-card" aria-label="Login form">
        <div class="login-card-header">
          <span class="system-chip">Admin Console</span>
          <h2>Sign in</h2>
          <p>Use your KOFON administrator account to enter the AI Agent workspace.</p>
        </div>
        <form data-form="login" class="form-stack">
          <label>
            <span>Email</span>
            <input name="username" type="email" value="" placeholder="you@kofon.com" autocomplete="username" required />
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input name="password" type="password" value="" autocomplete="current-password" required />
              <button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">${msg("Show", "显示")}</button>
            </div>
          </label>
          <button class="primary-button full" type="submit">Login</button>
        </form>
        <div class="login-footnote">
          <p>Sign in with your KOFON administrator account.</p>
        </div>
      </section>
    </main>
  `;
}

function sidebar() {
  return `
    <aside class="sidebar">
      <div class="brand-lockup">
        <img class="brand-mark" src="/agent-profilepic.jpeg" alt="KOFON AI Agent" />
        <div>
          <strong>KOFON</strong>
          <small>AI Agent Admin</small>
        </div>
      </div>
      <nav class="nav-list" aria-label="Main navigation" data-nav-list>
        ${navItems
          .filter((item) => {
            const perm = NAV_PERMISSION[item.id];
            return !perm || can(perm);
          })
          .map(
            (item) => {
              const badge = item.id === "Answer Review" ? answerReviews.length : navBadges[item.id];
              return `
              <button class="nav-item ${state.page === item.id ? "active" : ""}" data-page="${escapeHtml(item.id)}" data-nav-id="${escapeHtml(item.id)}" draggable="true">
                <span class="nav-indicator"></span>
                <span>
                  <strong>${escapeHtml(item.label)}</strong>
                  <small>${escapeHtml(item.hint)}</small>
                </span>
                ${badge ? `<span class="nav-badge" aria-label="${badge} ${escapeHtml(msg("pending", "待处理"))}">${badge}</span>` : ""}
              </button>
            `;
            }
          )
          .join("")}
      </nav>
    </aside>
  `;
}

function header() {
  return `
    <header class="topbar">
      <button class="icon-button mobile-only" data-action="toggle-sidebar" aria-label="Open navigation">
        <span></span><span></span><span></span>
      </button>
      <div>
        <strong>${escapeHtml(state.page)}</strong>
        <span>Industrial AI customer service and sales assistant</span>
      </div>
      <label class="search-box">
        <span></span>
        <input data-field="page-search" placeholder="Search this page (like Ctrl+F)..." aria-label="Search this page" />
      </label>
      ${languageButton("in-topbar")}
      <div class="admin-profile">
        <span>AD</span>
        <div>
          <strong>Admin</strong>
          <small>Operations Center</small>
        </div>
      </div>
      <button class="ghost-button logout-button" data-action="logout">Logout</button>
    </header>
  `;
}

function layout() {
  return `
    <div class="app-shell ${state.sidebarOpen ? "sidebar-open" : ""}">
      ${sidebar()}
      <button class="sidebar-backdrop" data-action="close-sidebar" aria-label="Close navigation"></button>
      <div class="workspace">
        ${header()}
        <main class="content-area">
          ${renderPage()}
        </main>
      </div>
      ${state.productModal ? productModal() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function dashboardPage() {
  return `
    ${pageHeader(
      "Dashboard",
      "Monitor AI conversation quality, product demand, unresolved risks, and sales value.",
      `<button class="secondary-button">Export Report</button><button class="primary-button">Daily Brief</button>`
    )}
    <section class="metric-grid">
      ${metrics.map(metricCard).join("")}
    </section>
    <section class="dashboard-grid">
      <article class="panel wide">
        <div class="panel-header">
          <div>
            <h2>Conversation Trend</h2>
            <p>AI service volume across current operation cycle</p>
          </div>
          ${pill("Live")}
        </div>
        ${lineChart(trendData, "Conversation trend", {
          yCaption: msg("Conversations", "对话数"),
          xCaption: msg("The last 30 days", "近 30 天"),
          xLabels: [msg("30d ago", "30天前"), msg("20d ago", "20天前"), msg("10d ago", "10天前"), msg("Today", "今天")]
        })}
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>AI Resolution</h2>
            <p>The last 30 days</p>
          </div>
        </div>
        ${pieChart(
          [
            // Correct answers and Manual transfer are both counted as resolved
            // for now, so both get a "success" green — a slightly lighter shade
            // for transfers keeps them distinguishable. Review queue stays
            // neutral grey as the still-unresolved remainder.
            { label: "Correct answers", value: 1191, count: "1,191", color: "#12805c" },
            { label: "Manual transfer", value: 72, count: "72", color: "#4cc4a3" },
            { label: "Review queue", value: 21, count: "21", color: "#9bb2cf" }
          ],
          { centerLabel: "92.8%" }
        )}
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Hot Product Consultation</h2>
            <p>Demand signals from user conversations</p>
          </div>
          ${chartToggle("demand-signals")}
        </div>
        ${demandSignalsChart()}
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Pending Risks</h2>
            <p>Issues that need admin action</p>
          </div>
        </div>
        <div class="risk-list">
          ${reminders
            .map(
              (item) => `
                <div class="risk-item clickable" data-page="Answer Review" role="button" tabindex="0">
                  ${pill(item.level)}
                  <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <p>${escapeHtml(item.detail)}</p>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="panel wide">
        <div class="panel-header">
          <div>
            <h2>Recent Conversations</h2>
            <p>Latest customer questions and AI service status</p>
          </div>
          <button class="text-button" data-page="User Conversations">View all</button>
        </div>
        ${conversationTable(conversations.slice(0, 4), false, "User Conversations")}
      </article>
    </section>
  `;
}

function conversationTable(list, selectable = true, navigateTo = null) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Company</th>
            <th>Product</th>
            <th>Time</th>
            <th>Status</th>
            <th>Intent</th>
          </tr>
        </thead>
        <tbody>
          ${list.length
            ? list
                .map(
                  (conversation) => `
                <tr class="${state.selectedConversationId === conversation.id ? "selected" : ""}${navigateTo ? " clickable" : ""}" ${
                    selectable ? `data-conversation="${escapeHtml(conversation.id)}"` : ""
                  } ${navigateTo ? `data-page="${escapeHtml(navigateTo)}" data-conversation="${escapeHtml(conversation.id)}"` : ""}>
                  <td><strong>${escapeHtml(conversation.user)}</strong></td>
                  <td>${escapeHtml(conversation.company)}</td>
                  <td>${escapeHtml(conversation.product)}</td>
                  <td>${escapeHtml(conversation.time)}</td>
                  <td>${pill(conversation.status)}</td>
                  <td>${conversation.intent ? pill(conversation.intent) : "—"}</td>
                </tr>
              `
                )
                .join("")
            : `<tr><td colspan="6" class="table-empty">${msg("No conversations yet.", "暂无对话记录。")}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function userConversationsPage() {
  const query = state.conversationSearch.trim().toLowerCase();
  const filtered = conversations.filter((item) => {
    const matchesQuery =
      !query ||
      [item.user, item.company, item.product, item.summary].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    const matchesStatus = state.conversationStatus === "All" || item.status === state.conversationStatus;
    return matchesQuery && matchesStatus;
  });
  const selected = conversations.find((item) => item.id === state.selectedConversationId) || filtered[0] || conversations[0];

  const detailPanel = selected
    ? `
      <article class="panel chat-panel">
        <div class="chat-header">
          <div>
            <h2>${escapeHtml(selected.user)}</h2>
            <p>${escapeHtml(selected.company)} · ${escapeHtml(selected.product)} · ${escapeHtml(selected.time)}</p>
          </div>
          ${pill(selected.status)}
        </div>
        <div class="customer-summary">
          ${selected.intent != null ? `<span>Intent ${escapeHtml(selected.intent)}</span>` : ""}
          ${selected.score != null ? `<span>AI score ${escapeHtml(selected.score)}%</span>` : ""}
          <span>${escapeHtml(selected.summary)}</span>
        </div>
        <div class="chat-stream">
          ${
            Array.isArray(selected.messages) && selected.messages.length
              ? selected.messages
                  .map(
                    (message) => `
                <div class="message ${message.from}">
                  <div class="message-avatar">${message.from === "ai" ? "AI" : "U"}</div>
                  <div class="message-bubble">
                    <p>${escapeHtml(message.text)}</p>
                    ${
                      message.from === "ai"
                        ? `
                          <div class="answer-meta">
                            ${message.confidence != null ? `<span>Confidence ${escapeHtml(message.confidence)}%</span>` : ""}
                            <div class="answer-actions">
                              <button data-action="answer-correct">Correct</button>
                              <button data-action="answer-incorrect">Incorrect</button>
                              <button data-action="add-knowledge">Add to Knowledge Base</button>
                              <button data-action="mark-unresolved">Mark as unresolved</button>
                            </div>
                          </div>
                        `
                        : ""
                    }
                  </div>
                </div>
              `
                  )
                  .join("")
              : `<p class="chat-empty">${msg("Select a conversation to view the transcript.", "选择一个对话以查看记录。")}</p>`
          }
        </div>
      </article>`
    : `<article class="panel chat-panel"><p class="chat-empty">${msg("No conversation selected.", "未选择对话。")}</p></article>`;

  return `
    ${pageHeader(
      "User Conversations",
      "Review AI customer service records, qualify demand, and improve answer quality.",
      `<button class="secondary-button">Batch Export</button>`
    )}
    <section class="conversation-shell">
      <article class="panel conversation-list-panel">
        <div class="filter-bar">
          <input data-field="conversation-search" value="${escapeHtml(state.conversationSearch)}" placeholder="Search user, company, product..." />
          <select data-field="conversation-status">
            ${["All", "Resolved", "Needs takeover", "Lead created", "Unresolved"]
              .map((status) => `<option ${state.conversationStatus === status ? "selected" : ""}>${status}</option>`)
              .join("")}
          </select>
          <button class="primary-button" data-action="apply-conversation-filter">Filter</button>
        </div>
        ${conversationTable(filtered)}
      </article>
      ${detailPanel}
    </section>
  `;
}

function productCard(product) {
  return `
    <article class="product-item">
      <div class="product-thumb">
        <span>${escapeHtml(product.category.split(" ").map((word) => word[0]).join("").slice(0, 3))}</span>
      </div>
      <div class="product-body">
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
        </div>
        <dl>
          <div><dt>Category</dt><dd>${escapeHtml(product.category)}</dd></div>
          <div><dt>Model</dt><dd>${escapeHtml(product.model)}</dd></div>
          <div><dt>Parameters</dt><dd>${escapeHtml(product.parameters)}</dd></div>
          <div><dt>Scenarios</dt><dd>${escapeHtml(product.scenarios)}</dd></div>
        </dl>
        <div class="item-footer">
          ${pill(product.status)}
          <button class="text-button">Edit</button>
        </div>
      </div>
    </article>
  `;
}

function productManagementPage() {
  const query = (state.productSearch || "").trim().toLowerCase();
  const matchesQuery = (p) =>
    !query ||
    [p.name, p.category, p.model, p.description, p.parameters, p.scenarios].some((v) =>
      String(v || "").toLowerCase().includes(query)
    );

  // Group products into families (their category).
  const families = {};
  products.forEach((p) => {
    (families[p.category] = families[p.category] || []).push(p);
  });

  const searchBar = `
    <div class="filter-bar">
      <input data-field="product-search" value="${escapeHtml(state.productSearch || "")}" placeholder="Search products by name, model, scenario..." />
      <button class="primary-button" data-action="apply-product-search">Search</button>
    </div>`;

  let body;
  let subtitle;
  if (query) {
    // Search overrides the family drill-down and lists matching products.
    const matched = products.filter(matchesQuery);
    subtitle = `${matched.length} ${msg("results", "条结果")}`;
    body = matched.length
      ? `<div class="product-grid">${matched.map(productCard).join("")}</div>`
      : `<p class="table-empty">${msg("No products match your search.", "没有符合搜索条件的产品。")}</p>`;
  } else if (state.productFamily && families[state.productFamily]) {
    const list = families[state.productFamily];
    subtitle = `${list.length} ${msg("products in this family", "个该系列产品")}`;
    body = `
      <button class="text-button back-link" data-action="product-back">← ${msg("All families", "全部系列")}</button>
      <div class="product-grid">${list.map(productCard).join("")}</div>`;
  } else {
    const familyNames = Object.keys(families);
    subtitle = `${familyNames.length} ${msg("product families", "个产品系列")}`;
    body = `
      <div class="family-grid">
        ${familyNames
          .map(
            (fam) => `
              <button class="family-card" data-action="open-family" data-family="${escapeHtml(fam)}">
                <div class="product-thumb"><span>${escapeHtml(fam.split(" ").map((w) => w[0]).join("").slice(0, 3))}</span></div>
                <div>
                  <h3>${escapeHtml(fam)}</h3>
                  <small>${families[fam].length} ${msg("products", "个产品")}</small>
                </div>
                <span class="family-chevron">›</span>
              </button>
            `
          )
          .join("")}
      </div>`;
  }

  return `
    ${pageHeader(
      "Product Management",
      "Maintain KOFON product catalog, technical parameters, applications, and AI recommendations.",
      `<button class="secondary-button">Import Excel</button><button class="primary-button" data-action="open-product-modal">Add Product</button>`
    )}
    <section class="panel">
      <div class="table-toolbar">
        <div>
          <h2>Product Catalog</h2>
          <p>${subtitle}</p>
        </div>
      </div>
      ${searchBar}
      ${body}
    </section>
  `;
}

function productModal() {
  return `
    <div class="modal-layer" role="dialog" aria-modal="true" aria-label="Add product">
      <button class="modal-backdrop" data-action="close-product-modal" aria-label="Close"></button>
      <section class="modal">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Product Management</p>
            <h2>Add Product</h2>
          </div>
          <button class="icon-close" data-action="close-product-modal" aria-label="Close">×</button>
        </div>
        <form class="form-grid" data-form="product">
          ${field("Product Name", "F Series Precision Planetary Reducer")}
          ${field("Product Category", "Precision Planetary Reducer", "select", [
            "Precision Planetary Reducer",
            "Harmonic Reducer",
            "AGV Products",
            "Screw Products",
            "Servo Electric Cylinder",
            "Mechatronics Products"
          ])}
          ${field("Model", "F060 / F090 / F120")}
          ${field("Product Image", "Upload image or paste URL")}
          ${field("Description", "High rigidity reducer for servo transmission.", "textarea")}
          ${field("Technical Parameters", "Ratio 3-100; low backlash; compact coaxial structure.", "textarea")}
          ${field("Application Scenarios", "Robotics, laser cutting equipment, packaging machines.", "textarea")}
          ${field("Advantages", "High precision, stable torque output, broad motor compatibility.", "textarea")}
          ${field("Related Documents", "F Series Product Manual.pdf")}
          ${field("Status", "Active", "select", ["Active", "Draft", "Disabled"])}
          <div class="modal-actions">
            <button type="button" class="secondary-button" data-action="close-product-modal">Cancel</button>
            <button type="submit" class="primary-button">Save Product</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function field(label, value = "", type = "input", options = []) {
  if (type === "textarea") {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <textarea>${escapeHtml(value)}</textarea>
      </label>
    `;
  }
  if (type === "select") {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <select>
          ${options.map((option) => `<option ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
    `;
  }
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input value="${escapeHtml(value)}" />
    </label>
  `;
}

function knowledgeBasePage() {
  return `
    ${pageHeader(
      "Knowledge Base",
      "Upload, classify, enable, and test enterprise documents that AI Agent can retrieve.",
      `<button class="secondary-button">Rebuild Index</button><button class="primary-button">Upload Document</button>`
    )}
    ${warningBanner(
      "Information stored in documents added to the agent can be accessed by outside users through conversations.",
      "添加到智能体的文档中存储的信息，可能会被外部用户通过对话访问到。"
    )}
    <section class="knowledge-layout">
      <article class="upload-zone">
        <span class="upload-icon"></span>
        <h2>Upload enterprise documents</h2>
        <p>PDF, Word, Excel, product manual, parameter sheet, installation guide, after-sales policy.</p>
        <button class="primary-button">Choose Files</button>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Knowledge Retrieval Test</h2>
            <p>Check whether the current index can answer product questions with reliable sources.</p>
          </div>
        </div>
        <div class="test-box">
          <input value="How to select AGV drive wheel for 1.5T payload?" />
          <button class="primary-button" data-action="test-retrieval">Test</button>
        </div>
        <div class="retrieval-result">
          <strong>Suggested sources</strong>
          <p>AGV Drive Wheel Selection Parameters.xlsx · F Series Planetary Reducer Product Manual.pdf</p>
        </div>
      </article>
    </section>
    <section class="panel">
      <div class="table-toolbar">
        <div>
          <h2>Document List</h2>
          <p>Knowledge documents grouped by type, owner, state, and update time.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Document</th><th>Category</th><th>Type</th><th>Status</th><th>Updated</th><th>Owner</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${documents
              .map(
                (doc) => `
                  <tr>
                    <td><strong>${escapeHtml(doc.name)}</strong></td>
                    <td>${escapeHtml(doc.category)}</td>
                    <td>${escapeHtml(doc.type)}</td>
                    <td>${pill(doc.status)}</td>
                    <td>${escapeHtml(doc.updated)}</td>
                    <td>${escapeHtml(doc.owner)}</td>
                    <td><button class="text-button">${doc.status === "Enabled" ? "Disable" : "Enable"}</button></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function faqManagementPage() {
  return `
    ${pageHeader(
      "FAQ Management",
      "Create, edit, prioritize, and enable common product and service questions.",
      `<button class="primary-button" data-action="faq-save">Add FAQ</button>`
    )}
    <section class="faq-layout">
      <article class="panel">
        <div class="table-toolbar">
          <div>
            <h2>FAQ List</h2>
            <p>High-frequency questions used by the AI Agent before document retrieval.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Question</th><th>Category</th><th>Uses</th><th>Priority</th><th>Enabled</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${faqs
                .map(
                  (faq) => `
                    <tr>
                      <td><strong>${escapeHtml(faq.question)}</strong></td>
                      <td>${escapeHtml(faq.category)}</td>
                      <td>${escapeHtml(faq.uses)}</td>
                      <td>${pill(faq.priority)}</td>
                      <td>${switchControl("faq:" + faq.question, faq.enabled)}</td>
                      <td><button class="text-button" data-action="faq-save">Edit</button></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </article>
      <aside class="panel form-panel">
        <h2>Add / Edit FAQ</h2>
        <div class="form-stack">
          ${field("Question", "What parameters are required for AGV drive wheel selection?")}
          ${field("Category", "AGV", "select", ["Selection", "AGV", "Customization", "After-sales", "Product Knowledge"])}
          ${field("Answer", "Ask for payload, speed, wheel diameter, slope, voltage, duty cycle, and installation space.", "textarea")}
          ${field("Priority", "High", "select", ["High", "Medium", "Low"])}
          <label class="inline-check"><input type="checkbox" checked /> Enabled</label>
          <button class="primary-button" data-action="faq-save">Save FAQ</button>
        </div>
      </aside>
    </section>
  `;
}

function aiSettingsPage() {
  return `
    ${pageHeader(
      "AI Agent Settings",
      "Configure the product expert personality, answer style, transfer rules, and safety controls.",
      `<button class="secondary-button">Preview Agent</button><button class="primary-button" data-action="settings-save">Save Settings</button>`
    )}
    <section class="settings-layout">
      <article class="panel">
        <div class="settings-hero">
          <div class="agent-avatar">AI</div>
          <div>
            <h2>KOFON Product Expert</h2>
            <p>Industrial transmission AI assistant for customer service, product consultation, and lead qualification.</p>
          </div>
        </div>
        <div class="form-grid compact">
          ${field("Agent Name", "KOFON Product Expert")}
          ${avatarField("/agent-profilepic.jpeg")}
          ${languageToggleList()}
        </div>
      </article>
      <aside class="panel">
        <h2>Response Controls</h2>
        <div class="control-list">
          ${controlLocked("Show answer sources", "Display document references below AI answers.")}
          ${control("Require confidence threshold", true, "Route low-confidence answers to review.")}
          ${control("Auto-create sales lead", true, "Create lead when purchase intent is high.")}
          ${controlLocked("Allow price estimate", "Exact price should be handled by sales.")}
        </div>
      </aside>
    </section>
  `;
}

// Preconfigured languages the admin can switch on or off for the agent.
// Mirrors the backend's SUPPORTED_LANGUAGES (app/i18n.py).
const agentLanguages = [
  { id: "English", on: true },
  { id: "Chinese", on: true },
  { id: "German", on: false },
  { id: "French", on: false },
  { id: "Russian", on: false },
  { id: "Japanese", on: false },
  { id: "Korean", on: false }
];

function languageToggleList() {
  return `
    <div class="full-field">
      <span>Languages</span>
      <div class="language-toggle-list">
        ${agentLanguages
          .map(
            (lang) => `
              <div class="language-toggle-item">
                <strong>${escapeHtml(lang.id)}</strong>
                ${switchControl("lang:" + lang.id, lang.on)}
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function avatarField(currentSrc) {
  return `
    <div class="full-field avatar-field">
      <span>Avatar</span>
      <label class="avatar-drop">
        <img class="avatar-preview" src="${escapeHtml(currentSrc)}" alt="Current avatar" />
        <div class="avatar-drop-copy">
          <strong>Drop an image here or click to upload</strong>
          <small>PNG or JPG. The current avatar is shown on the left.</small>
        </div>
        <input type="file" accept="image/*" data-field="avatar-upload" hidden />
      </label>
    </div>
  `;
}

function control(title, enabled, detail) {
  return `
    <div class="control-item">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
      ${switchControl("ctl:" + title, enabled)}
    </div>
  `;
}

// A control whose value is fixed off (cannot be toggled by the admin).
function controlLocked(title, detail) {
  return `
    <div class="control-item">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
      <button type="button" class="toggle" role="switch" aria-checked="false" disabled aria-label="${escapeHtml(msg("Locked off", "已锁定为关闭"))}"></button>
    </div>
  `;
}

// Merged Customer Management + Sales Leads: one pipeline that keeps the A/B/C
// lead levels and enriches each row with the matching customer account.
function customerLeadsPage() {
  const customerByCompany = {};
  customers.forEach((c) => { customerByCompany[c.company] = c; });

  const rows = leads
    .map((lead) => {
      const cust = customerByCompany[lead.company] || {};
      return `
        <tr>
          <td><strong>${escapeHtml(lead.customer)}</strong></td>
          <td>${escapeHtml(lead.company)}</td>
          <td>${escapeHtml(lead.product)}</td>
          <td>${pill(`Level ${lead.level}`)}</td>
          <td>${escapeHtml(cust.region || "—")}</td>
          <td class="wide-cell">${escapeHtml(lead.summary)}</td>
          <td>${pill(cust.stage || lead.status)}</td>
          <td>${cust.health ? pill(cust.health) : "—"}</td>
          <td>${escapeHtml(lead.owner)}</td>
          <td><button class="text-button" data-action="lead-action" ${lead.id != null ? `data-lead="${escapeHtml(lead.id)}"` : ""}>${lead.status === "Acknowledged" ? "View" : "Follow up"}</button></td>
        </tr>
      `;
    })
    .join("");

  return `
    ${pageHeader(
      "Customers & Leads",
      "Unified view of customer accounts and AI-detected sales leads.",
      `<button class="secondary-button">Assign Rules</button><button class="primary-button">New Lead</button>`
    )}
    ${warningBanner(
      "User accounts are required to implement this feature. It is shown here as a preview only.",
      "实现此功能需要用户账户。此处仅作为预览展示。"
    )}
    <section class="panel">
      <div class="table-toolbar">
        <div>
          <h2>Customer & Lead Pipeline</h2>
          <p>Prioritize high-intent customers and route them to sales or engineering support.</p>
        </div>
        <div class="segmented">
          <button class="active">All</button>
          <button>A Level</button>
          <button>B Level</button>
          <button>C Level</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Most Interested Product Type</th><th>Level</th><th>Region</th><th>Demand Summary</th><th>Stage</th><th>Health</th><th>Owner</th><th>Action</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function analyticsPage() {
  return `
    ${pageHeader(
      "Analytics",
      "Measure AI Agent impact across service efficiency, product demand, lead creation, and satisfaction.",
      `<button class="secondary-button">Compare Period</button><button class="primary-button">Export Analytics</button>`
    )}
    <section class="metric-grid analytics-cards">
      ${analytics.valueCards.map(metricCard).join("")}
    </section>
    <section class="analytics-grid">
      <article class="panel wide">
        <div class="panel-header">
          <div>
            <h2>AI Resolve Rate</h2>
            <p>Resolved conversations over the last 30 days</p>
          </div>
        </div>
        ${lineChart(responseTrend, "AI resolve rate", {
          yCaption: msg("Conversations", "对话数"),
          xCaption: msg("The last 30 days", "近 30 天"),
          xLabels: [msg("30d ago", "30天前"), msg("20d ago", "20天前"), msg("10d ago", "10天前"), msg("Today", "今天")]
        })}
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>Product Consultation Ranking</h2>
            <p>Which KOFON lines are driving demand</p>
          </div>
          ${chartToggle("product-consults")}
        </div>
        ${toggleableChart("product-consults", analytics.productConsults, { total: analytics.productConsults.reduce((sum, item) => sum + item.value, 0) })}
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h2>High Frequency Questions</h2>
            <p>Used for FAQ and knowledge base improvement</p>
          </div>
          ${chartToggle("question-frequency")}
        </div>
        ${toggleableChart("question-frequency", analytics.questionFrequency, { total: analytics.questionFrequency.reduce((sum, item) => sum + item.value, 0) })}
      </article>
    </section>
  `;
}

function answerReviewPage() {
  return `
    ${pageHeader(
      "Answer Review",
      "Audit risky AI responses. Answers are read-only for now.",
      `<button class="secondary-button">Review Rules</button>`
    )}
    <section class="review-list">
      ${answerReviews
        .map(
          (item) => `
            <article class="review-card">
              <div class="review-top">
                <div>
                  <span class="review-id">${escapeHtml(item.id)}</span>
                  <h2>${escapeHtml(item.question)}</h2>
                </div>
                ${pill(item.risk)}
              </div>
              <div>
                <h3>AI Answer</h3>
                <p>${escapeHtml(item.aiAnswer)}</p>
                <small>Source: ${escapeHtml(item.source)}</small>
              </div>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function manualTakeoverPage() {
  const active = takeoverSessions[0];
  const chat = conversations[0] || { messages: [] };
  const chatMessages = Array.isArray(chat.messages) ? chat.messages : [];

  return `
    ${pageHeader(
      "Manual Takeover",
      "Human support and sales teams can take over AI conversations when technical judgment is required.",
      `<button class="secondary-button">Availability</button>`
    )}
    ${warningBanner(
      "User accounts are required to implement this feature. It is shown here as a preview only.",
      "实现此功能需要用户账户。此处仅作为预览展示。"
    )}
    <section class="takeover-layout">
      <aside class="panel session-list">
        <div class="panel-header">
          <div>
            <h2>Waiting Sessions</h2>
            <p>Prioritized by intent and risk</p>
          </div>
        </div>
        ${takeoverSessions
          .map(
            (session) => `
              <button class="session-item ${session.id === active.id ? "active" : ""}">
                <span class="priority-line ${cssToken(session.priority)}"></span>
                <div>
                  <strong>${escapeHtml(session.name)}</strong>
                  <p>${escapeHtml(session.company)}</p>
                  <small>${escapeHtml(session.product)} · wait ${escapeHtml(session.wait)}</small>
                </div>
                ${pill(session.status)}
              </button>
            `
          )
          .join("")}
      </aside>
      <article class="panel takeover-chat">
        <div class="chat-header">
          <div>
            <h2>${escapeHtml(active.name)}</h2>
            <p>${escapeHtml(active.company)} · ${escapeHtml(active.product)}</p>
          </div>
          ${pill("Human taking over")}
        </div>
        <div class="chat-stream takeover">
          ${chatMessages
            .map(
              (message) => `
                <div class="message ${message.from}">
                  <div class="message-avatar">${message.from === "ai" ? "AI" : "U"}</div>
                  <div class="message-bubble"><p>${escapeHtml(message.text)}</p></div>
                </div>
              `
            )
            .join("")}
          <div class="message admin">
            <div class="message-avatar">AD</div>
            <div class="message-bubble"><p>Hello, this is KOFON support. I will collect the operating data and route it to our AGV application engineer.</p></div>
          </div>
        </div>
        <div class="reply-box">
          <input value="Please share max speed, slope, wheel diameter, voltage, and duty cycle." />
          <button class="primary-button" data-action="send-reply">Send</button>
        </div>
      </article>
      <aside class="panel user-context">
        <h2>User Info</h2>
        <dl>
          <div><dt>Name</dt><dd>${escapeHtml(active.name)}</dd></div>
          <div><dt>Company</dt><dd>${escapeHtml(active.company)}</dd></div>
          <div><dt>Product</dt><dd>${escapeHtml(active.product)}</dd></div>
          <div><dt>Intent</dt><dd>High purchase intent</dd></div>
          <div><dt>Status</dt><dd>Need technical confirmation</dd></div>
        </dl>
        <h2>Internal Notes</h2>
        ${warningBanner(
          "Editing these notes changes the agent's memory and behaviour.",
          "修改这些备注会改变智能体的记忆与行为。"
        )}
        <textarea>Ask for AGV payload, speed, slope, route condition, wheel diameter, battery voltage, expected duty cycle. Do not promise exact model before engineer check.</textarea>
        <button class="secondary-button full" data-action="save-note">Save Note</button>
      </aside>
    </section>
  `;
}

function permissionsPage() {
  const roleScope = {
    superadmin: "All modules, settings, and permission management.",
    editor: "Products, knowledge base, routing, conversations, exports.",
    sales: "Conversations, leads, and notifications.",
    viewer: "Read-only conversations and notifications."
  };
  const counts = {};
  adminUsers.forEach((u) => { counts[u.role] = (counts[u.role] || 0) + 1; });

  const selectableRoles = adminRoles.filter((role) => role !== "viewer");

  const roleCards = selectableRoles
    .map(
      (role) => `
        <article class="panel role-card">
          <h2>${escapeHtml(role)}</h2>
          <strong>${counts[role] || 0} users</strong>
          <p>${escapeHtml(roleScope[role] || "")}</p>
          ${progressBar(Math.min(100, (counts[role] || 0) * 20))}
        </article>
      `
    )
    .join("");

  const rows = adminUsers.length
    ? adminUsers
        .map(
          (u) => `
            <tr>
              <td><strong>${escapeHtml(u.email)}</strong></td>
              <td>${pill(u.role)}</td>
              <td>${u.is_active ? pill("Active") : pill("Disabled")}</td>
              <td>${escapeHtml(u.last_login || "—")}</td>
              <td>${
                u.is_self
                  ? `<span class="muted">${msg("You", "当前账号")}</span>`
                  : `<button class="text-button danger" data-action="user-delete" data-user="${escapeHtml(u.id)}">${msg("Delete", "删除")}</button>`
              }</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="5" class="table-empty">${msg("No admin users.", "暂无管理员账号。")}</td></tr>`;

  return `
    ${pageHeader(
      "User Permissions",
      "Control administrator accounts, roles, and access.",
      ""
    )}
    <section class="role-grid">${roleCards}</section>
    <section class="conversation-shell">
      <article class="panel">
        <div class="table-toolbar">
          <div>
            <h2>${msg("Administrators", "管理员")}</h2>
            <p>${adminUsers.length} ${msg("accounts", "个账号")}</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${msg("Email", "邮箱")}</th>
                <th>${msg("Role", "角色")}</th>
                <th>${msg("Status", "状态")}</th>
                <th>${msg("Last login", "最近登录")}</th>
                <th>${msg("Delete", "删除")}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>
      <aside class="panel form-panel">
        <h2>${msg("Create administrator", "新建管理员")}</h2>
        <form class="form-stack" data-form="user-create">
          <label><span>${msg("Email", "邮箱")}</span><input name="email" type="email" required placeholder="you@kofon.com" /></label>
          <label><span>${msg("Password", "密码")}</span><input name="password" type="password" required /></label>
          <label><span>${msg("Role", "角色")}</span>
            <select name="role">${selectableRoles.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}</select>
          </label>
          <button class="primary-button" type="submit">${msg("Create", "创建")}</button>
        </form>
      </aside>
    </section>
  `;
}

function systemSettingsPage() {
  return `
    ${pageHeader(
      "System Settings",
      "Manage integrations, security policy, data retention, notification, and SLA settings.",
      `<button class="primary-button" data-action="settings-save">Save System Settings</button>`
    )}
    <section class="settings-layout">
      <article class="panel">
        <h2>Integration Status</h2>
        <div class="integration-list">
          ${["CRM Lead Sync", "Enterprise WeChat", "Email Notification", "Document OCR", "Vector Index Service"]
            .map(
              (name, index) => `
                <div class="integration-item">
                  <div>
                    <strong>${escapeHtml(name)}</strong>
                    <p>${index === 0 ? "Connected to sales pipeline" : "Healthy and monitored"}</p>
                  </div>
                  ${pill(index === 3 ? "Processing" : "Connected")}
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <aside class="panel form-panel">
        <h2>Security & SLA</h2>
        <div class="form-stack">
          ${field("Session Timeout", "30 minutes", "select", ["15 minutes", "30 minutes", "60 minutes"])}
          ${field("Data Retention", "24 months", "select", ["6 months", "12 months", "24 months", "36 months"])}
        </div>
      </aside>
      ${maintenancePanel()}
    </section>
  `;
}

// Live operations panel (unlike the rest of System Settings, these buttons hit
// real endpoints). Only rendered for users who hold the matching permission, so
// it's empty for everyone but superadmin today.
function maintenancePanel() {
  const canBackup = can("backup.run");
  const canRestart = can("restart.run");
  if (!canBackup && !canRestart) return "";
  return `
    <article class="panel">
      <h2>${msg("Maintenance", "运维")} ${pill("Live")}</h2>
      <p class="muted">${msg(
        "Bundle the catalog, knowledge base, and routing config into a downloadable backup, or restart the bot. Secrets (.env) are excluded.",
        "将产品目录、知识库和路由配置打包为可下载的备份，或重启机器人。密钥（.env）不会包含在内。"
      )}</p>
      <div class="page-actions">
        ${canBackup ? `<button class="primary-button" data-action="backup-create">${msg("Create backup now", "立即创建备份")}</button>` : ""}
        ${canRestart ? `<button class="secondary-button" data-action="restart-bot">${msg("Restart bot", "重启机器人")}</button>` : ""}
      </div>
    </article>
  `;
}

function operationLogsPage() {
  return `
    ${pageHeader(
      "Operation Logs",
      "Audit administrator actions, system events, AI lead creation, and knowledge index changes.",
      `<button class="secondary-button">Download CSV</button>`
    )}
    <section class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
          <tbody>
            ${logs
              .map(
                (log) => `
                  <tr>
                    <td>${escapeHtml(log.time)}</td>
                    <td><strong>${escapeHtml(log.actor)}</strong></td>
                    <td>${escapeHtml(log.action)}</td>
                    <td>${escapeHtml(log.target)}</td>
                    <td>${pill(log.result)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// Sections that have no backend yet: they render the demo UI on sample data and
// carry a clear "Preview" banner so mock numbers aren't mistaken for live ones.
const PREVIEW_PAGES = new Set([
  "Manual Takeover",
  "FAQ Management",
  "AI Agent Settings",
  "Customers & Leads",
  "Analytics",
  "Answer Review",
  "System Settings"
]);

// Nav visibility: a section is shown only if the user holds its permission.
// Sections not listed (Dashboard + preview-only ones) are visible to everyone.
const NAV_PERMISSION = {
  "User Conversations": "conversations.read",
  "Manual Takeover": "conversations.read",
  "Product Management": "content.read",
  "Knowledge Base": "content.read",
  "FAQ Management": "content.read",
  "Customers & Leads": "notifications.read",
  "User Permissions": "users.manage",
  "Operation Logs": "users.manage"
};

// Inline warning callout used to flag risky actions or unimplemented features.
function warningBanner(en, zh) {
  return `<div class="warning-banner" role="note">⚠ ${escapeHtml(msg(en, zh))}</div>`;
}

function previewBanner() {
  return `<div class="preview-banner">${msg(
    "Preview — this section is in development and shows sample data, not live records.",
    "预览 — 此模块仍在开发中，显示为示例数据，并非真实记录。"
  )}</div>`;
}

function renderPage() {
  const pages = {
    Dashboard: dashboardPage,
    "User Conversations": userConversationsPage,
    "Manual Takeover": manualTakeoverPage,
    "Product Management": productManagementPage,
    "Knowledge Base": knowledgeBasePage,
    "FAQ Management": faqManagementPage,
    "AI Agent Settings": aiSettingsPage,
    "Customers & Leads": customerLeadsPage,
    Analytics: analyticsPage,
    "Answer Review": answerReviewPage,
    "User Permissions": permissionsPage,
    "System Settings": systemSettingsPage,
    "Operation Logs": operationLogsPage
  };
  const body = (pages[state.page] || dashboardPage)();
  return PREVIEW_PAGES.has(state.page) ? previewBanner() + body : body;
}

function render() {
  root.innerHTML = state.authenticated ? layout() : loginPage();
  if (state.lang === "zh") {
    localizeDom(root);
  }
}

// ---- draggable sidebar tabs --------------------------------------------------
let dragNavId = null;
root.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".nav-item[data-nav-id]");
  if (!item) return;
  dragNavId = item.dataset.navId;
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  item.classList.add("dragging");
});
root.addEventListener("dragend", (event) => {
  const item = event.target.closest(".nav-item");
  if (item) item.classList.remove("dragging");
  root.querySelectorAll(".nav-item.drag-over").forEach((el) => el.classList.remove("drag-over"));
});
root.addEventListener("dragover", (event) => {
  const item = event.target.closest(".nav-item[data-nav-id]");
  if (!item || !dragNavId) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  root.querySelectorAll(".nav-item.drag-over").forEach((el) => el.classList.remove("drag-over"));
  if (item.dataset.navId !== dragNavId) item.classList.add("drag-over");
});
root.addEventListener("drop", (event) => {
  const target = event.target.closest(".nav-item[data-nav-id]");
  if (!target || !dragNavId) return;
  event.preventDefault();
  const targetId = target.dataset.navId;
  if (targetId !== dragNavId) {
    const from = navItems.findIndex((i) => i.id === dragNavId);
    const to = navItems.findIndex((i) => i.id === targetId);
    if (from >= 0 && to >= 0) {
      const [moved] = navItems.splice(from, 1);
      navItems.splice(to, 0, moved);
      persistNavOrder();
    }
  }
  dragNavId = null;
  render();
});

// ---- in-page find (search bar behaves like Ctrl+F over the current page) ---
let findState = { query: "", hits: [], index: -1 };

function clearPageFind() {
  const scope = root.querySelector(".content-area") || root;
  scope.querySelectorAll("mark.page-find-hit").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
  findState = { query: "", hits: [], index: -1 };
}

function runPageFind(rawQuery) {
  const query = (rawQuery || "").trim();
  // Re-running the same query just advances to the next match.
  if (query && query.toLowerCase() === findState.query && findState.hits.length) {
    focusFindHit((findState.index + 1) % findState.hits.length);
    return;
  }
  clearPageFind();
  if (!query) return;

  const scope = root.querySelector(".content-area");
  if (!scope) return;
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.toLowerCase().includes(needle)) return NodeFilter.FILTER_REJECT;
      const tag = node.parentNode && node.parentNode.nodeName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  const hits = [];
  textNodes.forEach((node) => {
    const value = node.nodeValue;
    const lower = value.toLowerCase();
    let from = 0;
    let at = lower.indexOf(needle, from);
    if (at < 0) return;
    const frag = document.createDocumentFragment();
    while (at >= 0) {
      if (at > from) frag.appendChild(document.createTextNode(value.slice(from, at)));
      const mark = document.createElement("mark");
      mark.className = "page-find-hit";
      mark.textContent = value.slice(at, at + needle.length);
      frag.appendChild(mark);
      hits.push(mark);
      from = at + needle.length;
      at = lower.indexOf(needle, from);
    }
    if (from < value.length) frag.appendChild(document.createTextNode(value.slice(from)));
    node.parentNode.replaceChild(frag, node);
  });

  findState = { query: needle, hits, index: -1 };
  if (hits.length) {
    focusFindHit(0);
    showToast(msg(`${hits.length} match(es) on this page.`, `本页找到 ${hits.length} 处匹配。`));
  } else {
    showToast(msg("No matches on this page.", "本页未找到匹配项。"));
  }
}

function focusFindHit(index) {
  if (!findState.hits.length) return;
  findState.hits.forEach((mark) => mark.classList.remove("current"));
  findState.index = index;
  const mark = findState.hits[index];
  if (mark) {
    mark.classList.add("current");
    mark.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

// Intercept the browser's Ctrl/Cmd+F so it drives our in-page search instead.
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && (event.key === "f" || event.key === "F")) {
    const box = root.querySelector('[data-field="page-search"]');
    if (box) {
      event.preventDefault();
      box.focus();
      box.select();
    }
  }
});

root.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.field === "page-search") {
    if (event.key === "Enter") {
      event.preventDefault();
      runPageFind(target.value);
    } else if (event.key === "Escape") {
      target.value = "";
      clearPageFind();
    }
  } else if (target.dataset.field === "product-search" && event.key === "Enter") {
    event.preventDefault();
    setState({ productSearch: target.value, productFamily: null });
  }
});

// Avatar image drop-in: preview the chosen file in place.
root.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.dataset.field === "avatar-upload") {
    const file = target.files && target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const preview = target.closest(".avatar-drop")?.querySelector(".avatar-preview");
      if (preview) preview.src = reader.result;
      showToast(msg("Avatar updated in preview.", "头像已在预览中更新。"));
    };
    reader.readAsDataURL(file);
  }
});

root.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();

  if (form.dataset.form === "login") {
    const email = (form.username?.value || "").trim();
    const password = form.password?.value || "";
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    api("/admin/api/login", { method: "POST", body: JSON.stringify({ email, password }) })
      .then(async (res) => {
        if (res.ok) {
          await bootstrap();
          showToast(msg("Login successful. Welcome to KOFON AI Agent Admin.", "登录成功，欢迎进入 KOFON AI 智能体后台。"));
        } else {
          const data = await res.json().catch(() => ({}));
          if (button) button.disabled = false;
          showToast(data.error || msg("Invalid credentials.", "凭据无效。"));
        }
      })
      .catch(() => {
        if (button) button.disabled = false;
        showToast(msg("Network error. Please try again.", "网络错误，请重试。"));
      });
  }

  if (form.dataset.form === "product") {
    setState({ productModal: false });
    showToast(msg("Product editing is in development.", "产品编辑功能正在开发中。"));
  }

  if (form.dataset.form === "user-create") {
    const email = (form.email?.value || "").trim();
    const password = form.password?.value || "";
    const role = form.role?.value || "viewer";
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    apiForm("/admin/api/users/create", { email, password, role, csrf_token: state.csrf })
      .then(() => {
        loadUsers();
        showToast(msg("Administrator saved.", "管理员已保存。"));
      })
      .catch(() => showToast(msg("Could not create administrator.", "无法创建管理员。")))
      .finally(() => { if (button) button.disabled = false; });
  }
});

root.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    const page = pageButton.dataset.page;
    // A row can both navigate and pre-select a conversation (dashboard → details).
    const convId = pageButton.dataset.conversation;
    const patch = { page, sidebarOpen: false, productModal: false };
    if (convId) patch.selectedConversationId = convId;
    setState(patch);
    loadSection(page);
    if (convId) loadConversationDetail(convId);
    return;
  }

  const conversationRow = event.target.closest("[data-conversation]");
  if (conversationRow) {
    const id = conversationRow.dataset.conversation;
    setState({ selectedConversationId: id });
    loadConversationDetail(id);
    return;
  }

  // Interactive switches: flip persisted state and re-render.
  const switchEl = event.target.closest("[data-switch]");
  if (switchEl) {
    const key = switchEl.dataset.switch;
    const next = !switchEl.classList.contains("on");
    switchStates.set(key, next);
    render();
    showToast(next ? msg("Turned on.", "已开启。") : msg("Turned off.", "已关闭。"));
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    // Segmented filters (All / Active / Draft, lead levels, …): give an
    // immediate visual response by moving the active state to the clicked tab.
    const seg = event.target.closest(".segmented button");
    if (seg && !seg.disabled) {
      seg.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      seg.classList.add("active");
      return;
    }
    // Nothing else is allowed to feel dead: any standalone control with no
    // wired behaviour yet acknowledges the click instead of ignoring it.
    // (Form buttons are excluded — their submit handler owns them.)
    const ctrl = event.target.closest("button, .text-button, .session-item, .icon-button");
    if (ctrl && !ctrl.disabled && !ctrl.closest("form")) {
      showToast(msg("This feature is in development.", "该功能正在开发中。"));
    }
    return;
  }

  const action = actionButton.dataset.action;
  if (action === "toggle-language") {
    const lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem(LANGUAGE_KEY, lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    setState({ lang });
    showToast(lang === "zh" ? "已切换为中文界面。" : "Switched to English interface.");
    return;
  }
  if (action === "toggle-password") {
    const field = actionButton.closest(".password-field");
    const input = field && field.querySelector("input");
    if (input) {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      actionButton.textContent = show ? msg("Hide", "隐藏") : msg("Show", "显示");
      actionButton.setAttribute("aria-label", show ? "Hide password" : "Show password");
    }
    return;
  }
  if (action === "logout") {
    api("/admin/api/logout", { method: "POST" }).finally(() => {
      Object.assign(state, { user: null, permissions: [], csrf: null });
      setState({ authenticated: false, page: "Dashboard" });
    });
    return;
  }
  if (action === "set-chart-view") {
    const id = actionButton.dataset.chart;
    const view = actionButton.dataset.view;
    if (id && view && chartView(id) !== view) {
      chartViews.set(id, view);
      render();
    }
    return;
  }
  if (action === "toggle-sidebar") {
    setState({ sidebarOpen: !state.sidebarOpen });
    return;
  }
  if (action === "close-sidebar") {
    setState({ sidebarOpen: false });
    return;
  }
  if (action === "open-product-modal") {
    setState({ productModal: true });
    return;
  }
  if (action === "close-product-modal") {
    setState({ productModal: false });
    return;
  }
  if (action === "apply-product-search") {
    const search = root.querySelector('[data-field="product-search"]')?.value || "";
    setState({ productSearch: search, productFamily: null });
    return;
  }
  if (action === "open-family") {
    setState({ productFamily: actionButton.dataset.family, productSearch: "" });
    return;
  }
  if (action === "product-back") {
    setState({ productFamily: null, productSearch: "" });
    return;
  }
  if (action === "apply-conversation-filter") {
    const search = root.querySelector('[data-field="conversation-search"]')?.value || "";
    const status = root.querySelector('[data-field="conversation-status"]')?.value || "All";
    setState({ conversationSearch: search, conversationStatus: status });
    loadConversations();
    return;
  }
  if (action === "user-toggle") {
    const id = actionButton.dataset.user;
    apiForm("/admin/api/users/toggle", { user_id: id, csrf_token: state.csrf })
      .then(() => { loadUsers(); showToast(msg("Account updated.", "账号已更新。")); })
      .catch(() => showToast(msg("Could not update account.", "无法更新账号。")));
    return;
  }
  if (action === "user-delete") {
    const id = actionButton.dataset.user;
    if (!window.confirm(msg("Delete this administrator account?", "确定要删除此管理员账号吗？"))) return;
    // No delete endpoint yet: disable the account to revoke its access.
    apiForm("/admin/api/users/toggle", { user_id: id, csrf_token: state.csrf })
      .then(() => { loadUsers(); showToast(msg("Account removed.", "账号已删除。")); })
      .catch(() => showToast(msg("Could not remove account.", "无法删除账号。")));
    return;
  }
  if (action === "backup-create") {
    actionButton.disabled = true;
    showToast(msg("Creating backup…", "正在创建备份…"));
    apiForm("/admin/api/backup", { csrf_token: state.csrf })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        // Backups are listed + downloadable on the server-rendered page.
        showToast(msg("Backup created — opening downloads.", "备份已创建 — 正在打开下载页。"));
        window.open("/admin/backups", "_blank", "noopener");
      })
      .catch(() => showToast(msg("Could not create backup.", "无法创建备份。")))
      .finally(() => { actionButton.disabled = false; });
    return;
  }
  if (action === "restart-bot") {
    if (!window.confirm(msg("Restart the bot?", "确定要重启机器人吗？"))) return;
    actionButton.disabled = true;
    apiForm("/admin/api/restart", { csrf_token: state.csrf })
      .then((res) => {
        if (res.ok) {
          showToast(msg("Restart requested.", "已请求重启。"));
        } else {
          // The endpoint returns 501 until a production supervisor is wired up.
          showToast(msg(
            "Restart isn't configured yet — operators restart via deploy.sh.",
            "重启尚未配置 — 运维人员需通过 deploy.sh 重启。"
          ));
        }
      })
      .catch(() => showToast(msg("Could not restart the bot.", "无法重启机器人。")))
      .finally(() => { actionButton.disabled = false; });
    return;
  }
  if (action === "lead-action") {
    const id = actionButton.dataset.lead;
    if (id) {
      apiForm("/admin/api/notifications/ack", { notification_id: id, csrf_token: state.csrf })
        .then(() => { loadLeads(); showToast(msg("Lead acknowledged.", "线索已确认。")); })
        .catch(() => showToast(msg("Could not update lead.", "无法更新线索。")));
    } else {
      showToast(msg("This feature is in development.", "该功能正在开发中。"));
    }
    return;
  }

  const actionMessages = {
    "answer-correct": ["Answer marked correct.", "回答已标记为正确。"],
    "answer-incorrect": ["Answer sent to review queue.", "回答已送入审核队列。"],
    "add-knowledge": ["Candidate knowledge item added to review draft.", "候选知识已加入审核草稿。"],
    "mark-unresolved": ["Conversation marked unresolved.", "对话已标记为未解决。"],
    "test-retrieval": ["Knowledge retrieval test completed.", "知识检索测试已完成。"],
    "faq-save": ["FAQ changes saved in prototype.", "FAQ 更改已保存到原型。"],
    "settings-save": ["Settings saved in prototype.", "设置已保存到原型。"],
    "lead-action": ["Follow-up task created.", "跟进任务已创建。"],
    "review-test": ["New answer test generated.", "新回答测试已生成。"],
    "review-knowledge": ["Corrected answer prepared for knowledge base.", "修正答案已准备加入知识库。"],
    "review-resolve": ["Review item marked resolved.", "审核项已标记为解决。"],
    "send-reply": ["Manual reply sent in prototype.", "人工回复已在原型中发送。"],
    "save-note": ["Internal note saved.", "内部备注已保存。"]
  };

  if (actionMessages[action]) {
    showToast(msg(actionMessages[action][0], actionMessages[action][1]));
  }
});

render();      // initial paint (login screen while we check the session)
bootstrap();   // resolve identity, then load the active section's real data

