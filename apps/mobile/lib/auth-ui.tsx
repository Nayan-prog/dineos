import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Pressable } from './motion';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ICON, Icon } from './icons';
import { router } from 'expo-router';
import { C, T } from './ui';

export { ICON, Icon } from './icons';

/** Sign-in page frame: 20px side padding, 48px top bar, title block. */
export function AuthPage({ left, right, title, sub, subColor = '#b3b3b3', children, footer }: { left?: ReactNode; right?: ReactNode; title?: string; sub?: string; subColor?: string; children?: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center' }}>{left}<View style={{ flex: 1 }} />{right}</View>
        <View style={{ flex: 1 }}>
          {title ? <T w="700" size={34} color="#f5f5f5" style={{ marginTop: 20, marginBottom: 8, lineHeight: 40, letterSpacing: -0.5 }}>{title}</T> : null}
          {sub ? <T size={15} color={subColor} style={{ lineHeight: 21, marginBottom: 16 }}>{sub}</T> : null}
          {children}
        </View>
        {footer}
      </View>
    </SafeAreaView>
  );
}

export const BackButton = () => (
  <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} accessibilityLabel="Go back" style={{ width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}>
    <Icon d={ICON.back} color="#f5f5f5" sw={1.9} />
  </Pressable>
);

/** Pill button: light fill, dark text (disabled = #232327 / #8b8b93). */
export function PillButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ height: 56, borderRadius: 999, backgroundColor: disabled ? '#232327' : '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}>
      <T w="600" size={16} color={disabled ? '#8b8b93' : C.bg}>{label}</T>
    </Pressable>
  );
}
