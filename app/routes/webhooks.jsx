import { authenticate, prisma } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, session } = await authenticate.webhook(request);
  if (topic === "APP_UNINSTALLED") {
    await prisma.priceConfig.deleteMany({ where: { shop } });
    if (session) await prisma.session.deleteMany({ where: { shop } });
  }
  return new Response(null, { status: 200 });
};
