import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500',
  {
    variants: {
      variant: {
        default: 'border-cyan-300 dark:border-cyan-800 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
        cyan: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
        secondary: 'border-slate-300 dark:border-slate-700 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        destructive: 'border-rose-300 dark:border-rose-800 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
        success: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
        warning: 'border-amber-300 dark:border-amber-800 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
        purple: 'border-purple-300 dark:border-purple-800 bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
        outline: 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
