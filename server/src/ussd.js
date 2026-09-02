import { findFarmerByPhone, farmerStatus, logStage } from "./farmers.js";

function ussdReply(message) {
  return message;
}

export function handleUssd(db, body = {}) {
  const phone = body.phoneNumber || body.phone || "";
  const text = String(body.text || "");
  let farmer;
  try {
    farmer = findFarmerByPhone(db, phone);
  } catch {
    farmer = null;
  }

  if (!farmer) {
    return ussdReply("END This phone is not registered on DzalaSmart. Register in the app or with your extension officer.");
  }

  const parts = text.split("*").map((p) => p.trim()).filter((p) => p.length > 0);

  if (parts.length === 0) {
    return ussdReply(
      `CON DzalaSmart — ${farmer.name}\n1. Log next milestone\n2. My season status`
    );
  }

  if (parts[0] === "1") {
    const status = farmerStatus(db, farmer);
    if (status.seasonComplete) {
      return ussdReply("END This season is complete. Your cooperative can already see the full record.");
    }
    if (parts.length === 1) {
      return ussdReply(`CON Next milestone: ${status.nextStage.name}\n1. Confirm\n0. Cancel`);
    }
    if (parts[1] === "1") {
      const updated = logStage(db, farmer, { channel: "ussd" });
      return ussdReply(`END ${updated.currentStage.name} recorded for ${farmer.name}.`);
    }
    return ussdReply("END Cancelled.");
  }

  if (parts[0] === "2") {
    const status = farmerStatus(db, farmer);
    const current = status.currentStage ? status.currentStage.name : "Not started";
    const next = status.nextStage ? status.nextStage.name : "Season complete";
    return ussdReply(
      `END ${farmer.code}\nCurrent: ${current}\nNext: ${next}\nEvents logged: ${status.events.length}`
    );
  }

  return ussdReply("END Invalid choice.");
}
