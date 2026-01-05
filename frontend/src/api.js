const API = {
  units: "/api/units/",
  slots: "/api/slots/",
  allocations: "/api/allocations/",
};

async function handleJSON(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function getUnits() {
  return handleJSON(await fetch(API.units));
}

export async function getSlots() {
  return handleJSON(await fetch(API.slots));
}

export async function getAllocations() {
  return handleJSON(await fetch(API.allocations));
}

export async function createAllocation(unit_id, slot_id) {
  return handleJSON(await fetch(API.allocations, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unit_id, slot_id }),
  }));
}

export async function deleteAllocation(id) {
  return handleJSON(await fetch(API.allocations + id + "/", { method: "DELETE" }));
}
