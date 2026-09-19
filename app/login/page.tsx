import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-3xl uppercase tracking-wide">Ingresar</h1>
      <p className="text-muted-foreground">
        Te mandamos un link de acceso por email. No hay contraseña.
      </p>
      <LoginForm />
    </main>
  );
}
