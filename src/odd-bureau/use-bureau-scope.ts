import { useNimiAppSession } from '@nimiplatform/kit/auth/app';

/** The access gate mounts each private playground inside one connection. */
export function useBureauScope() {
  const { snapshot } = useNimiAppSession();
  if (snapshot.runtime.status !== 'connected') throw new Error('Nimi App connection is unavailable.');
  return snapshot.runtime.scope;
}
