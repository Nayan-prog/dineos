import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { ReducedMotionConfig, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, queryClient } from '../lib/api';
import { C, Loading } from '../lib/ui';

export default function Root() {
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();
  const [fonts] = useFonts({ Comfortaa_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => { auth.load().finally(() => setReady(true)); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <StatusBar style="light" />
        {ready && fonts ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: reduce ? 'none' : 'slide_from_right', animationDuration: 250 }}>
          {/* role homes, tab switches and the landing fade; pushed screens slide from the right */}
          {['index', 'welcome', 'waiter/index', 'chef/index', 'manager/index', 'manager/tables', 'manager/team', 'manager/notifications', 'manager/profile', 'manager/orders', 'manager/kitchen', 'manager/billing', 'manager/menu', 'manager/analytics', 'manager/settings', 'waiter/tables', 'waiter/orders', 'waiter/profile', 'waiter/notifications', 'chef/done', 'chef/stock', 'chef/profile', 'chef/notifications'].map((n) => <Stack.Screen key={n} name={n} options={{ animation: reduce ? 'none' : 'fade', animationDuration: 200 }} />)}
        </Stack> : <Loading />}
      </QueryClientProvider>
    </SafeAreaProvider>
    </View>
  );
}
