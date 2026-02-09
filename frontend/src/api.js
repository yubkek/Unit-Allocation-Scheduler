const API = {
  authLogin: "/api/auth/login/",
  authLogout: "/api/auth/logout/",
  authMe: "/api/auth/me/",
  units: "/api/units/",
  slots: "/api/slots/",
  allocations: "/api/allocations/",
};

function getCsrfToken() {
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/);
  return match ? match[1] : null;
}

function apiOptions(method, body = undefined) {
  const opts = { method, credentials: "include" };
  const headers = {};
  const token = getCsrfToken();
  if (token) headers["X-CSRFToken"] = token;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (Object.keys(headers).length) opts.headers = headers;
  return opts;
}

const fetchOpts = { credentials: "include" };

async function handleJSON(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function getMe() {
  const res = await fetch(API.authMe, fetchOpts);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(username, password) {
  return handleJSON(
    await fetch(API.authLogin, apiOptions("POST", { username, password }))
  );
}

export async function logout() {
  const res = await fetch(API.authLogout, apiOptions("POST"));
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

export async function getUnits() {
  return handleJSON(await fetch(API.units, fetchOpts));
}

export async function getSlots() {
  return handleJSON(await fetch(API.slots, fetchOpts));
}

export async function getAllocations() {
  return handleJSON(await fetch(API.allocations, fetchOpts));
}

export async function createAllocation(unit_id, slot_id) {
  return handleJSON(await fetch(API.allocations, apiOptions("POST", { unit_id, slot_id })));
}

export async function deleteAllocation(id) {
  const res = await fetch(API.allocations + id + "/", apiOptions("DELETE"));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return;
  return res.json();
}
