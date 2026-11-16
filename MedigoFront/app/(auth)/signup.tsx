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
import { type Href, Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputField } from '@/components/InputField';
import { Colors } from '@/constants/colors';
import { AuthError, authService, type SignupData } from '@/services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s()-]{7,}$/;

type FieldErrors = Partial<
  Record<'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword', string>
>;

function validate(
  fullName: string,
  email: string,
  phone: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!phone.trim()) {
    errors.phone = 'Phone number is required.';
  } else if (!PHONE_REGEX.test(phone.trim())) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export default function SignupScreen() {
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    const errors = validate(fullName, email, phone, password, confirmPassword);
    setFieldErrors(errors);
    setFormError(null);
    setSuccessMessage(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const data: SignupData = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    };

    setIsSubmitting(true);

    try {
      await authService.signup(data);
      setSuccessMessage('Account created! Please log in.');
      setTimeout(() => {
        router.replace('/(auth)/login' as Href);
      }, 900);
    } catch (error) {
      const message =
        error instanceof AuthError
          ? error.message
          : 'Unable to reach the server. Please try again.';
      setFormError(message);
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
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join MediGo to manage your health</Text>
          </View>

          <View style={styles.card}>
            <InputField
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jane Doe"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!isSubmitting}
              error={fieldErrors.fullName}
            />

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
              error={fieldErrors.email}
            />

            <InputField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 000 0000"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!isSubmitting}
              error={fieldErrors.phone}
            />

            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isSubmitting}
              error={fieldErrors.password}
            />

            <InputField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isSubmitting}
              error={fieldErrors.confirmPassword}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            {successMessage ? (
              <Text style={styles.successText}>{successMessage}</Text>
            ) : null}

            <Pressable
              onPress={() => void handleSignup()}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !isSubmitting ? styles.primaryButtonPressed : null,
                isSubmitting ? styles.primaryButtonDisabled : null,
              ]}
            >
              {isSubmitting && !successMessage ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign Up</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href={'/(auth)/login' as Href} asChild>
              <Pressable disabled={isSubmitting}>
                <Text style={styles.linkText}>Login</Text>
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
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
