/**
 * Empty state component with actionable guidance
 */

import { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export function EmptyState({
  icon: Icon = AlertCircle,
  title,
  description,
  action,
  actionLabel = 'Erstellen',
  children
}: {
  icon?: any;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-12 text-center">
      <Icon className="mx-auto h-12 w-12 text-ash mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
      <p className="text-sm text-ash max-w-sm mx-auto mb-6">{description}</p>
      {action && (
        <button
          onClick={action}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}

export function ErrorEmptyState({ title = 'Fehler beim Laden', description = 'Die Daten konnten nicht geladen werden.', retry }: { title?: string; description?: string; retry?: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={retry}
      actionLabel="Erneut versuchen"
    />
  );
}

export function NoResultsEmptyState({ title = 'Keine Ergebnisse', description = 'Es wurden keine passenden Einträge gefunden.' }: { title?: string; description?: string }) {
  return <EmptyState icon={AlertCircle} title={title} description={description} />;
}
