import Link from 'next/link';
import { Settings } from 'lucide-react';

export function AiSettingsLink() {
  return (
    <Link
      href="/settings/"
      aria-label="AI 设置"
      title="AI 设置"
      className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-amber/40 hover:text-amber"
    >
      <Settings className="h-5 w-5" />
    </Link>
  );
}
