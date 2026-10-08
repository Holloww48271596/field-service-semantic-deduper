const record = {
  workOrderId: "wo-2048",
  photo: {
    caption: "Water pooling below the brass inlet valve after tightening",
    sha256: "a".repeat(64)
  },
  dispatchStatus: "on_site",
  technicianFollowUp: "Replaced the inlet washer and watched the joint for ten minutes.",
  occurredAt: "2026-09-12T08:30:00.000Z"
};

const response = await fetch("http://localhost:3000/records/check", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(record)
});
console.log(await response.json());
