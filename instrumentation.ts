export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTicker } = await import("./lib/store");
  startTicker();
}
