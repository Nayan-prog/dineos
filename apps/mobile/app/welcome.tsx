import { View } from 'react-native';
import { Pressable } from '../lib/motion';
import { router } from 'expo-router';
import { AuthPage, ICON, Icon } from '../lib/auth-ui';
import { C, T } from '../lib/ui';

const ROLES: [label: string, icon: string, role?: string][] = [['Owner', ICON.owner, 'owner'], ['Manager', ICON.manager, 'manager'], ['Admin', ICON.admin, 'admin'], ['Staff', ICON.staff]];

/** Choose role: Owner / Manager / Admin use email + password, Staff uses phone + PIN. */
export default function Welcome() {
  return (
    <AuthPage
      left={<T brand size={20} color="#f5f5f5">DineOS</T>}
      title="Sign in" sub="Spice Garden · FC Road, Pune" subColor={C.blue}
      footer={<Pressable onPress={() => router.push('/signup')}><T size={14} color="#b3b3b3" style={{ textAlign: 'center' }}>New restaurant? <T w="700" size={14} color="#f5f5f5">Create account</T></T></Pressable>}>
      <View style={{ marginTop: 20 }}>
        {ROLES.map(([label, icon, role]) => (
          <Pressable key={label} onPress={() => (role ? router.push({ pathname: '/login-email', params: { role } }) : router.push('/login-pin'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1c1c20' }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#232327', alignItems: 'center', justifyContent: 'center' }}><Icon d={icon} color="#f5f5f5" /></View>
            <T w="600" size={16} color="#f5f5f5" style={{ flex: 1 }}>{label}</T>
            <Icon d={ICON.chev} size={18} color="#8b8b93" sw={1.9} />
          </Pressable>
        ))}
      </View>
    </AuthPage>
  );
}
