export const MARKET_SOURCES = [
  { slug: "localbuy", name: "LocalBuyEx", kind: "scrape", url: "https://www.localbuyex.com/" },
  { slug: "ulimi", name: "Ulimi", kind: "scrape", url: "https://www.ulimi.online/" },
  { slug: "manual", name: "Manual entry", kind: "manual", url: null },
  { slug: "admarc", name: "ADMARC", kind: "manual", url: "https://www.admarc.co.mw/" },
  { slug: "nfra", name: "NFRA", kind: "manual", url: null },
  { slug: "ace", name: "ACE Africa", kind: "manual", url: null },
  { slug: "namis", name: "NAMIS", kind: "manual", url: null },
  { slug: "worldbank", name: "World Bank", kind: "import", url: "https://data.worldbank.org/" },
];

export const MARKET_COMMODITIES = [
  { slug: "maize", name: "Maize", aliases: ["Maize", "WH", "Chimanga"] },
  { slug: "soya-beans", name: "Soybeans", aliases: ["Soybeans", "Soya beans", "Soya", "SB", "Soya Beans"] },
  { slug: "groundnuts", name: "Groundnuts", aliases: ["Groundnuts", "Ground Nuts", "Ground nuts"] },
  { slug: "beans", name: "Beans", aliases: ["Beans", "BN"] },
  { slug: "rice", name: "Rice", aliases: ["Rice"] },
  { slug: "pigeon-peas", name: "Pigeon peas", aliases: ["Pigeon peas", "Pigeon Peas"] },
  { slug: "sesame", name: "Sesame", aliases: ["Sesame", "SM"] },
  { slug: "sunflower", name: "Sunflower", aliases: ["Sunflower"] },
  { slug: "cassava", name: "Cassava", aliases: ["Cassava", "Chinangwa"] },
  { slug: "irish-potatoes", name: "Irish Potatoes", aliases: ["Irish Potatoes", "Irish Potato", "LR"] },
  { slug: "sweet-potatoes", name: "Sweet potatoes", aliases: ["Sweet potatoes"] },
  { slug: "wheat", name: "Wheat", aliases: ["Wheat"] },
  { slug: "cotton", name: "Cotton", aliases: ["Cotton"] },
  { slug: "tobacco", name: "Tobacco", aliases: ["Tobacco"] },
  { slug: "sorghum", name: "Sorghum", aliases: ["Sorghum"] },
  { slug: "tomatoes", name: "Tomatoes", aliases: ["Tomatoes"] },
  { slug: "onions", name: "Onions", aliases: ["Onions"] },
  { slug: "cabbages", name: "Cabbages", aliases: ["Cabbages"] },
];

export const PLAN_CROP_SOURCES = {
  Maize: ["Maize"],
  Groundnuts: ["Groundnuts"],
  Soybeans: ["Soybeans", "Soya beans"],
  "Pigeon peas": ["Pigeon peas"],
  Sorghum: ["Sorghum"],
  "Irish Potatoes": ["Irish Potatoes", "Irish Potato"],
  "Sweet potatoes": ["Sweet potatoes"],
  Tomatoes: ["Tomatoes"],
  Onions: ["Onions"],
  Cassava: ["Cassava"],
  Rice: ["Rice"],
  Tobacco: ["Tobacco"],
  Cabbages: ["Cabbages"],
  Beans: ["Beans"],
  Sesame: ["Sesame"],
};

export function matchCommodityName(name) {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return null;
  for (const row of MARKET_COMMODITIES) {
    if (row.name.toLowerCase() === key || row.slug === key) return row;
    if (row.aliases.some((alias) => alias.toLowerCase() === key)) return row;
  }
  return null;
}
