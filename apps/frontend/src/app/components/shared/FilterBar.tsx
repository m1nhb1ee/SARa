import { filterButtonStyle } from '@/constants/styles';

interface FilterGroup {
  label: string;
  options: string[];
  active: string;
  onChange: (value: string) => void;
}

interface Props {
  groups: FilterGroup[];
}

export function FilterBar({ groups }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
      {groups.map((group) => (
        <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--ink-secondary)', fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{group.label}:</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {group.options.map((opt) => (
              <button
                key={opt}
                onClick={() => group.onChange(opt)}
                style={filterButtonStyle(group.active === opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
