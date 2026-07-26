import { useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type PointStyle,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Sentiment, Source, TimeInterval } from "@carma/shared";
import { useAggregate } from "../hooks/useAggregate";

// Register the Chart.js pieces this multi-line chart uses (Legend included:
// ≥2 series always carry a legend).
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

const SENTIMENTS: Sentiment[] = ["positive", "negative", "neutral", "mixed"];
const INTERVALS: TimeInterval[] = ["month", "week"];

// One line per sentiment. Colors match the sentiment badges for consistency, but
// they are NOT load-bearing: the validated concern (positive↔negative collapse
// under red-green CVD) is handled by giving each series a distinct marker shape
// AND dash pattern, plus a labelled legend — so the chart is fully readable in
// grayscale. (Small multiples would be the stricter alternative.)
const SERIES: Record<
  Sentiment,
  { color: string; dash: number[]; point: PointStyle }
> = {
  positive: { color: "#16a34a", dash: [], point: "circle" },
  negative: { color: "#dc2626", dash: [6, 3], point: "rectRot" },
  neutral: { color: "#6b7280", dash: [2, 2], point: "rect" },
  mixed: { color: "#d97706", dash: [8, 3, 2, 3], point: "triangle" },
};

// The overall total (all articles, any sentiment). A distinct hue not used by
// any sentiment + a heavier line + star markers make it read as the aggregate.
const TOTAL = { color: "#2563eb", point: "star" as PointStyle };

const GRID = "rgba(128, 128, 128, 0.18)";
const TICK = "rgba(128, 128, 128, 0.9)";

interface Props {
  sources: Source[];
}

function formatBucket(iso: string, interval: TimeInterval): string {
  const d = new Date(iso);
  return interval === "month"
    ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Article-count-over-time line chart with one line per sentiment (all shown at
 * once). Controls: interval (month/week) and source. Independent of the article
 * list's filters.
 */
export function AggregateChart({ sources }: Props) {
  const [interval, setInterval] = useState<TimeInterval>("week");
  const [sourceId, setSourceId] = useState<number | null>(null);

  const { buckets, loading, error } = useAggregate({ interval, sourceId });

  // Buckets arrive sorted, each carrying the total + all four sentiment counts.
  const data: ChartData<"line"> = {
    labels: buckets.map((b) => formatBucket(b.bucket, interval)),
    datasets: [
      {
        label: "Total",
        data: buckets.map((b) => b.total),
        borderColor: TOTAL.color,
        backgroundColor: TOTAL.color,
        pointStyle: TOTAL.point,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: false,
      },
      ...SENTIMENTS.map((s) => ({
        label: s,
        data: buckets.map((b) => b.bySentiment[s]),
        borderColor: SERIES[s].color,
        backgroundColor: SERIES[s].color,
        borderDash: SERIES[s].dash,
        pointStyle: SERIES[s].point,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
      })),
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, color: TICK, boxWidth: 8 },
      },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { color: GRID }, ticks: { color: TICK } },
      y: {
        beginAtZero: true,
        grid: { color: GRID },
        ticks: { color: TICK, precision: 0 },
      },
    },
  };

  return (
    <section className="chart-card">
      <div className="chart-header">
        <h3>Articles over time by sentiment</h3>
        <div className="chart-controls">
          <div className="interval-toggle" role="group" aria-label="Interval">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                type="button"
                className={interval === iv ? "active" : ""}
                aria-pressed={interval === iv}
                onClick={() => setInterval(iv)}
              >
                {iv === "month" ? "Month" : "Week"}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Source</span>
            <select
              value={sourceId ?? ""}
              onChange={(e) =>
                setSourceId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="chart-canvas" aria-busy={loading}>
        {error ? (
          <p className="error">Failed to load chart: {error}</p>
        ) : buckets.length === 0 && !loading ? (
          <p className="chart-empty">No articles for this selection.</p>
        ) : (
          <Line
            data={data}
            options={options}
            aria-label="Article counts over time by sentiment"
          />
        )}
      </div>
    </section>
  );
}
