import {IconName} from './ui/icon.component';
import {MessageKey} from './i18n/messages.en';

/** One section of the app: one address, one entry in the menus. */
export interface NavItem {
  path: string;
  icon: IconName;
  label: MessageKey;
  /** shown only when the server has the feature for this user (open banking) */
  banking?: boolean;
}

/** side bar (desktop), in this order */
export const SIDE_ITEMS: readonly NavItem[] = [
  {path: '/', icon: 'home', label: 'nav.home'},
  {path: '/accounts', icon: 'accounts', label: 'nav.accounts'},
  {path: '/investments', icon: 'investments', label: 'nav.investments'},
  {path: '/plan', icon: 'plan', label: 'nav.plan'},
  {path: '/assets', icon: 'assets', label: 'nav.assets'},
  {path: '/banks', icon: 'bank', label: 'nav.banks', banking: true}
];

/** bottom of the side bar */
export const FOOT_ITEMS: readonly NavItem[] = [
  {path: '/import', icon: 'import', label: 'nav.import'},
  {path: '/settings', icon: 'settings', label: 'nav.settings'}
];

/** bar at the bottom (phone): five entries, the rest under "More" */
export const BOTTOM_ITEMS: readonly NavItem[] = [
  {path: '/', icon: 'home', label: 'nav.home.short'},
  {path: '/accounts', icon: 'accounts', label: 'nav.accounts'},
  {path: '/investments', icon: 'investments', label: 'nav.investments'},
  {path: '/plan', icon: 'plan', label: 'nav.plan'},
  {path: '/more', icon: 'more', label: 'nav.more'}
];

/** what "More" lists: the sections that are not in the bar at the bottom */
export const MORE_ITEMS: readonly NavItem[] = [
  ...SIDE_ITEMS.filter(item => !BOTTOM_ITEMS.some(b => b.path === item.path)),
  ...FOOT_ITEMS
];
