import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import type { ReactNode } from 'react';

export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf9fc' }, page: { padding: 22, gap: 18, paddingBottom: 50 },
  title: { color: '#20152c', fontSize: 27, fontWeight: '700', textAlign: 'right' },
  text: { color: '#655d6c', fontSize: 15, lineHeight: 25, textAlign: 'right' },
  heading: { color: '#20152c', fontSize: 20, fontWeight: '700', textAlign: 'right' },
  card: { padding: 18, gap: 14, borderRadius: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#e6dfed' },
  row: { flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  input: { backgroundColor: 'white', color: '#20152c', borderWidth: 1, borderColor: '#d9d1e2', borderRadius: 10, padding: 13, fontSize: 16, textAlign: 'right' },
  button: { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, minHeight: 46, alignItems: 'center' },
  secondary: { backgroundColor: '#efe8fb' }, buttonText: { color: 'white', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  secondaryText: { color: '#5b21b6' }, error: { color: '#a3231b', fontSize: 15, textAlign: 'right', lineHeight: 24 },
});
export function Button({ title, onPress, disabled, secondary }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={[ui.button, secondary && ui.secondary, disabled && { opacity: .45 }]}><Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={ui.text}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#81798b" {...props} style={[ui.input, props.style]} /></View>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={ui.card}>{children}</View>; }
