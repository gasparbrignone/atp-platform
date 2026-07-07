import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Cult UI ships this with hardcoded Tailwind stock colors (indigo-*, red-*,
 * neutral-*) — replaced with ATP's own tokens: `accent` uses the
 * institutional blue, `destructive` uses --color-error, and every gray is
 * ATP's warm-tinted scale (gray-*) instead of Tailwind's stock neutral.
 */
const buttonVariantsOuter = cva('', {
  variants: {
    variant: {
      primary:
        'w-full border border-[1px] dark:border-[2px] border-black/10 dark:border-black bg-gradient-to-b from-black/70 to-black dark:from-white dark:to-white/80 p-[1px] transition duration-300 ease-in-out ',
      accent:
        'w-full border-[1px] dark:border-[2px] border-black/10 dark:border-gray-900 bg-gradient-to-b from-secondary/90 to-secondary-strong dark:from-secondary/70 dark:to-secondary-strong p-[1px] transition duration-300 ease-in-out ',
      destructive:
        'w-full border-[1px] dark:border-[2px] border-black/10 dark:border-gray-900 bg-gradient-to-b from-error/90 to-error dark:from-error/90 dark:to-error p-[1px] transition duration-300 ease-in-out ',
      secondary:
        'w-full border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-gray-900 dark:bg-gray-600/50 p-[1px] transition duration-300 ease-in-out ',
      minimal:
        'group/texture-button w-full border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-gray-900 dark:bg-gray-600/80 p-[1px] active:bg-gray-200 dark:active:bg-gray-800 hover:bg-gradient-to-t hover:from-gray-100 to-white dark:hover:from-gray-600/50 dark:hover:to-gray-600/70',
      icon: 'group/texture-button rounded-full border dark:border-gray-900 border-black/10 dark:bg-gray-600/50 bg-white/50 p-[1px] active:bg-gray-200 dark:active:bg-gray-800 hover:bg-gradient-to-t hover:from-gray-100 to-white dark:hover:from-gray-700 dark:hover:to-gray-600',
    },
    size: {
      sm: 'rounded-[6px]',
      default: 'rounded-[12px]',
      lg: 'rounded-[12px]',
      icon: 'rounded-full',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
  },
});

const innerDivVariants = cva(
  'w-full h-full flex items-center justify-center text-muted-foreground',
  {
    variants: {
      variant: {
        primary:
          'gap-2 bg-gradient-to-b from-gray-800 to-black  dark:from-gray-200 dark:to-gray-50 text-sm text-white/90 dark:text-black/80 transition duration-300 ease-in-out  hover:from-gray-900 hover:to-gray-800/70 dark:hover:from-gray-100 dark:hover:to-gray-200 dark:active:from-gray-100 dark:active:to-gray-300 active:bg-gradient-to-b active:from-black active:to-black ',
        accent:
          'gap-2 bg-gradient-to-b from-secondary to-secondary-strong text-sm text-white/90 transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-secondary/70 hover:to-secondary-strong/70 dark:hover:from-secondary/70 dark:hover:to-secondary-strong/70 active:bg-gradient-to-b active:from-secondary/80 active:to-secondary-strong/80 dark:active:from-secondary dark:active:to-secondary-strong',
        destructive:
          'gap-2 bg-gradient-to-b from-error/60 to-error text-sm text-white/90 transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-error/70 hover:to-error/90 dark:hover:from-error/70 dark:hover:to-error/80 active:bg-gradient-to-b active:from-error/80 active:to-error dark:active:from-error dark:active:to-error',
        secondary:
          'bg-gradient-to-b from-gray-100/80 to-gray-200/50 dark:from-gray-800 dark:to-gray-700/50 text-sm transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-gray-200/40 hover:to-gray-300/60 dark:hover:from-gray-700 dark:hover:to-gray-700/60 active:bg-gradient-to-b active:from-gray-200/60 active:to-gray-300/70 dark:active:from-gray-800 dark:active:to-gray-700',
        minimal:
          'bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-700/50 text-sm transition duration-300 ease-in-out group-hover/texture-button:bg-gradient-to-b group-hover/texture-button:from-gray-50/50 group-hover/texture-button:to-gray-100/60 dark:group-hover/texture-button:from-gray-700 dark:group-hover/texture-button:to-gray-700/60 group-active/texture-button:bg-gradient-to-b group-active/texture-button:from-gray-100/60 group-active/texture-button:to-gray-100/90 dark:group-active/texture-button:from-gray-800 dark:group-active/texture-button:to-gray-700',
        icon: 'bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-700/50 group-active/texture-button:bg-gray-200 dark:group-active/texture-button:bg-gray-800 rounded-full',
      },
      size: {
        sm: 'text-xs rounded-[4px] px-4 py-1',
        default: 'text-sm rounded-[10px] px-4 py-2',
        lg: 'text-base rounded-[10px] px-4 py-2',
        icon: ' rounded-full p-1',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'minimal' | 'icon';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const TextureButton = React.forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  (
    { children, variant = 'primary', size = 'default', asChild = false, className, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp className={cn(buttonVariantsOuter({ variant, size }), className)} ref={ref} {...props}>
        <div className={cn(innerDivVariants({ variant, size }))}>{children}</div>
      </Comp>
    );
  },
);

TextureButton.displayName = 'TextureButton';

export { TextureButton };

// export default TextureButton
