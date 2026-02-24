import App from './src/App.jsx';
import { AppIcon } from './icon.jsx';

export const path = '/cad-vicroads';

export default () => ({
  id: 'CAD_VICROADS',
  path,
  nameLocale: 'VicRoads',
  color: '#ffffff',
  backgroundColor: '#0a3d91',
  icon: AppIcon,
  app: App,
});
