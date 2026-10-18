import type { ReactNode } from "react";

export default function MetricCard({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return <section><span>{icon}</span><strong>{value}</strong><small>{label}</small></section>;
}
