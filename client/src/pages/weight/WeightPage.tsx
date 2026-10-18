import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Weight } from "../../types";
import { ironToday } from "../../utils/date";
import { weightSchema, type WeightFormValues } from "../../schemas/weight";

export default function WeightPage({ latest, weights, save, remove, defaultUnit = "kg" }: { latest: Weight | undefined; weights: Weight[]; save: (value: WeightFormValues) => Promise<void>; remove: (id: string) => Promise<void>; defaultUnit?: "kg" | "lb" }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WeightFormValues>({ resolver: zodResolver(weightSchema), defaultValues: { date: ironToday(), weight: undefined, unit: defaultUnit } });
  return <>
    <header><div><h1>Body weight</h1><p>A simple, consistent record of your trend.</p></div></header>
    <section className="latest"><span>Latest weight</span><strong>{latest ? `${latest.weight} ${latest.unit}` : "No entries"}</strong></section>
    <form className="weight-form" onSubmit={handleSubmit(async value => { try { await save(value); reset({ date: ironToday(), weight: undefined, unit: defaultUnit }); } catch { /* Error is displayed by the app shell. */ } })}><input {...register("date")} type="date" aria-label="Log date" /><input {...register("weight", { valueAsNumber: true })} type="number" step="0.01" min="0.01" max="1000" placeholder="Weight" aria-label="Weight" /><select {...register("unit")}><option value="kg">kg</option><option value="lb">lb</option></select><button disabled={isSubmitting}>Log weight</button></form>
    {(errors.date || errors.weight) && <p className="field-error">{errors.date?.message ?? errors.weight?.message}</p>}
    <section className="weight-list"><h2>History</h2>{weights.map(weight => <div key={weight._id}><span>{weight.date}</span><b>{weight.weight} {weight.unit}</b><button type="button" onClick={() => void remove(weight._id)}>Remove</button></div>)}{!weights.length && <p>No weight logs yet.</p>}</section>
  </>;
}
