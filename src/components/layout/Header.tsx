import { getRouteApi, Link } from '@tanstack/react-router';

const rootRouteApi = getRouteApi('__root__');

export function Header() {
  const { sessionUser } = rootRouteApi.useRouteContext();

  return (
    <header className="border-b border-border bg-card">
      <nav className="page-wrap flex h-16 items-center justify-between py-0" aria-label="Main">
        <Link to="/" className="text-lg font-semibold text-foreground no-underline hover:text-foreground">
          Passwordless Demo
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          {!sessionUser && (
            <>
              <Link
                to="/signup"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Login
              </Link>
            </>
          )}
          {sessionUser && (
            <>
              <Link
                to="/user-settings"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                User Settings
              </Link>
              <Link
                to="/logout"
                className="text-muted-foreground no-underline transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Log Out
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
