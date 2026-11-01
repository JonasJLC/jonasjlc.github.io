import { Switch as SW } from 'radix-ui';

export function Switch(props: React.ComponentProps<typeof SW.Root>) {
  return (
    <SW.Root
      className="relative h-7 w-12 shrink-0 rounded-full border bg-muted transition-colors data-[state=checked]:bg-ok"
      {...props}
    >
      <SW.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.35rem]" />
    </SW.Root>
  );
}
