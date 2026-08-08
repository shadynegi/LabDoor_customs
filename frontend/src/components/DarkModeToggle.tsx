import { Sun, Moon } from 'lucide-react';

interface DarkModeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
}

export default function DarkModeToggle({ theme, onToggle, className }: DarkModeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-surface)',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
