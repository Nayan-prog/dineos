import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, Outlet, redirect, RouterProvider } from '@tanstack/react-router';
import './styles.css';
import { queryClient, session } from './api';
import { homeFor, Shell, ToastProvider } from './ui';
import { Login, Signup } from './pages/auth/Auth';
import Dashboard from './pages/manager/Dashboard';
import { Kitchen, Orders, StationQueues } from './pages/manager/Service';
import { AddTablePage, TableAddedPage, TableDetail, Tables } from './pages/manager/Tables';
import { NotificationsPage, ProfilePage } from './pages/manager/mobile';
import { ChefProfilePage, StationQueuePage, TicketPage } from './pages/chef/mobile';
import { WaiterBillPage, WaiterOrdersPage, WaiterProfilePage } from './pages/waiter/mobile';
import { Analytics, Billing, Menu, Settings, Shifts, Staff } from './pages/manager/Manage';
import { Alerts, TakeOrder, WaiterHome } from './pages/waiter/Waiter';
import { ChefDone, ChefStock, StationQueue } from './pages/chef/Chef';
import Guest from './pages/guest/Guest';

const TEAM = ['owner', 'manager', 'admin'];
const MONEY = ['owner', 'manager'];
const FLOOR = ['owner', 'manager', 'admin', 'waiter'];

const root = createRootRoute({ component: () => <Outlet /> });
const page = <P extends string>(path: P, roles: string[], C: React.ComponentType) =>
  createRoute({ getParentRoute: () => root, path, component: () => <Shell roles={roles}><C /></Shell> });
const kitchenRoute = createRoute({
  getParentRoute: () => root, path: '/kitchen',
  validateSearch: (s: Record<string, unknown>): { station?: number } => (Number(s.station) > 0 ? { station: Number(s.station) } : {}),
  component: () => <Shell roles={TEAM}><Kitchen /></Shell>,
});

const routes = [
  // keep literal paths so links are type-checked
  createRoute({ getParentRoute: () => root, path: '/', beforeLoad: () => { const s = session.get(); throw redirect({ to: s ? homeFor(s.staff.role) : '/login' }); } }),
  createRoute({ getParentRoute: () => root, path: '/login', component: Login }),
  createRoute({ getParentRoute: () => root, path: '/signup', component: Signup }),
  createRoute({ getParentRoute: () => root, path: '/t/$qr', component: Guest }),
  // owner · manager · admin (admin never receives money fields from the API)
  page('/dashboard', TEAM, Dashboard),
  page('/orders', TEAM, Orders),
  kitchenRoute,
  page('/stations', TEAM, StationQueues),
  page('/tables', TEAM, Tables),
  page('/tables/new', TEAM, AddTablePage),
  page('/tables/added/$id', TEAM, TableAddedPage),
  page('/tables/$id', TEAM, TableDetail),
  page('/notifications', TEAM, NotificationsPage),
  page('/profile', TEAM, ProfilePage),
  page('/menu', TEAM, Menu),
  page('/staff', TEAM, Staff),
  page('/shifts', TEAM, Shifts),
  page('/billing', MONEY, Billing),
  page('/analytics', MONEY, Analytics),
  page('/settings', TEAM, Settings),
  // waiter
  page('/w', ['waiter'], WaiterHome),
  page('/w/tables', ['waiter'], Tables),
  page('/w/table/$id', ['waiter'], TableDetail),
  page('/w/take-order', FLOOR, TakeOrder),
  page('/w/alerts', ['waiter'], Alerts),
  page('/w/orders', ['waiter'], WaiterOrdersPage),
  page('/w/bill/$table', ['waiter'], WaiterBillPage),
  page('/w/profile', ['waiter'], WaiterProfilePage),
  page('/w/notifications', ['waiter'], NotificationsPage),
  // chef
  page('/c', ['chef'], StationQueue),
  page('/c/done', ['chef'], ChefDone),
  page('/c/stock', ['chef'], ChefStock),
  page('/c/station', ['chef'], StationQueuePage),
  page('/c/ticket/$table', ['chef'], TicketPage),
  page('/c/profile', ['chef'], ChefProfilePage),
  page('/c/notifications', ['chef'], NotificationsPage),
] as const;

const router = createRouter({ routeTree: root.addChildren([...routes]), defaultPreload: 'intent' });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider><RouterProvider router={router} /></ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
