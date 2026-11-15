import { AppShell } from './shell/AppShell';
import { AuthGate } from './shell/AuthGate';
import { signedInPerson } from './lib/fixtures';
import { useAuth } from './lib/use-auth';

export default function StrandparkenApp() {
  const auth = useAuth();
  return (
    <AuthGate state={auth}>
      <AppShell person={auth.status === 'ready' ? auth.person : signedInPerson} householdId={auth.status === 'ready' ? auth.householdId : null} />
    </AuthGate>
  );
}
