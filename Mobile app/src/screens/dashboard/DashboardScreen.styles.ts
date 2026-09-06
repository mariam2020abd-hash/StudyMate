import { StyleSheet } from 'react-native';
import { purple, deepPurple, ink, muted, lavender } from '../../theme/colors';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF9FC' },
  container: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 24, gap: 20 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingVertical: 8 },
  brand: { fontSize: 22, fontWeight: '900', color: ink }, brandDot: { color: purple },
  notice: { backgroundColor: lavender, padding: 13, borderRadius: 12 },
  kicker: { color: purple, fontWeight: '700', textAlign: 'right', marginTop: 14 },
  title: { color: ink, fontSize: 36, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: muted, fontSize: 16, textAlign: 'right', lineHeight: 26, writingDirection: 'rtl' },
  row: { flexDirection: 'row-reverse', gap: 16, flexWrap: 'wrap' }, column: { flexDirection: 'column' }, flex: { flex: 1 },
  stat: { flex: 1, minWidth: 160, backgroundColor: '#FFFFFF', padding: 22, borderRadius: 16, gap: 8, borderWidth: 1, borderColor: '#E9E3EC' },
  value: { fontSize: 30, fontWeight: '800', color: deepPurple, textAlign: 'right' },
  small: { fontSize: 13, color: muted, textAlign: 'right', writingDirection: 'rtl', lineHeight: 22 },
  focus: { backgroundColor: '#21152F', padding: 26, borderRadius: 20, flexDirection: 'row-reverse', alignItems: 'stretch', gap: 20 },
  focusLabel: { color: '#C4ACF5', textAlign: 'right', fontSize: 13 }, focusTitle: { color: '#FFFFFF', textAlign: 'right', fontSize: 23, fontWeight: '800', marginVertical: 9 }, focusDescription: { color: '#D9D0E1', textAlign: 'right' },
  primary: { backgroundColor: purple, borderRadius: 11, paddingHorizontal: 20, paddingVertical: 14, alignSelf: 'flex-end' }, primaryText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  secondary: { borderWidth: 1, borderColor: '#D9CCE9', padding: 12, borderRadius: 11 }, secondaryText: { color: deepPurple, fontWeight: '700' },
  sectionHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, heading: { color: ink, fontSize: 22, fontWeight: '800', textAlign: 'right' },
  card: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EC', gap: 14 },
  course: { flexGrow: 1, flexBasis: 260, backgroundColor: '#FFFFFF', padding: 22, borderRadius: 16, borderWidth: 1, borderColor: '#E9E3EC', gap: 14 }, active: { borderColor: purple, backgroundColor: '#F8F4FF' },
  courseIcon: { color: purple, fontSize: 28, textAlign: 'right' }, courseTitle: { color: ink, fontWeight: '800', fontSize: 18, textAlign: 'right' },
  track: { backgroundColor: '#EDE7F3', height: 6, borderRadius: 4, overflow: 'hidden', alignItems: 'flex-end' }, fill: { backgroundColor: purple, height: 6 }, link: { color: '#6D28D9', fontWeight: '700', textAlign: 'right' },
  label: { color: ink, fontWeight: '700', textAlign: 'right' }, input: { borderWidth: 1, borderColor: '#D9D3DE', borderRadius: 10, padding: 13, fontSize: 16, color: ink, textAlign: 'right', writingDirection: 'rtl' },
  error: { color: '#B42318', textAlign: 'right' }, empty: { color: muted, textAlign: 'right', paddingVertical: 20 },
  chapter: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0ECF2' }, chapterTitle: { flex: 1, textAlign: 'right', color: ink, fontSize: 15 }, checkbox: { color: '#81798B', fontSize: 24 }, checked: { color: '#6D28D9' }, disabled: { opacity: 0.45 }, footer: { color: '#81798B', textAlign: 'center', paddingVertical: 24 },
});
