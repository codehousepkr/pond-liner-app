import { useLoaderData } from "react-router";
import { Page, Layout, Card, Text, BlockStack, InlineStack, Button, Banner } from "@shopify/polaris";
import { authenticate, prisma } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const configCount = await prisma.priceConfig.count({ where: { shop } });
  const activeConfigs = await prisma.priceConfig.count({ where: { shop, enabled: true } });
  return { shop, configCount, activeConfigs };
};

export default function Index() {
  const { configCount, activeConfigs } = useLoaderData();
  return (
    <Page title="Pond Liner Price Calculator">
      <Layout>
        <Layout.Section>
          <Banner title="How it works" tone="info">
            <p>Customer enters pond dimensions → prices update live on product cards → customer clicks Add to Cart → checkout at exact calculated price.</p>
          </Banner>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400">
                <BlockStack gap="100">
                  <Text variant="headingMd">Configured Products</Text>
                  <Text variant="heading2xl">{configCount}</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="headingMd">Active</Text>
                  <Text variant="heading2xl">{activeConfigs}</Text>
                </BlockStack>
              </InlineStack>
              <Button url="/app/products" variant="primary">Configure Products →</Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
