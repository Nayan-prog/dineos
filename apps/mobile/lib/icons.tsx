import Svg, { Path } from 'react-native-svg';

/** Icon paths copied from the approved designs (24px grid). */
export const ICON = {
  owner: 'M4 18h16M5 18l-1-10 5 4 3-6 3 6 5-4-1 10',
  manager: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  admin: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z',
  staff: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 3-5 7-5s7 1.7 7 5M17 11a2.5 2.5 0 1 0 0-5M18 15c2.5.3 4 1.6 4 4',
  back: 'M19 12H5M11 6l-6 6 6 6',
  chev: 'M9 6l6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0',
  tables: 'M3 9h18M5 9v11M19 9v11M8 9V6h8v3',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  kitchen: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  billing: 'M3 5h18v14H3zM3 10h18M7 15h4',
  menuBook: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 8h6',
  analytics: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
  shifts: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  clock: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9v4l2 2M10 3h4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
};

export function Icon({ d, size = 22, color = '#f2f2f3', sw = 1.75 }: { d: string; size?: number; color?: string; sw?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>;
}
