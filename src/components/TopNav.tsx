import { Search, Bell, ChevronDown, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface TopNavProps {
  onCreateRequest: () => void;
}

export function TopNav({ onCreateRequest }: TopNavProps) {
  const location = useLocation();
  const navItems = [
    { label: 'Биржа', path: '/' },
    { label: 'Аналитика', path: '/analytics' },
    { label: 'Мой профиль', path: '/profile' },
  ];

  return (
    <header className="h-14 border-b border-border bg-card sticky top-0 z-50">
      <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">DH</span>
          </div>
          <span className="font-semibold text-foreground text-[15px]">DormHub</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск заявок, услуг, исполнителей..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Dorm selector */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors shrink-0">
          <span>Общежитие №4</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Create */}
        <button
          onClick={onCreateRequest}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Создать заявку
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors shrink-0">
          <Bell className="w-4.5 h-4.5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
        </button>

        {/* Avatar */}
        <Link to="/profile" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          АМ
        </Link>
      </div>
    </header>
  );
}
