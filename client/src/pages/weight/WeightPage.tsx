import { format, parseISO } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Weight } from "../../types";
import { ironToday } from "../../utils/date";
import { weightSchema, type WeightFormValues } from "../../schemas/weight";
import { weightTrendPoints } from "../../utils/weightTrend";

export default function WeightPage({ latest, weights, save, remove, defaultUnit = "kg", loading = false, hasMore = false, loadingMore = false, loadMore }: { latest: Weight | undefined; weights: Weight[]; save: (value: WeightFormValues) => Promise<void>; remove: (id: string) => Promise<void>; defaultUnit?: "kg" | "lb"; loading?: boolean; hasMore?: boolean; loadingMore?: boolean; loadMore?: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WeightFormValues>({ resolver: zodResolver(weightSchema), defaultValues: { date: ironToday(), weight: undefined, unit: defaultUnit } });
  const chartData = weightTrendPoints(weights, defaultUnit);
  const axisColor = "hsl(var(--muted-foreground))";
  return <>
    <header><div><h1>Body weight</h1><p>A simple, consistent record of your trend.</p></div></header>
    <section className="latest"><span>Latest weight</span><strong>{loading ? "Loading…" : latest ? `${latest.weight} ${latest.unit}` : "No entries"}</strong></section>
    <form className="weight-form" onSubmit={handleSubmit(async value => { try { await save(value); reset({ date: ironToday(), weight: undefined, unit: defaultUnit }); } catch { /* Error is displayed by the app shell. */ } })}><input {...register("date")} type="date" aria-label="Log date" /><input {...register("weight", { valueAsNumber: true })} type="number" step="0.01" min="0.01" max="1000" placeholder="Weight" aria-label="Weight" /><select {...register("unit")}><option value="kg">kg</option><option value="lb">lb</option></select><button disabled={isSubmitting}>Log weight</button></form>
    {(errors.date || errors.weight) && <p className="field-error">{errors.date?.message ?? errors.weight?.message}</p>}
    <section className="chart-card weight-trend-card" aria-labelledby="weight-trend-title">
      <div className="section-heading"><h2 id="weight-trend-title">Weight trend</h2><span>{defaultUnit}</span></div>
      {loading ? <p className="chart-empty" role="status">Loading weight history…</p> : chartData.length < 2
        ? <p className="chart-empty">{chartData.length === 1 ? "Add one more weigh-in to see your trend." : "Log at least two weigh-ins to see your trend."}</p>
        : <div className="analytics-chart analytics-chart-short weight-trend-chart" role="img" aria-label={`Weight history from ${format(parseISO(chartData[0].date), "MMMM d, yyyy")} to ${format(parseISO(chartData[chartData.length - 1].date), "MMMM d, yyyy")}, in ${defaultUnit}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tickFormatter={date => format(parseISO(date), "MMM d")} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelFormatter={date => format(parseISO(String(date)), "EEEE, MMM d")} formatter={value => [`${Number(value).toFixed(2)} ${defaultUnit}`, "Weight"]} />
              <Line type="monotone" dataKey="weight" name="Weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>}
    </section>
    <section className="weight-list"><h2>History</h2>{weights.map(weight => <div key={weight._id}><span>{weight.date}</span><b>{weight.weight} {weight.unit}</b><button type="button" onClick={() => void remove(weight._id)}>Remove</button></div>)}{!loading && !weights.length && <p>No weight logs yet.</p>}{hasMore && <button type="button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Load older entries"}</button>}</section>
  </>;
}
