import { NoticeScreen } from '../../lib/notice-list';
import { ChefNav } from '../../lib/chef-ui';

export default function ChefNotifications() {
  return <NoticeScreen back="/chef" tableBase="" bottom={<ChefNav active="alerts" />} />;
}
