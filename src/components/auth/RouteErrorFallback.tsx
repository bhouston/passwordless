import type { ErrorComponentProps } from '@tanstack/react-router';
import type { FC } from 'react';
import { InvalidLink } from '@/components/auth/InvalidLink';

function errorMessage(error: ErrorComponentProps['error']): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred.';
}

/**
 * Global route error UI: shows the thrown error message and a path back to login.
 */
export const RouteErrorFallback: FC<ErrorComponentProps> = ({ error }) => {
  return <InvalidLink message={errorMessage(error)} title="Something went wrong" />;
};
