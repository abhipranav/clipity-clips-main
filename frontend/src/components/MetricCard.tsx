import type { ReactElement } from "react";
import { motion } from "framer-motion";
import "./MetricCard.css";

interface MetricCardProps {
  label: string;
  value: number;
  status: "queued" | "running" | "completed" | "failed";
  delay?: number;
}

export function MetricCard({ label, value, status, delay = 0 }: MetricCardProps): ReactElement {
  return (
    <motion.div
      className={`metric-card status-${status}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </motion.div>
  );
}
