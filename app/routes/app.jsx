import { Outlet, useLoaderData, useRouteError } from "react-router";
import { AppProvider as ShopifyProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <ShopifyProvider isEmbeddedApp apiKey={apiKey}>
      <PolarisProvider i18n={{}}>
        <Outlet />
      </PolarisProvider>
    </ShopifyProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <div style={{ padding: "20px", color: "red" }}>
      <h2>Error</h2>
      <pre>{error?.message || String(error)}</pre>
    </div>
  );
}