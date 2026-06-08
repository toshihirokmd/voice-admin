/**
 * 日別受電数の棒グラフ（SVG ベース・依存ライブラリなし）。
 * server component で使えるよう "use client" は付けない。
 */
import Link from "next/link";

interface Props {
  data: { date: string; count: number }[];
  operatorParam?: string | null;
}

export function DailyCallChart({ data, operatorParam }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">データなし</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 1100;
  const height = 220;
  const padX = 28;
  const padTop = 16;
  const padBottom = 32;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;
  const barGap = 2;
  const barW = (chartW - barGap * (data.length - 1)) / data.length;

  // Y軸目盛り（4 段）
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(Math.round((max * i) / 4));
  }

  // X軸ラベル: 5 日おき + 最終日
  const labelEveryN = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 600 }}
        role="img"
        aria-label="日別受電数の棒グラフ"
      >
        {/* Y軸グリッド */}
        {yTicks.map((tick, i) => {
          const y = padTop + chartH - (chartH * tick) / max;
          return (
            <g key={i}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={padX - 6}
                y={y + 4}
                fontSize={10}
                textAnchor="end"
                fill="#9ca3af"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* 棒 */}
        {data.map((d, i) => {
          const x = padX + i * (barW + barGap);
          const h = (chartH * d.count) / max;
          const y = padTop + chartH - h;
          const day = d.date.slice(-2);
          const showLabel =
            i === data.length - 1 || i === 0 || i % labelEveryN === 0;
          return (
            <g key={d.date}>
              <Link
                href={`/recordings?${new URLSearchParams({
                  start_date: d.date,
                  end_date: d.date,
                  ...(operatorParam ? { operator: operatorParam } : {}),
                }).toString()}`}
              >
                <rect
                  x={x}
                  y={y}
                  width={Math.max(2, barW)}
                  height={Math.max(0, h)}
                  rx={3}
                  fill="#54AF77"
                  className="hover:fill-[#17683B] cursor-pointer transition-colors"
                >
                  <title>{`${d.date}: ${d.count} 件`}</title>
                </rect>
              </Link>
              {/* 値（高めの bar のみ表示） */}
              {d.count > 0 && h > 18 && (
                <text
                  x={x + barW / 2}
                  y={y + 12}
                  fontSize={9}
                  textAnchor="middle"
                  fill="white"
                  fontWeight="bold"
                >
                  {d.count}
                </text>
              )}
              {/* X軸ラベル */}
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={height - padBottom + 14}
                  fontSize={10}
                  textAnchor="middle"
                  fill="#6b7280"
                >
                  {day}
                </text>
              )}
            </g>
          );
        })}

        {/* X軸 */}
        <line
          x1={padX}
          x2={width - padX}
          y1={padTop + chartH}
          y2={padTop + chartH}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
