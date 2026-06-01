"use client";

interface MiniAreaChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export default function MiniAreaChart({
  data,
  color = "#2563eb",
  width = 600,
  height = 180,
}: MiniAreaChartProps) {
  if (!data.length) return <svg width={width} height={height} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 20) - 10;
    return [x, y] as [number, number];
  });

  const linePath = `M ${points.map((p) => p.join(",")).join(" L ")}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={4}
        fill={color}
        stroke="white"
        strokeWidth={2}
      />
    </svg>
  );
}
