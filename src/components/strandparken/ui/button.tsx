import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sp-pill ' +
  'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 ' +
  '[&_svg]:pointer-events-none [&_svg]:shrink-0';

const textButton = cva(base, {
  variants: {
    variant: {
      primary: 'sp-button min-h-13 bg-sp-primary px-6 text-sp-on-primary active:bg-sp-primary-pressed',
      outline: 'sp-button-sm min-h-sp-target sp-border-strong border-sp-primary bg-transparent px-3.5 text-sp-primary active:bg-sp-track',
      quiet: 'sp-button-sm min-h-sp-target bg-transparent px-2 text-sp-primary active:bg-sp-track',
    },
    inCard: { true: '', false: '' },
  },
  compoundVariants: [{ variant: 'primary', inCard: true, class: 'sp-button-sm min-h-11.5' }],
  defaultVariants: { variant: 'primary', inCard: false },
});

const iconButton = cva(base, {
  variants: {
    tone: {
      ground: 'bg-sp-surface text-sp-ink active:bg-sp-track',
      add: 'bg-sp-primary text-sp-on-primary active:bg-sp-primary-pressed',
    },
    size: { md: 'size-sp-target', lg: 'size-12' },
  },
  defaultVariants: { tone: 'ground', size: 'md' },
});

type Shared = Omit<ComponentProps<'button'>, 'aria-label'> & { asChild?: boolean };

type TextButtonProps = Shared & {
  variant?: 'primary' | 'outline' | 'quiet';
  /** Primary inside a card is 46 px high instead of 52 px. */
  inCard?: boolean;
};

/** An icon-only button must say what it does: the Danish aria-label is required by the type. */
type IconButtonProps = Shared & {
  variant: 'icon';
  'aria-label': string;
  tone?: 'ground' | 'add';
  size?: 'md' | 'lg';
};

export type ButtonProps = TextButtonProps | IconButtonProps;

export function Button(props: ButtonProps) {
  const { asChild = false, className, ...rest } = props;
  const Comp = asChild ? Slot.Root : 'button';
  const typeProp = asChild ? {} : { type: 'button' as const };

  if (rest.variant === 'icon') {
    const { variant: _v, tone, size, ...domProps } = rest;
    return <Comp data-slot="button" data-variant="icon" {...typeProp} className={cn(iconButton({ tone, size }), className)} {...domProps} />;
  }
  const { variant, inCard, ...domProps } = rest;
  return <Comp data-slot="button" data-variant={variant ?? 'primary'} {...typeProp} className={cn(textButton({ variant, inCard }), className)} {...domProps} />;
}
