import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { AuthError, authService } from '@/services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setFormError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setEmailError('Email is required.');
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError(undefined);
    setIsSubmitting(true);

    try {
      await authService.forgotPassword(email.trim());
      setSuccessMessage('Reset link sent to your email');
    } catch (error) {
      const message =
        error instanceof AuthError
          ? error.message
          : 'Unable to reach the server. Please try again.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Forgot password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a reset link
            </Text>
          </View>

          <View style={styles.card}>
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!isSubmitting}
              error={emailError}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            {successMessage ? (
              <Text style={styles.successMessage}>{successMessage}</Text>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !isSubmitting ? styles.primaryButtonPressed : null,
                isSubmitting ? styles.primaryButtonDisabled : null,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Link</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Link href={'/(auth)/login' as Href} asChild>
              <Pressable disabled={isSubmitting}>
                <Text style={styles.linkText}>Back to Login</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.mint,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  formError: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
