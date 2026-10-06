export const TOKEN_KEY = "tanpit_token";
export const LABELS = { fill: "注液", tanning: "鞣制中", drained: "已放液" };
export const STATUS_ORDER = ["fill", "tanning", "drained"];

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "请求失败");
  return data;
}

export function allOff(visible) {
  return visible && !visible.fill && !visible.tanning && !visible.drained;
}

export function fmtTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("zh-CN", { hour12: false });
}
