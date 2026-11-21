import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ChefNav } from '../../lib/chef-ui';
import { Pressable } from '../../lib/motion';
import { C, Loading, MgrScreen, Row, T } from '../../lib/ui';

/** Stock (App-Chef-Stock): switch off anything the station can't make. It disappears from waiters and the guest menu straight away. */
export default function ChefStock() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['stock'], queryFn: () => api('/kitchen/stock') });
  const m = useMutation({ mutationFn: ([id, available]: [number, boolean]) => api(`/kitchen/dishes/${id}/stock`, { method: 'PATCH', body: { available } }), onSuccess: () => qc.invalidateQueries() });
  const d = q.data;
  return (
    <MgrScreen base="/chef" gap={18} nav={<ChefNav active="stock" />}>
      <View>
        <T w="700" size={26} style={{ letterSpacing: -0.3 }}>Stock</T>
        <T size={13} color={C.muted} style={{ marginTop: 2 }}>{d ? `${d.station.name} station · turn off anything you can't make` : ' '}</T>
      </View>
      {!d ? <Loading /> : (
        <View>
          {d.dishes.map((x: any, i: number) => (
            <Row key={x.id} i={i} style={{ minHeight: 60 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w="600" color={x.available ? C.text : C.dim}>{x.name}</T>
                <T size={12.5} color={x.available ? C.dim : C.red}>{x.available ? `${x.made} made today` : 'Sold out · hidden from menu'}</T>
              </View>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: x.available }} accessibilityLabel={`${x.name} available`} onPress={() => m.mutate([x.id, !x.available])} style={{ width: 52, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
                <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: x.available ? C.blue2 : '#3a3a40', justifyContent: 'center', alignItems: x.available ? 'flex-end' : 'flex-start' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.text }} />
                </View>
              </Pressable>
            </Row>
          ))}
          {d.dishes.length === 0 && <T color={C.dim}>No dishes on this station</T>}
        </View>
      )}
      <T size={12.5} color={C.dim}>Turning a dish off hides it from waiters and the guest QR menu straight away.</T>
    </MgrScreen>
  );
}
