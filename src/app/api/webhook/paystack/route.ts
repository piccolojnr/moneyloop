// Alias kept for backwards compatibility in case old webhook URL is still
// registered in the Paystack dashboard. Both paths share the same handler.
// Preferred canonical URL: /api/webhooks/paystack
export { POST } from "../../webhooks/paystack/route";
