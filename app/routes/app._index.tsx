import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Text,
  Card,
  BlockStack,
  InlineGrid,
  InlineStack,
  Badge,
  Button,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

type PnlRow = {
  day: string;
  num_orders: number;
  revenue_usd: number;
  cogs_usd: number;
  ad_spend_usd: number;
  net_profit_usd: number;
  net_margin_pct: number;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  let rows: PnlRow[] = [];
  let error: string | null = null;

  if (!url || !key) {
    error = "Faltan SUPABASE_URL / SUPABASE_ANON_KEY.";
  } else {
    try {
      const res = await fetch(
        `${url}/rest/v1/pnl_daily?select=*&order=day.desc&limit=30`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) error = `Supabase respondió ${res.status}`;
      else rows = (await res.json()) as PnlRow[];
    } catch (e) {
      error = `No se pudo conectar con Supabase: ${(e as Error).message}`;
    }
  }

  return { rows, error };
};

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n) || 0,
  );

function NetProfitChart({ rows }: { rows: PnlRow[] }) {
  const data = [...rows].reverse();
  if (data.length === 0) return null;
  const W = 720;
  const H = 180;
  const pad = 24;
  const vals = data.map((r) => Number(r.net_profit_usd) || 0);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const range = max - min || 1;
  const bw = (W - pad * 2) / data.length;
  const y0 = H - pad - ((0 - min) / range) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Beneficio neto por día (USD)">
      <line x1={pad} y1={y0} x2={W - pad} y2={y0} stroke="#c9cccf" strokeWidth="1" />
      {data.map((r, i) => {
        const v = Number(r.net_profit_usd) || 0;
        const h = (Math.abs(v) / range) * (H - pad * 2);
        const x = pad + i * bw + bw * 0.15;
        const y = v >= 0 ? y0 - h : y0;
        const fill = v >= 0 ? "#2c6ecb" : "#d72c0d";
        return (
          <rect key={i} x={x} y={y} width={bw * 0.7} height={Math.max(1, h)} fill={fill} rx="2">
            <title>{`${r.day}: ${usd(v)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const { rows, error } = useLoaderData<typeof loader>();

  const totals = rows.reduce(
    (a, r) => ({
      revenue: a.revenue + Number(r.revenue_usd || 0),
      net: a.net + Number(r.net_profit_usd || 0),
      ads: a.ads + Number(r.ad_spend_usd || 0),
      cogs: a.cogs + Number(r.cogs_usd || 0),
      orders: a.orders + Number(r.num_orders || 0),
    }),
    { revenue: 0, net: 0, ads: 0, cogs: 0, orders: 0 },
  );
  const margin = totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : 0;

  const tableRows = rows.map((r) => [
    r.day,
    String(r.num_orders),
    usd(Number(r.revenue_usd)),
    usd(Number(r.cogs_usd)),
    usd(Number(r.ad_spend_usd)),
    usd(Number(r.net_profit_usd)),
    `${Number(r.net_margin_pct).toFixed(1)}%`,
  ]);

  return (
    <Page>
      <TitleBar title="TrueProfit Copia — P&L en USD" />
      <BlockStack gap="500">
        <InlineStack align="end">
          <Link to="/app/costs">
            <Button variant="primary">Configurar costos (COGS)</Button>
          </Link>
        </InlineStack>

        {error && (
          <Card>
            <Text as="p" tone="critical">
              {error}
            </Text>
          </Card>
        )}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 5 }} gap="400">
          <KpiCard label="Ingresos (30d)" value={usd(totals.revenue)} />
          <KpiCard
            label="Beneficio neto (30d)"
            value={usd(totals.net)}
            tone={totals.net >= 0 ? "success" : "critical"}
          />
          <KpiCard label="Margen neto" value={`${margin.toFixed(1)}%`} />
          <KpiCard label="Gasto en ads (30d)" value={usd(totals.ads)} />
          <KpiCard label="Pedidos (30d)" value={String(totals.orders)} />
        </InlineGrid>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Beneficio neto por día (USD)
            </Text>
            <NetProfitChart rows={rows} />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Detalle diario
            </Text>
            {rows.length === 0 ? (
              <Text as="p" tone="subdued">
                Aún no hay datos.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric"]}
                headings={["Día", "Pedidos", "Ingresos", "COGS", "Ads", "Beneficio neto", "Margen"]}
                rows={tableRows}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "critical";
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="span" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="headingLg">
            {value}
          </Text>
          {tone && <Badge tone={tone}>{tone === "success" ? "Positivo" : "Negativo"}</Badge>}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
