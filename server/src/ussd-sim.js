import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const base = process.env.DZALASMART_URL || "http://localhost:4000";

async function postUssd(phoneNumber, text) {
  const res = await fetch(`${base}/ussd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "local-sim",
      serviceCode: "*413#",
      phoneNumber,
      text,
    }),
  });
  return res.text();
}

function printReply(reply) {
  const kind = reply.startsWith("CON ") ? "CONTINUE" : "END";
  const body = reply.replace(/^(CON|END) /, "");
  console.log(`\n[${kind}]\n${body}\n`);
  return kind === "CONTINUE";
}

async function main() {
  const rl = readline.createInterface({ input, output });
  console.log(`DzalaSmart USSD simulator → ${base}/ussd`);
  console.log("Demo phones: +265888000001  +265888000002  +265888000003  PIN 1234\n");
  const phone = (await rl.question("Phone number: ")).trim();
  let text = "";
  try {
    while (true) {
      const reply = await postUssd(phone, text);
      if (!printReply(reply)) break;
      const choice = (await rl.question("Key: ")).trim();
      text = text ? `${text}*${choice}` : choice;
    }
  } catch (error) {
    console.error("Could not reach the server. Start it with: npm start");
    console.error(error.message);
  } finally {
    rl.close();
  }
}

main();
