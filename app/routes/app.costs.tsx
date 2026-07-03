import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, Link } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

const PACKS = [1, 3, 5];

function gidToId(gid: string) {
  return String(gid || "").split("/").pop() || "";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const supaUrl = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  const H = { apikey: key, Authorization: `Bearer ${key}` };

  const res = await admin.graphql(
    `#graphql
    query {
      products(first: 100) {
        edges { node { title variants(first: 20) { edges { node { id title } } } } }
      }
    }`,
  );
  const data = await res.json();
  const variants: { id: string; label: string }[] = [];
  for (const p of data.data.products.edges) {
    for (const v of p.node.variants.edges) {
      const vt = v.node.title && v.node.title !== "Default Title" ? ` — ${v.node.title}` : "";
      variants.push({ id: gidToId(v.node.id), label: `${p.node.title}${vt}` });
    }
  }

  const costsRes = await fetch(`${supaUrl}/rest/v1/variant_costs?select=variant_id,units,cost_usd`, { headers: H });
  const costsRows = (await costsRes.json()) as { variant_id: string; units: number; cost_usd: number }[];
  const costMap: Record<string, Record<number, number>> = {};
  for (const c of costsRows) {
    costMap[c.variant_id] = costMap[c.variant_id] || {};
    costMap[c.variant_id][c.units] = Number(c.cost_usd);
  }

  return { variants, costMap };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const supaUrl = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  const H = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  };

  const form = await request.formData();
  const rows: any[] = [];
  for (const [k, val] of form.entries()) {
    // formato: c_<variantId>_<units>
    if (!k.startsWith("c_")) continue;
    const [, variantId, unitsStr] = k.split("_");
    const v = String(val).trim();
    if (v === "") continue;
    const cost = parseFloat(v);
    if (isNaN(cost)) continue;
    const title = String(form.get(`t_${variantId}`) || "");
    rows.push({ variant_id: variantId, units: parseInt(unitsStr), cost_usd: cost, product_title: title });
  }

  if (rows.length > 0) {
    await fetch(`${supaUrl}/rest/v1/variant_costs?on_conflict=variant_id,units`, {
      method: "POST",
      headers: H,
      body: JSON.stringify(rows),
    });
  }

  return { ok: true, saved: rows.length };
};

export default function Costs() {
  const { variants, costMap } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  const tableRows = variants.map((v) => [
    v.label,
    ...PACKS.map((u) => (
      <span key={u} style={{ display: "inline-block", width: 90 }}>
        <input
          type="number"
          step="0.01"
          min="0"
          name={`c_${v.id}_${u}`}
          defaultValue={costMap[v.id]?.[u] ?? ""}
          placeholder="USD"
          style={{ width: 80, padding: 6, border: "1px solid #c9cccf", borderRadius: 6 }}
        />
        <input type="hidden" name={`t_${v.id}`} value={v.label} />
      </span>
    )),
  ]);

  return (
    <Page>
      <TitleBar title="Configurar costos (COGS en USD)" />
      <Form method="post">
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="center">
            <Link to="/app">
              <Button>← Volver al dashboard</Button>
            </Link>
            <Button variant="primary" submit loading={saving}>
              Guardar costos
            </Button>
          </InlineStack>

          {actionData?.ok && (
            <Banner tone="success">Guardado. {actionData.saved} costo(s) actualizado(s).</Banner>
          )}

          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Costo por producto y pack (en USD)
              </Text>
              <Text as="p" tone="subdued">
                Pon el costo total de cada pack. Si dejas el pack de 3 o 5 vacío, se
                calcula como (costo de 1 unidad × cantidad). Los packs se detectan por
                la cantidad del pedido.
              </Text>
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                headings={["Producto", "Pack 1", "Pack 3", "Pack 5"]}
                rows={tableRows}
              />
            </BlockStack>
          </Card>

          <InlineStack align="end">
            <Button variant="primary" submit loading={saving}>
              Guardar costos
            </Button>
          </InlineStack>
        </BlockStack>
      </Form>
    </Page>
  );
}
