import type { LaunchOptions } from "@playwright/test";
export function remoteTarget(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "PLANNER_BASE_URL must be an HTTPS origin without credentials, query or fragment.",
    );
  return url.origin;
}
// Respect the cloud machine's existing egress proxy; never print its URL or auth.
export function remoteProxy(): LaunchOptions["proxy"] {
  const value = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!value) return undefined;
  const url = new URL(value);
  return {
    server: `${url.protocol}//${url.host}`,
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
    bypass: "127.0.0.1,localhost",
  };
}
