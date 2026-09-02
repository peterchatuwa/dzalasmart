export const STAGES = [
  { index: 0, key: "input_redemption", name: "Input Redemption" },
  { index: 1, key: "land_preparation", name: "Land Preparation" },
  { index: 2, key: "planting", name: "Planting" },
  { index: 3, key: "vegetative_growth", name: "Vegetative Growth" },
  { index: 4, key: "harvest", name: "Harvest" },
  { index: 5, key: "post_harvest", name: "Post-Harvest Handling" },
  { index: 6, key: "marketing", name: "Marketing" },
  { index: 7, key: "net_income", name: "Net Income Ledger" },
];

export function stageByIndex(index) {
  return STAGES.find((s) => s.index === index) || null;
}

export function stageByKey(key) {
  return STAGES.find((s) => s.key === key) || null;
}

export function publicStage(stage) {
  if (!stage) return null;
  return { index: stage.index, key: stage.key, name: stage.name };
}
