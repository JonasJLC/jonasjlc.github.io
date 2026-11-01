import { cloneElement, useId, type ReactElement } from 'react';
import { Field, FieldDescription, FieldLabel } from '@/components/ferie/ui/field';

/** shadcn Field + label (+ hint) around a single form control. */
export function LabeledField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {cloneElement(children, { id })}
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}
