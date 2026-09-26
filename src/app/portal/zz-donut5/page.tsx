import { SoftCard } from "@/components/studio/chrome";
import { MoneyDonut, MONEY_COLORS } from "@/components/studio/money-donut";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { s = "neumorphic", t = "cloud" } = await searchParams;
  const slices = [
    { key: "collected", label: "Collected · $5,750.00", value: 5750, color: MONEY_COLORS.collected },
    { key: "due", label: "Due · $2,010.00", value: 2010, color: MONEY_COLORS.due },
    { key: "remaining", label: "Unbilled · $7,990.00", value: 7990, color: MONEY_COLORS.remaining },
  ];
  return (
    <div data-theme={t} data-surface="tinted" data-shape="balanced" data-style={s} className="lane-app min-h-dvh p-8 text-foreground">
      <div className="flex gap-6">
        <SoftCard className="w-[30rem] p-6">
          <MoneyDonut size="lg" centerLabel="Booked" centerValue="$15,750.00" slices={slices} />
        </SoftCard>
        <SoftCard className="w-72 p-6">
          <MoneyDonut size="md" centerLabel="Booked" centerValue="$15,750.00" slices={slices} showLegend={false} />
        </SoftCard>
      </div>
    </div>
  );
}
