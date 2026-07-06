function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="size-3 shrink-0 border"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

export { ColorDot };
