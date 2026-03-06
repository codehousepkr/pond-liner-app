import { useState, useCallback } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page, Layout, Card, ResourceList, ResourceItem, Text, Badge,
  Button, Modal, TextField, Select, BlockStack, InlineStack,
  Thumbnail, Banner, InlineGrid, Toast, Frame,
} from "@shopify/polaris";
import { authenticate, prisma } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const response = await admin.graphql(`
    query { products(first: 50) { nodes {
      id title handle
      featuredImage { url altText }
      variants(first: 1) { nodes { id price } }
    }}}
  `);
  const data = await response.json();
  const products = data?.data?.products?.nodes || [];
  const configs = await prisma.priceConfig.findMany({ where: { shop } });
  const configMap = Object.fromEntries(configs.map((c) => [c.productId, c]));
  return { products, configMap };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const body = await request.formData();
  const intent = body.get("intent");

  if (intent === "save") {
    const productId = body.get("productId");
    const basePrice = parseFloat(body.get("basePrice")) || 1.0;
    const unit = body.get("unit") || "sqm";
    const minPrice = parseFloat(body.get("minPrice")) || 0;
    const labelLength = body.get("labelLength") || "Length";
    const labelWidth = body.get("labelWidth") || "Width";
    const unitLabel = body.get("unitLabel") || "m";
    await prisma.priceConfig.upsert({
      where: { shop_productId: { shop, productId } },
      update: { basePrice, unit, minPrice, labelLength, labelWidth, unitLabel, enabled: true },
      create: { shop, productId, basePrice, unit, minPrice, labelLength, labelWidth, unitLabel, enabled: true },
    });
    return { ok: true };
  }
  if (intent === "delete") {
    await prisma.priceConfig.deleteMany({ where: { shop, productId: body.get("productId") } });
    return { ok: true };
  }
  return { ok: false };
};

export default function ProductsPage() {
  const { products, configMap } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [toastActive, setToastActive] = useState(false);
  const [basePrice, setBasePrice] = useState("15.00");
  const [unit, setUnit] = useState("sqm");
  const [minPrice, setMinPrice] = useState("0");
  const [labelLength, setLabelLength] = useState("Length");
  const [labelWidth, setLabelWidth] = useState("Width");
  const [unitLabel, setUnitLabel] = useState("m");

  const openModal = useCallback((product) => {
    const cfg = configMap[product.id] || {};
    setActiveProduct(product);
    setBasePrice(String(cfg.basePrice ?? "15.00"));
    setUnit(cfg.unit ?? "sqm");
    setMinPrice(String(cfg.minPrice ?? "0"));
    setLabelLength(cfg.labelLength ?? "Length");
    setLabelWidth(cfg.labelWidth ?? "Width");
    setUnitLabel(cfg.unitLabel ?? "m");
    setModalOpen(true);
  }, [configMap]);

  const saveConfig = useCallback(() => {
    if (!activeProduct) return;
    const fd = new FormData();
    fd.append("intent", "save");
    fd.append("productId", activeProduct.id);
    fd.append("basePrice", basePrice);
    fd.append("unit", unit);
    fd.append("minPrice", minPrice);
    fd.append("labelLength", labelLength);
    fd.append("labelWidth", labelWidth);
    fd.append("unitLabel", unitLabel);
    submit(fd, { method: "post" });
    setToastActive(true);
    setModalOpen(false);
  }, [activeProduct, basePrice, unit, minPrice, labelLength, labelWidth, unitLabel, submit]);

  const unitOptions = [
    { label: "Square Meters (m²)", value: "sqm" },
    { label: "Square Feet (ft²)", value: "sqft" },
  ];

  return (
    <Frame>
      <Page title="Product Price Configurations" subtitle="Set price per m² for each pond liner product">
        <Layout>
          <Layout.Section>
            <Banner tone="info">
              <p>Price = Length × Width × Base Price per m²</p>
            </Banner>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <ResourceList
                resourceName={{ singular: "product", plural: "products" }}
                items={products}
                renderItem={(product) => {
                  const cfg = configMap[product.id];
                  const price = product.variants?.nodes?.[0]?.price;
                  return (
                    <ResourceItem id={product.id}
                      media={<Thumbnail source={product.featuredImage?.url || ""} alt={product.title} size="medium" />}
                      name={product.title}>
                      <InlineGrid columns="1fr auto" alignItems="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                          <InlineStack gap="200">
                            <Text tone="subdued" variant="bodySm">Variant price: £{price}</Text>
                            {cfg ? (
                              <Badge tone={cfg.enabled ? "success" : "warning"}>
                                {cfg.enabled ? `Active — £${cfg.basePrice}/m²` : "Disabled"}
                              </Badge>
                            ) : <Badge>Not configured</Badge>}
                          </InlineStack>
                        </BlockStack>
                        <InlineStack gap="200">
                          <Button size="slim" onClick={() => openModal(product)}>
                            {cfg ? "Edit" : "Set Up"}
                          </Button>
                          {cfg && (
                            <Button size="slim" tone="critical" onClick={() => {
                              const fd = new FormData();
                              fd.append("intent", "delete");
                              fd.append("productId", product.id);
                              submit(fd, { method: "post" });
                            }}>Remove</Button>
                          )}
                        </InlineStack>
                      </InlineGrid>
                    </ResourceItem>
                  );
                }}
              />
            </Card>
          </Layout.Section>
        </Layout>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)}
          title={`Configure: ${activeProduct?.title || ""}`}
          primaryAction={{ content: "Save", onAction: saveConfig, loading: isSubmitting }}
          secondaryActions={[{ content: "Cancel", onAction: () => setModalOpen(false) }]}>
          <Modal.Section>
            <BlockStack gap="400">
              <Banner tone="info"><p>Price = Liner Length × Liner Width × Base Price per m²</p></Banner>
              <InlineGrid columns={2} gap="400">
                <TextField label="Base Price per m²" type="number" value={basePrice}
                  onChange={setBasePrice} prefix="£" helpText="e.g. 15.00 = £15 per m²" />
                <Select label="Unit" options={unitOptions} value={unit} onChange={setUnit} />
              </InlineGrid>
              <TextField label="Minimum Price" type="number" value={minPrice}
                onChange={setMinPrice} prefix="£" helpText="Minimum charge regardless of size" />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {toastActive && <Toast content="Saved!" onDismiss={() => setToastActive(false)} />}
      </Page>
    </Frame>
  );
}
