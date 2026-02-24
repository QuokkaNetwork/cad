import App from './src/App.jsx';
import { AppIcon } from './icon.jsx';

export const path = '/cad-fines-victoria';

export default () => ({
  id: 'CAD_FINES_VICTORIA',
  path,
  nameLocale: 'Fines Victoria',
  color: '#1b1300',
  backgroundColor: '#f5c84c',
  icon: AppIcon,
  app: App,
});
