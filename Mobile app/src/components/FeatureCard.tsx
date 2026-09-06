import { StyleSheet, Text, View } from 'react-native';
import { deepPurple, ink, lavender, muted } from '../theme/colors';

type FeatureProps = {
  number: string;
  title: string;
  description: string;
};

export default function FeatureCard({ number, title, description }: FeatureProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureNumber}>
        <Text style={styles.featureNumberText}>{number}</Text>
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  featureCard: { flex: 1, minHeight: 192, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E3EC', borderRadius: 17, padding: 21, alignItems: 'flex-end' },
  featureNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: lavender, alignItems: 'center', justifyContent: 'center' },
  featureNumberText: { color: deepPurple, fontSize: 11, fontWeight: '900' },
  featureTitle: { color: ink, fontSize: 18, fontWeight: '900', marginTop: 17, textAlign: 'right', writingDirection: 'rtl' },
  featureDescription: { color: muted, fontSize: 13, lineHeight: 22, marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
});
