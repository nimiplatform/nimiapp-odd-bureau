import { createRoot } from 'react-dom/client';
import { createWebNimiAppSession, type NimiRemoteAppConfig } from '@nimiplatform/kit/auth/app/web';
import { NimiAppSessionProvider, NimiAppAccessGate, NimiAccountControl } from '@nimiplatform/kit/auth/app';
import { NimiThemeProvider, TooltipProvider, NimiToaster } from '@nimiplatform/kit/ui';
import { AppNavigationProvider } from './shell/routes/app-navigation.js';
import { AuthenticatedShell } from './shell/authenticated-shell.js';
import { language } from './odd-bureau/i18n.js';
import './styles.css';
import './web.css';

declare const __NIMI_APP_WEB_CONFIG__: NimiRemoteAppConfig;
const session = createWebNimiAppSession(__NIMI_APP_WEB_CONFIG__);
const element = document.getElementById('root')!;
element.classList.add('nimi-workbench-host', 'nimi-ui-module--lab');
document.body.classList.add('nimi-ui-module--lab');
const root = createRoot(element);
root.render(<NimiThemeProvider accentPack="nimi-accent"><TooltipProvider>
  <NimiAppSessionProvider session={session}>
    <div className="odd-web-shell">
      <header className="odd-web-account"><NimiAccountControl language={language} hideSignedOut /></header>
      <NimiAppAccessGate title={language === 'zh' ? '奇物局' : 'Odd Bureau'} language={language} externalAccountControl>
        {() => <AppNavigationProvider><AuthenticatedShell /></AppNavigationProvider>}
      </NimiAppAccessGate>
    </div>
  </NimiAppSessionProvider><NimiToaster />
</TooltipProvider></NimiThemeProvider>);
void session.start();
if (import.meta.hot) import.meta.hot.dispose(() => { session.dispose(); root.unmount(); });
