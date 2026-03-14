import { CATEGORIES } from '@/lib/data';

interface CategoryChipsProps {
  active: string;
  onChange: (id: string) => void;
}

export function CategoryChips({ active, onChange }: CategoryChipsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`chip shrink-0 ${active === cat.id ? 'chip-active' : 'chip-inactive'}`}
        >
          <span className="mr-1.5">{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
