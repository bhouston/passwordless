import type { FC, ReactNode } from 'react';

export type AuthLayoutProps = {
  title: string;
  subTitle?: string;
  children?: ReactNode;
};

export const AuthLayout: FC<AuthLayoutProps> = ({ title, subTitle, children }) => (
  <div className="flex w-full flex-1 min-h-0 items-center justify-center bg-background p-4">
    <div className="w-full max-w-md">
      <div className="border border-border bg-card p-6">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">{title}</h1>
          {subTitle && <p className="text-muted-foreground">{subTitle}</p>}
        </div>
        {children}
      </div>
    </div>
  </div>
);
