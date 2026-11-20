import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorMessage: string; }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): State {
    const errorMessage = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    return { hasError: true, errorMessage };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] caught:', error.message, '\n', error.stack, '\n', info.componentStack);
  }

  resetError = () => this.setState({ hasError: false, errorMessage: '' });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Qualcosa è andato storto</Text>
          <Text style={styles.body}>{this.state.errorMessage || 'L\'app ha incontrato un errore inatteso.'}</Text>
          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onBackground,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: '600',
  },
});
