import React from 'react';

interface GridProps {
  size: number; // Grid spacing in data units
  offsetX: number;
  offsetY: number;
  zoom: number;
  width: number;
  height: number;
}

export function Grid({ size, offsetX, offsetY, zoom, width, height }: GridProps) {
  const scaledSize = size * zoom;
  
  return (
    <defs>
      <pattern
        id="grid"
        width={scaledSize}
        height={scaledSize}
        patternUnits="userSpaceOnUse"
        x={offsetX % scaledSize}
        y={offsetY % scaledSize}
      >
        <path
          d={`M ${scaledSize} 0 L 0 0 0 ${scaledSize}`}
          fill="none"
          stroke="#e5e7eb" // gray-200
          strokeWidth={1}
        />
      </pattern>
    </defs>
  );
}
