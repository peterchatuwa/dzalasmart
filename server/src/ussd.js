import { APP_NAME } from "./brand.js";
import { askAdvisor, logPestReport } from "./advisor.js";
import { findFarmerByPhone, farmerStatus, logStage } from "./farmers.js";
import { getMarketPriceFromDb } from "./market.js";
import { listFarmerAlerts, listFarmerAlertEvents } from "./market/alerts.js";
import { acceptWarehouseLoan, listReceiptsForFarmer, pendingLoanReceipts } from "./warehouse.js";
import { fetchDistrictWeather, publicWeather, ussdWeatherLine } from "./weather.js";
import { listFarmerVouchers, VOUCHER_STATUS } from "./vouchers.js";

const USSD_PEST = {
  1: "worms on leaves holes in the leaves caterpillar mphutsi",
  2: "yellow spots yellow streak mawanga achikasu",
  3: "wilt kufota",
};

const USSD_CROPS = {
  1: "Maize",
  2: "Groundnuts",
  3: "Soybeans",
  4: "Beans",
};

function ussdReply(message) {
  return message;
}

export async function handleUssd(db, body = {}) {
  const phone = body.phoneNumber || body.phone || "";
  const text = String(body.text || "");
  let farmer;
  try {
    farmer = await findFarmerByPhone(db, phone);
  } catch {
    farmer = null;
  }

  if (!farmer) {
    return ussdReply(
      `END This phone is not registered on ${APP_NAME}. Register in the app or with your extension officer.`
    );
  }

  const parts = text
    .split("*")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) {
    return ussdReply(
      `CON ${APP_NAME} — ${farmer.name}\n1. Log next milestone\n2. My season status\n3. Weather for my district\n4. Report a pest problem\n5. Warehouse & loan\n6. Market price\n7. Price alerts\n8. Input vouchers`
    );
  }

  if (parts[0] === "1") {
    const status = await farmerStatus(db, farmer);
    if (status.seasonComplete) {
      return ussdReply("END This season is complete. Your cooperative can already see the full record.");
    }
    if (parts.length === 1) {
      return ussdReply(`CON Next milestone: ${status.nextStage.name}\n1. Confirm\n0. Cancel`);
    }
    if (parts[1] === "1") {
      const updated = await logStage(db, farmer, { channel: "ussd" });
      return ussdReply(`END ${updated.currentStage.name} recorded for ${farmer.name}.`);
    }
    return ussdReply("END Cancelled.");
  }

  if (parts[0] === "2") {
    const status = await farmerStatus(db, farmer);
    const current = status.currentStage ? status.currentStage.name : "Not started";
    const next = status.nextStage ? status.nextStage.name : "Season complete";
    return ussdReply(`END ${farmer.code}\nCurrent: ${current}\nNext: ${next}\nEvents logged: ${status.events.length}`);
  }

  if (parts[0] === "3") {
    try {
      const summary = publicWeather(await fetchDistrictWeather(farmer.district));
      return ussdReply(`END ${ussdWeatherLine(summary)}`);
    } catch {
      return ussdReply("END Could not fetch live weather. Try again when you have signal.");
    }
  }

  if (parts[0] === "4") {
    if (parts.length === 1) {
      return ussdReply("CON What are you seeing?\n1. Worms on leaves\n2. Yellow spots\n3. Wilting stalks");
    }
    const symptoms = USSD_PEST[parts[1]];
    if (!symptoms) return ussdReply("END Invalid choice.");
    const result = askAdvisor({ text: symptoms, topic: "pest", lang: "en" });
    await logPestReport(db, farmer, {
      symptoms: result.match || symptoms,
      matchName: result.match,
      channel: "ussd",
    });
    const short = result.reply.split("\n")[0];
    return ussdReply(`END ${short}\nYour report was sent to extension.`);
  }

  if (parts[0] === "5") {
    const receipts = await listReceiptsForFarmer(db, farmer.id);
    const latest = receipts[0];
    if (!latest) {
      return ussdReply("END No grain has been taken in yet. Deliver to your cooperative after harvest.");
    }
    const pending = pendingLoanReceipts(receipts);
    if (parts.length === 1) {
      if (pending.length) {
        const lot = pending[0];
        return ussdReply(
          `CON ${lot.code}\n${lot.crop} ${lot.weightKg}kg · ${lot.moisturePct}% · Graded\nAdvance MWK ${lot.loanCap.toLocaleString("en")}\n1. Accept loan\n2. Not now`
        );
      }
      if (latest.status === "drying_required") {
        return ussdReply(
          `END ${latest.code}\n${latest.crop} ${latest.weightKg}kg · ${latest.moisturePct}% · Drying required.\nNo loan until moisture is in the accept band.`
        );
      }
      if (latest.status === "rejected") {
        return ussdReply(`END ${latest.code} was rejected for moisture. Bring drier grain.`);
      }
      if (latest.loanDisbursed > 0) {
        return ussdReply(
          `END Grade approved. MWK ${latest.loanDisbursed.toLocaleString("en")} already sent to your registered wallet.`
        );
      }
      return ussdReply(`END ${latest.code} · ${latest.statusLabel}. No loan waiting.`);
    }
    if (parts[1] === "2") return ussdReply("END Loan not accepted. The grain stays on your warehouse receipt.");
    if (parts[1] !== "1") return ussdReply("END Invalid choice.");
    try {
      const result = await acceptWarehouseLoan(db, farmer, { channel: "ussd" });
      return ussdReply(
        `END Loan request for MWK ${result.requestedAmount.toLocaleString("en")} submitted. Your cooperative will approve and disburse within 24 hours.`
      );
    } catch (error) {
      return ussdReply(`END ${error.message}`);
    }
  }

  if (parts[0] === "6") {
    if (parts.length === 1) {
      return ussdReply("CON Choose crop\n1. Maize\n2. Groundnuts\n3. Soybeans\n4. Beans");
    }
    const crop = USSD_CROPS[parts[1]];
    if (!crop) return ussdReply("END Invalid choice.");
    const price = await getMarketPriceFromDb(db, crop, farmer.district);
    if (price == null) {
      return ussdReply(
        `END No live ${crop} price stored for ${farmer.district} yet. Try again after the market feeds refresh.`
      );
    }
    return ussdReply(`END ${crop} in ${farmer.district}: MWK ${Math.round(price).toLocaleString("en")}/kg`);
  }

  if (parts[0] === "7") {
    const alerts = await listFarmerAlerts(db, farmer.id);
    const events = await listFarmerAlertEvents(db, farmer.id, 3);
    const active = alerts.filter((row) => row.active);
    if (!active.length && !events.length) {
      return ussdReply("END No price alerts yet. Set them in the farmer app under Market prices.");
    }
    const lines = [];
    if (active.length) {
      lines.push(`${active.length} active alert${active.length === 1 ? "" : "s"}:`);
      for (const alert of active.slice(0, 3)) {
        lines.push(`${alert.commoditySlug} ${alert.direction} ${Math.round(alert.thresholdPerKg)}/kg`);
      }
    }
    if (events[0]) {
      lines.push(`Latest: ${events[0].message}`);
    }
    return ussdReply(`END ${lines.join("\n")}`);
  }

  if (parts[0] === "8") {
    const vouchers = await listFarmerVouchers(db, farmer.id, {});
    const active = vouchers.filter((v) => v.status === VOUCHER_STATUS.ACTIVE);
    const redeemed = vouchers.filter((v) => v.status === VOUCHER_STATUS.REDEEMED);

    if (vouchers.length === 0) {
      return ussdReply("END You have no input vouchers yet. Contact your extension officer for FISP allocation.");
    }

    if (parts.length === 1) {
      const lines = [`You have ${vouchers.length} voucher${vouchers.length === 1 ? "" : "s"}`];
      if (active.length > 0) {
        lines.push(`${active.length} active — ready to redeem`);
      }
      if (redeemed.length > 0) {
        lines.push(`${redeemed.length} already redeemed`);
      }
      lines.push("1. View active vouchers");
      lines.push("0. Back");
      return ussdReply(`CON ${lines.join("\n")}`);
    }

    if (parts[1] === "1") {
      if (active.length === 0) {
        return ussdReply("END You have no active vouchers. All vouchers have been redeemed or expired.");
      }

      if (parts.length === 2) {
        const lines = ["Active vouchers:"];
        for (let i = 0; i < Math.min(3, active.length); i++) {
          const v = active[i];
          lines.push(`${i + 1}. ${v.code} (${v.season})`);
        }
        lines.push("0. Back");
        return ussdReply(`CON ${lines.join("\n")}`);
      }

      const index = Number(parts[2]) - 1;
      if (index < 0 || index >= active.length) {
        return ussdReply("END Invalid choice.");
      }

      const voucher = active[index];
      const lines = [
        `Code: ${voucher.code}`,
        `Season: ${voucher.season}`,
        `Inputs: ${voucher.inputs.length} item${voucher.inputs.length === 1 ? "" : "s"}`,
      ];

      for (const input of voucher.inputs.slice(0, 3)) {
        lines.push(`· ${input.inputName}: ${input.quantity} ${input.inputUnit}`);
      }

      const contributionText = voucher.summary.totalFarmerContribution > 0 
        ? `Your share: MWK ${voucher.summary.totalFarmerContribution.toLocaleString("en")}`
        : "Fully subsidized";

      lines.push(contributionText);
      lines.push("Redeem at your nearest agro-dealer.");

      return ussdReply(`END ${lines.join("\n")}`);
    }

    return ussdReply("END Invalid choice.");
  }

  return ussdReply("END Invalid choice.");
}
