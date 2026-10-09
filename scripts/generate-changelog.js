import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function category(message) {
  if (/theme|design|frontend|ui|tree|timeline|style|dashboard|layout|visual/i.test(message)) return "Interface & Design";
  if (/mmr|elo|rp|rating|rank|leaderboard|scoring|expected-win/i.test(message)) return "Ranked Ratings";
  if (/scrim|late game|winstreak|match|opponent|roster|record/i.test(message)) return "Match Tracking";
  if (/profile|player|credential|username|password/i.test(message)) return "Player Profiles";
  if (/data|persist|backup|storage|deploy|server|api|ci|syntax|workflow|changelog/i.test(message)) return "Platform & Data";
  if (/fix|bug|harden|refactor|syntax/i.test(message)) return "Quality & Fixes";
  return "Other";
}

const log = execFileSync("git", [
  "log", "-n", "80", "--date=iso-strict",
  "--pretty=format:%H%x1f%aI%x1f%s"
], { encoding: "utf8" });
const entries = log.split("\n").filter(Boolean).map((line) => {
  const [sha, date, title] = line.split("\x1f");
  return { sha, date, category: category(title || ""), title: title || "Update", summary: title || "Repository update" };
}).filter((entry) => !entry.title.toLowerCase().startsWith("chore: refresh update tree"));
writeFileSync("updates.json", JSON.stringify({ entries }, null, 2) + "\n");
console.log(`Wrote ${entries.length} dated updates.`);
