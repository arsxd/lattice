import { execSync } from "node:child_process";
// A short commit id. The release label alone cannot tell two builds of the same
// version apart, which matters when checking that an app update really applied.
export function buildId() {
  const fromCi = process.env.GITHUB_SHA?.slice(0, 7);
  if (fromCi) return fromCi;
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "0000000";
  }
}
