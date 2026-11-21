import { NoticeScreen } from '../../lib/notice-list';
import { WaiterNav } from '../../lib/waiter-ui';

export default function WaiterNotifications() {
  return <NoticeScreen back="/waiter" tableBase="/waiter/table" bottom={<WaiterNav active={null} />} />;
}
