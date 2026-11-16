import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
};

const SLIDES: Slide[] = [
  {
    key: 'reminders',
    title: 'Never Miss a Dose',
    description:
      'Smart reminders help you take the right medicine at the right time, every day.',
    icon: 'medical',
    iconBg: Colors.mint,
  },
  {
    key: 'health',
    title: 'Track Your Health',
    description:
      'Log vitals, symptoms, and progress so you always know how your health is trending.',
    icon: 'pulse',
    iconBg: Colors.peach,
  },
  {
    key: 'family',
    title: 'Family & Emergency Care',
    description:
      'Stay connected with family profiles and reach help fast when every second counts.',
    icon: 'people',
    iconBg: Colors.mint,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const goToLogin = () => {
    router.replace('/(auth)/login' as Href);
  };

  const handleNext = () => {
    if (isLastSlide) {
      goToLogin();
      return;
    }

    const nextIndex = activeIndex + 1;
    scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
    setActiveIndex(nextIndex);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={goToLogin} hitSlop={12} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.carousel}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={styles.slide}>
            <View style={[styles.iconArea, { backgroundColor: slide.iconBg }]}>
              <Ionicons name={slide.icon} size={72} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{isLastSlide ? 'Get Started' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconArea: {
    width: 220,
    height: 220,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dotInactive,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
});
