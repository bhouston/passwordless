import { Heart } from 'lucide-react';
import { siGithub } from 'simple-icons';

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-card">
      <div className="page-wrap flex flex-col items-center justify-center gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:gap-6">
        <p className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0 text-center">
          Made with <Heart className="inline size-3.5 shrink-0 fill-red-500 text-red-500" aria-hidden /> by{' '}
          <a
            href="https://benhouston3d.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Ben Houston
          </a>
        </p>
        <a
          href="https://github.com/bhouston/passwordless-demo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0" aria-hidden>
            <title>{siGithub.title}</title>
            <path d={siGithub.path} fill="currentColor" />
          </svg>
          <span>See source code</span>
        </a>
      </div>
    </footer>
  );
}
