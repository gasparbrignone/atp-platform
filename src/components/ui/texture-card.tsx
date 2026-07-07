import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * Cult UI ships this with hardcoded neutral- and stone- colors — replaced
 * with ATP's own gray- scale (already warm-tinted, see tokens.css) so the
 * bevel effect tracks the brand palette in both themes.
 */
const TextureCardStyled = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-[24px] border border-white/60 dark:border-gray-900/60',
      'bg-gradient-to-b from-gray-100 to-white/70 dark:from-gray-800 dark:to-gray-900',
      className,
    )}
    {...props}
  >
    {/* Nested structure for aesthetic borders */}
    <div className="rounded-[23px] border border-black/10 dark:border-gray-800/80">
      <div className="rounded-[22px] border border-white/50 dark:border-gray-900">
        <div className="rounded-[21px] border border-gray-900/20 dark:border-gray-800/70">
          {/* Inner content wrapper */}
          <div className="text-text-secondary w-full rounded-[20px] border border-white/50 dark:border-gray-700/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  </div>
));

// Allows for global css overrides and theme support - similar to shad cn
const TextureCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'dark:border-border/30 rounded-lg border border-white/60',
        'rounded-[calc(var(--radius))]', // Base radius with fallback
        className,
      )}
      {...props}
    >
      <div className="rounded-[calc(var(--radius)-1px)] border border-black/10 dark:border-gray-800/80">
        <div className="rounded-[calc(var(--radius)-2px)] border border-white/50 dark:border-gray-900">
          <div className="rounded-[calc(var(--radius)-3px)] border border-gray-900/20 dark:border-gray-800/70">
            <div className="text-text-secondary from-card/70 to-secondary/50 w-full rounded-[calc(var(--radius)-4px)] border border-white/50 bg-gradient-to-b dark:border-gray-700/50">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TextureCard.displayName = 'TextureCard';

const TextureCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'first:pt-6 last:pb-6', // Adjust padding for first and last child
        className,
      )}
      {...props}
    />
  ),
);
TextureCardHeader.displayName = 'TextureCardHeader';

const TextureCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-text pl-2 text-lg leading-tight font-semibold', className)}
    {...props}
  />
));
TextureCardTitle.displayName = 'TextureCardTitle';

const TextureCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-text-secondary pl-2 text-sm', className)} {...props} />
));
TextureCardDescription.displayName = 'TextureCardDescription';

const TextureCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
  ),
);
TextureCardContent.displayName = 'TextureCardContent';

const TextureCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-2 px-6 py-4',

        className,
      )}
      {...props}
    />
  ),
);
TextureCardFooter.displayName = 'TextureCardFooter';

const TextureSeparator = () => {
  return (
    <div className="border-t-surface-alt border-b-border border border-r-transparent border-l-transparent" />
  );
};

export {
  TextureCard,
  TextureCardHeader,
  TextureCardStyled,
  TextureCardFooter,
  TextureCardTitle,
  TextureSeparator,
  TextureCardDescription,
  TextureCardContent,
};

export default TextureCard;
