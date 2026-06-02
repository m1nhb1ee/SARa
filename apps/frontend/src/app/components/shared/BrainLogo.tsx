interface Props {
  size?: number;
  color?: string;
  filterId?: string;
  opacity?: number;
}

export function BrainLogo({ size = 48, opacity = 1 }: Props) {
  return (
    <img
      src="/logo.svg"
      alt="SARa logo"
      width={size}
      height={size}
      style={{ opacity, display: 'block', objectFit: 'contain' }}
    />
  );
}
