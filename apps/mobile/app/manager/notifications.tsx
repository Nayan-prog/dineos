import { NoticeScreen } from '../../lib/notice-list';

export default function Notifications() {
  return <NoticeScreen back="/manager" tableBase="/manager/table" nav="alerts" />;
}
