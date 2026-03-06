import { unauthenticated, prisma } from "../shopify.server";

const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const res = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");
  if (!shop) return res({ error: "Missing shop" }, 400);
  if (!productId) return res({ configured: false });
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const config = await prisma.priceConfig.findFirst({ where: { shop, productId: gid, enabled: true } });
  if (!config) return res({ configured: false });
  return res({ configured: true, basePrice: config.basePrice, unit: config.unit, unitLabel: config.unitLabel, minPrice: config.minPrice });
};

export const action = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) return res({ error: "Missing shop" }, 400);
  let body = {};
  try { body = await request.json(); } catch (e) {}
  if (body.intent !== "create-draft-order") return res({ error: "Unknown intent" }, 400);
  const { variantId, productTitle, length, width, calculatedPrice, quantity = 1 } = body;
  if (!variantId || !calculatedPrice) return res({ error: "Missing data" }, 400);
  try {
    const { admin } = await unauthenticated.admin(shop);
    const variantGid = variantId.startsWith("gid://") ? variantId : `gid://shopify/ProductVariant/${variantId}`;
    const response = await admin.graphql(`
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder { id invoiceUrl totalPrice }
          userErrors { field message }
        }
      }`, {
      variables: {
        input: {
          lineItems: [{ variantId: variantGid, quantity: parseInt(quantity), originalUnitPrice: parseFloat(calculatedPrice).toFixed(2),
            customAttributes: [{ key: "Length", value: String(length) }, { key: "Width", value: String(width) }] }],
          note: `Custom liner: ${length} x ${width} — ${productTitle}`,
        }
      }
    });
    const result = await response.json();
    const draftOrder = result?.data?.draftOrderCreate?.draftOrder;
    const errors = result?.data?.draftOrderCreate?.userErrors || [];
    if (errors.length > 0) return res({ error: errors.map(e => e.message).join(", ") }, 422);
    if (draftOrder) return res({ success: true, checkoutUrl: draftOrder.invoiceUrl, totalPrice: draftOrder.totalPrice });
    return res({ error: "Draft order failed" }, 500);
  } catch (err) {
    return res({ error: err.message }, 500);
  }
};
