import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOP = "pond-liners-online.myshopify.com";
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const res = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  if (!productId) return res({ configured: false });

  try {
    // Try both formats: with and without gid prefix
    const gid = `gid://shopify/Product/${productId}`;
    const config = await prisma.priceConfig.findFirst({
      where: {
        shop: SHOP,
        enabled: true,
        OR: [
          { productId: gid },
          { productId: productId },
        ],
      },
    });

    if (!config) return res({ configured: false });

    return res({
      configured: true,
      basePrice: config.basePrice,
      unit: config.unit,
      unitLabel: config.unitLabel,
      minPrice: config.minPrice,
    });
  } catch (e) {
    console.error("Proxy loader error:", e.message);
    return res({ configured: false });
  }
};

export const action = async ({ request }) => {
  let body = {};
  try { body = await request.json(); } catch (e) {}

  if (body.intent !== "create-draft-order") return res({ error: "Unknown intent" }, 400);

  const { variantId, productTitle, length, width, calculatedPrice, quantity = 1 } = body;
  if (!variantId || !calculatedPrice) return res({ error: "Missing data" }, 400);

  if (!TOKEN) return res({ error: "SHOPIFY_ACCESS_TOKEN not set in Railway" }, 500);

  try {
    const numericId = variantId.toString().replace("gid://shopify/ProductVariant/", "");

    const response = await fetch(
      `https://${SHOP}/admin/api/2024-04/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft_order: {
            line_items: [{
              variant_id: parseInt(numericId),
              quantity: parseInt(quantity),
              price: parseFloat(calculatedPrice).toFixed(2),
              properties: [
                { name: "Length", value: String(length) },
                { name: "Width",  value: String(width) },
              ],
            }],
            note: `Custom liner: ${length} x ${width} — ${productTitle}`,
            tags: "custom-dimension,pond-liner",
          },
        }),
      }
    );

    const data = await response.json();
    const draftOrder = data?.draft_order;

    if (draftOrder) {
      return res({
        success: true,
        checkoutUrl: draftOrder.invoice_url,
        totalPrice: draftOrder.total_price,
      });
    }

    return res({ error: "Draft order failed: " + JSON.stringify(data?.errors) }, 500);

  } catch (err) {
    console.error("Proxy action error:", err.message);
    return res({ error: err.message }, 500);
  }
};
