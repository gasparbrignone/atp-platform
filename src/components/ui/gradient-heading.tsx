import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Cult UI ships this with hardcoded Tailwind stock colors (neutral-*,
 * stone-*) — replaced with ATP's own tokens so the gradient always tracks
 * the brand palette and dark mode, never an unrelated stock gray.
 */
const headingVariants = cva('tracking-tight pb-3 bg-clip-text text-transparent', {
  variants: {
    variant: {
      default: 'bg-gradient-to-t from-text to-text-secondary',
      pink: 'bg-gradient-to-t from-primary-fill to-primary-strong',
      light: 'bg-gradient-to-t from-gray-300 to-gray-200',
      secondary: 'bg-gradient-to-t from-secondary-strong to-secondary',
    },
    size: {
      default: 'text-2xl sm:text-3xl lg:text-4xl',
      xxs: 'text-base sm:text-lg lg:text-lg',
      xs: 'text-lg sm:text-xl lg:text-2xl',
      sm: 'text-xl sm:text-2xl lg:text-3xl',
      md: 'text-2xl sm:text-3xl lg:text-4xl',
      lg: 'text-3xl sm:text-4xl lg:text-5xl',
      xl: 'text-4xl sm:text-5xl lg:text-6xl',
      xll: 'text-4xl sm:text-6xl lg:text-[5.4rem]  lg:leading-[0.5rem] ',
      xxl: 'text-5xl sm:text-6xl lg:text-[6rem]',
      xxxl: 'text-5xl sm:text-6xl lg:text-[8rem]',
    },
    weight: {
      default: 'font-bold',
      thin: 'font-thin',
      base: 'font-base',
      semi: 'font-semibold',
      bold: 'font-bold',
      black: 'font-black',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
    weight: 'default',
  },
});

export interface HeadingProps extends VariantProps<typeof headingVariants> {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}

const GradientHeading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ asChild, variant, weight, size, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'h3'; // default to 'h3' if not a child
    return (
      <Comp ref={ref} {...props} className={className}>
        <span className={cn(headingVariants({ variant, size, weight }))}>{children}</span>
      </Comp>
    );
  },
);

GradientHeading.displayName = 'GradientHeading';

// Manually define the variant types
export type Variant = 'default' | 'pink' | 'light' | 'secondary';
export type Size = 'default' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
export type Weight = 'default' | 'thin' | 'base' | 'semi' | 'bold' | 'black';

export { GradientHeading, headingVariants };
