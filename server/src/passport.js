import { STAGES } from "./stages.js";

function tierFor(score, stagesLogged) {
  if (stagesLogged === 0) {
    return { grade: "—", label: "Unrated", status: "Log the season to start a credit record." };
  }
  if (score >= 650)
    return { grade: "A", label: "Bankable", status: "Verified grain and a cleared sale sit on this record." };
  if (score >= 550)
    return {
      grade: "B",
      label: "Bankable — building",
      status: "Warehouse evidence is on file. A cleared sale would lift this further.",
    };
  if (score >= 450)
    return {
      grade: "C",
      label: "Developing",
      status: "The season log is underway. Graded grain is the next proof lenders look for.",
    };
  if (score >= 340)
    return { grade: "D", label: "Early record", status: "Identity is on the register. Keep logging stages." };
  return { grade: "F", label: "Incomplete", status: "Not yet enough verified activity for a lender to read." };
}

export function buildPassport(status, receipts = [], contracts = []) {
  const farmer = status.farmer;
  const events = status.events || [];
  const stagesLogged = events.length;
  const accepted = receipts.filter((row) => row.status === "accepted");
  const pendingLoan = accepted.filter((row) => row.loanCap > 0 && row.loanDisbursed === 0);
  const paidLoan = accepted.filter((row) => row.loanDisbursed > 0);
  const mine = contracts.filter((row) => row.farmerId === farmer.id);
  const clearedSales = mine.filter((row) => row.status === "cleared");
  const blockedSales = mine.filter((row) => row.status === "blocked");

  const kgByCrop = {};
  const valueByCrop = {};
  for (const row of accepted) {
    kgByCrop[row.crop] = (kgByCrop[row.crop] || 0) + row.weightKg;
    valueByCrop[row.crop] = (valueByCrop[row.crop] || 0) + row.assetValue;
  }
  const unsoldKg = { ...kgByCrop };
  let saleIncome = 0;
  const soldCrops = [];
  for (const sale of [...clearedSales].sort((a, b) => a.createdAt - b.createdAt)) {
    const kg = unsoldKg[sale.crop] || 0;
    if (kg <= 0) continue;
    saleIncome += Math.round(kg * sale.pricePerKg);
    soldCrops.push({ crop: sale.crop, weightKg: kg, pricePerKg: sale.pricePerKg, buyer: sale.buyer });
    unsoldKg[sale.crop] = 0;
  }
  let warehouseValue = 0;
  for (const crop of Object.keys(kgByCrop)) {
    const unsold = unsoldKg[crop] || 0;
    const total = kgByCrop[crop];
    warehouseValue += total ? Math.round(valueByCrop[crop] * (unsold / total)) : 0;
  }

  const loanCap = accepted.reduce((sum, row) => sum + (row.loanCap || 0), 0);
  const loanDisbursed = accepted.reduce((sum, row) => sum + (row.loanDisbursed || 0), 0);
  const netIncome = saleIncome;

  let score = 300;
  score += Math.min(stagesLogged, STAGES.length) * 20;
  if (accepted.length) score += 70;
  if (paidLoan.length) score += 40;
  if (clearedSales.length) score += 80;
  if (status.seasonComplete) score += 50;
  score = Math.min(850, score);

  const tier = tierFor(score, stagesLogged);
  const checks = [
    { id: "identity", label: "Farmer ID on the register", done: true },
    { id: "stages", label: `${stagesLogged} of ${STAGES.length} season stages logged`, done: stagesLogged > 0 },
    { id: "grain", label: "Grain graded at the warehouse", done: accepted.length > 0 },
    { id: "loan", label: "Warehouse loan accepted", done: paidLoan.length > 0 },
    { id: "sale", label: "Sale cleared above the ministry floor", done: clearedSales.length > 0 },
  ];

  return {
    name: farmer.name,
    code: farmer.code,
    phone: farmer.phone,
    district: farmer.district,
    epa: farmer.epa,
    region: farmer.region,
    languages: ["EN", "CH", "TUM"],
    score,
    grade: tier.grade,
    label: tier.label,
    status: tier.status,
    stagesLogged,
    stagesTotal: STAGES.length,
    warehouseValue,
    loanCap,
    loanDisbursed,
    loanPending: pendingLoan.reduce((sum, row) => sum + row.loanCap, 0),
    saleIncome,
    netIncome,
    soldCrops,
    blockedSales: blockedSales.length,
    checks,
  };
}
