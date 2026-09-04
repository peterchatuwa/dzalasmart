import { APP_NAME } from "./brand.js";

export const SOIL_TYPES = ["Sandy", "Sandy loam", "Loamy", "Clay loam", "Clay"];
export const NUTRIENT_STATUSES = [
  "Low nitrogen", "Low phosphorus", "Low potassium", "Balanced / fertile", "Acidic soil",
];

export const CROP_INFO = {
  Maize: {
    soils: ["Loamy", "Clay loam", "Sandy loam"],
    nutrients: ["Balanced / fertile", "Low potassium"],
    reason: "Malawi's staple crop; does best in fertile, well-drained loam with balanced nutrients.",
  },
  Groundnuts: {
    soils: ["Sandy", "Sandy loam", "Loamy"],
    nutrients: ["Low nitrogen", "Low phosphorus"],
    reason: "A legume that fixes its own nitrogen, so it copes well on lower-fertility, sandy soils.",
  },
  Soybeans: {
    soils: ["Loamy", "Clay loam"],
    nutrients: ["Low nitrogen", "Balanced / fertile"],
    reason: "Improves soil nitrogen for the next crop; prefers well-drained, reasonably fertile loam.",
  },
  Cassava: {
    soils: ["Sandy", "Sandy loam"],
    nutrients: ["Low nitrogen", "Low phosphorus", "Acidic soil"],
    reason: "Very tolerant of poor, sandy or acidic soils and short dry spells — a reliable fallback crop.",
  },
  "Sweet potatoes": {
    soils: ["Sandy", "Sandy loam"],
    nutrients: ["Low potassium", "Low nitrogen"],
    reason: "Grows well in sandy soils with modest fertility; good for household food security.",
  },
  Sorghum: {
    soils: ["Sandy", "Clay"],
    nutrients: ["Acidic soil", "Low phosphorus"],
    reason: "Handles low-fertility, drought-prone conditions better than maize.",
  },
  "Pigeon peas": {
    soils: ["Sandy loam", "Loamy", "Clay loam"],
    nutrients: ["Low nitrogen", "Acidic soil"],
    reason: "Deep roots and nitrogen-fixing; tolerant of poor and acidic soils.",
  },
  Rice: {
    soils: ["Clay", "Clay loam"],
    nutrients: ["Balanced / fertile", "Low potassium"],
    reason: "Suited to heavier, water-retentive clay soils in low-lying or wetland areas.",
  },
  Tobacco: {
    soils: ["Loamy", "Sandy loam"],
    nutrients: ["Balanced / fertile"],
    reason: "Needs well-drained, fertile loam and careful nutrient management.",
  },
};

export const DISEASE_DB = [
  {
    name: "Fall Armyworm (on maize)",
    keywords: ["ragged leaf", "ragged leaves", "window pane", "windowing", "frass", "droppings in whorl", "caterpillar", "leaf holes", "holes in the leaves", "holes in leaves", "worms on leaves", "mphutsi"],
    chemical: "Emamectin benzoate or Lambda-cyhalothrin sprayed into the whorl, following the product label rate.",
    cultural: "Plant early, hand-pick and destroy egg clusters and young caterpillars, and avoid unnecessary spraying so natural predators can help.",
  },
  {
    name: "Maize Streak Virus",
    keywords: ["streak", "yellow streak", "stunt", "stunted maize", "yellow spots", "mawanga achikasu", "vibiriwiri"],
    chemical: "No direct chemical cure — control the leafhopper insect that spreads it with a recommended insecticide.",
    cultural: "Use tolerant/resistant maize varieties, plant early with the first rains, and remove and destroy infected plants.",
  },
  {
    name: "Groundnut Rosette Virus",
    keywords: ["rosette", "yellowing groundnut", "mottle", "stunted groundnut"],
    chemical: "Control the aphid that spreads it with a systemic insecticide such as Imidacloprid, applied early in the season.",
    cultural: "Plant early and densely, use rosette-resistant varieties, and remove volunteer groundnut plants between seasons.",
  },
  {
    name: "Bean Rust",
    keywords: ["orange spot", "rust", "pustule", "brown spot bean", "bean leaf"],
    chemical: "A protectant fungicide such as Mancozeb or Chlorothalonil, applied at the first sign of spotting.",
    cultural: "Rotate away from beans for a season, avoid overhead watering late in the day, and use resistant varieties where available.",
  },
  {
    name: "Cassava Mosaic Disease",
    keywords: ["mosaic", "cassava leaf", "distorted cassava"],
    chemical: "No chemical cure — the disease is managed by controlling the whitefly that spreads it.",
    cultural: "Always plant cuttings from disease-free cassava, remove and burn infected plants promptly, and choose mosaic-tolerant varieties.",
  },
  {
    name: "Maize Stalk Borer",
    keywords: ["stem hole", "tunnel", "tunnels", "dead heart", "stalk hole", "holes in the stem", "holes in stem", "borer", "wilt", "wilting", "wilting stalks", "kufota"],
    chemical: "An insecticide dust such as Carbaryl, or Chlorpyrifos, applied into the whorl.",
    cultural: "Destroy old maize stalks and crop residue right after harvest, and plant early to avoid peak borer activity.",
  },
  {
    name: "Aphids (general)",
    keywords: ["sticky leaf", "curl", "tiny insect", "cluster of insect", "aphid"],
    chemical: "A neem-based biopesticide, or Imidacloprid for heavier infestations.",
    cultural: "Encourage ladybird beetles and other natural predators, and avoid over-applying nitrogen fertiliser, which attracts aphids.",
  },
];

export const GENERAL_AG_KB = [
  { topic: "Fertiliser & soil nutrients", keywords: ["fertiliser", "fertilizer", "manure", "compost", "soil nutrient", "top dress", "topdress", "nutrient", "nitrogen", "feteleza"],
    answer: "Match fertiliser to a soil test where possible. As a rule of thumb: apply basal fertiliser (like D-Compound or NPK) at planting, then top-dress with Urea or CAN 3–5 weeks later once the crop is established. Manure and compost improve soil structure over several seasons — apply well before planting so it has time to break down." },
  { topic: "Irrigation & water", keywords: ["irrigate", "irrigation", "watering", "drip", "water my", "moisture stress"],
    answer: "If you're rainfed, plant right after the first reliable rains and consider small water-harvesting basins near the field. If you have irrigation access, drip systems use far less water than flood irrigation and reduce disease risk from wet leaves." },
  { topic: "Land preparation", keywords: ["plough", "ploughing", "land prep", "clear the land", "ridging", "bed preparation"],
    answer: "Prepare land 2–4 weeks before the rains where possible — ploughing too close to planting can leave soil loose and prone to erosion in early storms. Ridging helps drainage on heavier soils; flat planting suits lighter, sandy soils." },
  { topic: "Storage & post-harvest loss", keywords: ["storage", "store my", "post-harvest", "losing grain", "weevil", "grain store"],
    answer: "Dry grain to the recommended moisture level before storing (around 13% for maize), use hermetic (airtight) bags where possible to control weevils without chemicals, and keep stores off the ground and away from damp walls." },
  { topic: "Selling & market timing", keywords: ["sell my", "best price", "when to sell", "market price", "which buyer", "where to sell"],
    answer: "Prices are usually lowest right after harvest when everyone sells at once, and often rise a few months later if you can store safely. Compare at least two buyers before committing, and check this dashboard's market prices first." },
  { topic: "Loans & financing", keywords: ["loan", "finance", "financing", "borrow money", "credit", "bankable", "ngongole"],
    answer: `Lenders generally want to see a consistent record — planting dates, input costs, yields and sales — before extending credit. Building up your season log on ${APP_NAME} is exactly the kind of evidence they look for.` },
  { topic: "Livestock feeding", keywords: ["feed my cattle", "feed my goat", "feed my chicken", "feed my animal", "livestock feed", "fodder", "feeding my"],
    answer: "Balance energy (maize bran, crop residues) with protein (legume residues, oilcake) and always provide clean water. Introduce any new feed gradually over 5–7 days to avoid digestive upset." },
  { topic: "Livestock disease & vaccination", keywords: ["vaccinate", "vaccination", "sick cattle", "sick goat", "sick chicken", "animal disease", "deworm"],
    answer: "Keep a basic vaccination and deworming calendar for your herd or flock, isolate any sick animal immediately, and contact a local veterinary or livestock extension officer for anything beyond routine care — don't guess with medicine dosages." },
  { topic: "Weather & climate risk", keywords: ["drought", "dry spell", "too much rain", "flooding", "climate risk"],
    answer: "During a dry spell, prioritise your most valuable or most advanced crop for any water you have, and delay new planting until rain is more reliable. In excess rain, prioritise drainage — waterlogged roots fail faster than dry ones." },
  { topic: "Cooperatives & registration", keywords: ["join a cooperative", "register with", "farmers union", "how do i join"],
    answer: "You can register with a cooperative or the Farmers Union from this system — an officer can then see your farm record and help connect you to bulk input buying and group marketing." },
];

export const COPY = {
  en: {
    greeting: `Hello! I'm the ${APP_NAME} farming assistant. Ask me what to grow for your soil, or describe a pest or disease problem below.`,
    disclaimer: "This assistant gives simplified, illustrative advice for this demo. Always confirm chemical products and rates with your local extension officer before use.",
    cropLeadIn: (soil, nutrient) => `Based on ${soil.toLowerCase()} soil with ${nutrient.toLowerCase()}, these tend to do well:`,
    noMatch: "I couldn't match specific symptoms. Try describing the colour, which part of the plant is affected (leaf, stem, pod), and the pattern (spots, holes, wilting).",
    matchedIntro: (name) => `This sounds like it could be ${name}.`,
    chemicalLbl: "Chemical control:",
    culturalLbl: "Non-chemical / cultural control:",
    fallback: "I don't have a specific answer on file for that yet, but I can help with crop choice, pests and disease, fertiliser and soil, irrigation, livestock, storage, loans, or market timing — try rephrasing, or ask your local extension officer.",
  },
  ny: {
    greeting: `Moni! Ndine wothandizira waulimi wa ${APP_NAME}. Funsani za mbewu zoyenera nthaka yanu, kapena fotokozani za tizilombo kapena matenda a mbewu pansipa.`,
    disclaimer: "Wothandizirayu akupereka malangizo osavuta a chitsanzo. Onetsetsani ndi wa Ulimi musanagwiritse ntchito mankhwala aliwonse.",
    cropLeadIn: (soil, nutrient) => `Poganizira nthaka ya ${soil.toLowerCase()} ndi ${nutrient.toLowerCase()}, mbewu izi zingakhale zabwino:`,
    noMatch: "Sindinapeze chizindikiro chenicheni. Fotokozaninso mtundu, gawo la mbewu limene lakhudzidwa, ndi mmene zikuwonekera (mawanga, mabowo, kufota).",
    matchedIntro: (name) => `Izi zikuwoneka ngati ${name}.`,
    chemicalLbl: "Mankhwala oyenera:",
    culturalLbl: "Njira zopanda mankhwala:",
    fallback: "Sindili ndi yankho lenileni pa izi, koma ndingathandize pa mbewu, tizilombo, feteleza, kutunga madzi, ziweto, kusunga, ngongole, kapena msika — funsani wa Ulimi wa kudera lanu.",
  },
  tum: {
    greeting: `Tempokani! Ndine wovwira wa ulimi wa ${APP_NAME}. Munifumbe za mbeu izo zingemera pa charu chinu, panandi mulongosole za tuvingondo panji matenda gha mbeu pasi apa.`,
    disclaimer: "Wovwira uyu wakupeleka ulongozgi wapadera wa chiyelezgero. Fumbani wa vilimo pambere mundagwiliskire ntchito mankhwala ghalighose.",
    cropLeadIn: (soil, nutrient) => `Pakuwona charu cha ${soil.toLowerCase()} na ${nutrient.toLowerCase()}, mbeu izi zingemera makola:`,
    noMatch: "Nkhupulika yayi vinthu ivyo mwalongosola makola. Longosolani cha, chigaŵa cha mbeu icho chakhwaskika, na umo vikuwonekera (vibiriwiri, viwaya, kufota).",
    matchedIntro: (name) => `Ichi chikuwoneka nga ${name}.`,
    chemicalLbl: "Mankhwala ghakwenelela:",
    culturalLbl: "Nthowa zambura mankhwala:",
    fallback: "Nkhulije yankho lenileni pa ivi, kweni ningakuvwira pa mbeu, tuvingondo, feteleza, maji, viweto, kusunga, ngongole, panji msika — fumbani wa vilimo wa mu chigaŵa chinu.",
  },
};

const CROP_ALIAS = { Maize: " (Chimanga)", Cassava: " (Chinangwa)" };

export function normalizeLang(lang) {
  const key = String(lang || "en").toLowerCase();
  if (key === "ny" || key === "chichewa") return "ny";
  if (key === "tum" || key === "tumbuka") return "tum";
  return "en";
}

export function recommendCrops(soil, nutrient) {
  const scored = Object.entries(CROP_INFO).map(([crop, info]) => {
    let score = 0;
    if (info.soils.includes(soil)) score += 2;
    if (info.nutrients.includes(nutrient)) score += 2;
    return { crop, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored.filter((row) => row.score > 0).slice(0, 3).map((row) => row.crop);
  return top.length ? top : scored.slice(0, 2).map((row) => row.crop);
}

export function matchDisease(text) {
  const t = String(text || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const disease of DISEASE_DB) {
    const score = disease.keywords.filter((keyword) => t.includes(keyword)).length;
    if (score > bestScore) {
      bestScore = score;
      best = disease;
    }
  }
  return bestScore > 0 ? best : null;
}

export function answerGeneralQuestion(text) {
  const t = String(text || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const item of GENERAL_AG_KB) {
    const score = item.keywords.filter((keyword) => t.includes(keyword)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > 0 ? best : null;
}

export function buildCropReply(crops, soil, nutrient, lang = "en") {
  const copy = COPY[normalizeLang(lang)];
  const list = crops.map((crop) => {
    const extra = lang === "ny" ? (CROP_ALIAS[crop] || "") : "";
    return `• ${crop}${extra} — ${CROP_INFO[crop].reason}`;
  }).join("\n");
  return `${copy.cropLeadIn(soil, nutrient)}\n${list}`;
}

export function buildPestReply(match, lang = "en") {
  const copy = COPY[normalizeLang(lang)];
  if (!match) return copy.noMatch;
  return `${copy.matchedIntro(match.name)}\n${copy.chemicalLbl} ${match.chemical}\n${copy.culturalLbl} ${match.cultural}`;
}

export function advisorMeta() {
  return {
    soils: SOIL_TYPES,
    nutrients: NUTRIENT_STATUSES,
    languages: [
      { id: "en", label: "English" },
      { id: "ny", label: "Chichewa" },
      { id: "tum", label: "Tumbuka" },
    ],
    copy: Object.fromEntries(Object.entries(COPY).map(([lang, value]) => [lang, {
      greeting: value.greeting,
      disclaimer: value.disclaimer,
    }])),
  };
}

export function askAdvisor(input = {}) {
  const lang = normalizeLang(input.lang);
  const copy = COPY[lang];
  const text = String(input.text || "").trim();
  const topic = String(input.topic || "auto");
  const soil = input.soil || input.farmer?.soilType || null;
  const nutrient = input.nutrient || input.farmer?.nutrientStatus || null;
  const lowered = text.toLowerCase();

  if (topic === "weather" || (text && /\bweather\b|today's weather|nyengo/.test(lowered))) {
    return { lang, kind: "weather", intent: "weather", reply: null };
  }
  if (topic === "market" || (text && /market price|what.*worth|mitengo|msika/.test(lowered))) {
    return { lang, kind: "market", intent: "market", reply: null };
  }

  if (topic === "crop" || (topic === "auto" && !text && soil && nutrient)) {
    if (!soil || !nutrient) {
      return { lang, kind: "crop", reply: copy.fallback };
    }
    const crops = recommendCrops(soil, nutrient);
    return { lang, kind: "crop", crops, reply: buildCropReply(crops, soil, nutrient, lang) };
  }

  const pest = matchDisease(text);
  if (pest && (topic === "pest" || topic === "auto")) {
    return {
      lang,
      kind: "pest",
      match: pest.name,
      reply: buildPestReply(pest, lang),
    };
  }
  if (topic === "pest") {
    return { lang, kind: "unknown", reply: copy.noMatch };
  }

  const general = answerGeneralQuestion(text);
  if (general) {
    const prefix = lang === "en" ? `On ${general.topic.toLowerCase()}: ` : "";
    return { lang, kind: "general", topic: general.topic, reply: prefix + general.answer };
  }

  if (/grow|plant|crop|which crop|what to plant|ndibzale|nipande/.test(lowered) && soil && nutrient) {
    const crops = recommendCrops(soil, nutrient);
    return { lang, kind: "crop", crops, reply: buildCropReply(crops, soil, nutrient, lang) };
  }

  return { lang, kind: "unknown", reply: topic === "pest" ? copy.noMatch : copy.fallback };
}

export async function logPestReport(db, farmer, input = {}) {
  const row = {
    id: crypto.randomUUID(),
    farmer_id: farmer.id,
    symptoms: String(input.symptoms || "").slice(0, 500),
    match_name: input.matchName || null,
    channel: input.channel || "mobile",
    created_at: Date.now(),
  };
  await db.prepare(`
    INSERT INTO pest_reports (id, farmer_id, symptoms, match_name, channel, created_at)
    VALUES (@id, @farmer_id, @symptoms, @match_name, @channel, @created_at)
  `).run(row);
  return row;
}

export async function listPestReports(db) {
  return (await db.prepare(`
    SELECT r.*, f.name AS farmer_name, f.code AS farmer_code, f.district, f.epa
    FROM pest_reports r
    JOIN farmers f ON f.id = r.farmer_id
    ORDER BY r.created_at DESC
    LIMIT 50
  `).all()).map((row) => ({
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    farmerCode: row.farmer_code,
    district: row.district,
    epa: row.epa,
    symptoms: row.symptoms,
    matchName: row.match_name,
    channel: row.channel,
    createdAt: row.created_at,
  }));
}
