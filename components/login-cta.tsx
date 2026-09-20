import Link from "next/link";

export function LoginCta({ signedIn }: { signedIn: boolean }) {
  if (signedIn) return null;

  return (
    <Link
      href="/login"
      className="flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:self-start"
    >
      Ingresar
    </Link>
  );
}
