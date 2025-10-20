import AuthPanel from '@/components/AuthPanel';

export default function LoginPage() {
  return (
    <main className="max-w-lg mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm opacity-80">
        Enter your email to receive a magic link. After signing in, you will be redirected back.
      </p>
      <AuthPanel />
    </main>
  );
}
