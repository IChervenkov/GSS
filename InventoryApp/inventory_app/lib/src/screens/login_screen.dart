import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../services/inventory_api_client.dart';
import '../utils/formatters.dart';
import '../widgets/common_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    required this.api,
    required this.onAuthenticated,
    super.key,
  });

  final InventoryApiClient api;
  final VoidCallback onAuthenticated;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _loading = false;
  String? _message;
  String? _pendingUsername;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _continueToCode() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _message = 'Checking credentials...';
    });
    try {
      final username = _username.text.trim();
      await widget.api.checkLogin(username: username, password: _password.text);
      await widget.api.prepareTwoFactor(username);
      setState(() {
        _pendingUsername = username;
        _message =
            'Enter the 6-digit code from the configured authenticator app.';
      });
    } catch (error) {
      setState(() => _message = errorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyDevice() async {
    final username = _pendingUsername;
    final code = _code.text.trim();
    if (username == null || !RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _message = 'Enter the 6-digit authenticator code.');
      return;
    }
    setState(() {
      _loading = true;
      _message = 'Verifying device...';
    });
    try {
      await widget.api.verifyDevice(username: username, code: code);
      widget.onAuthenticated();
    } catch (error) {
      setState(() => _message = errorMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 840;
    final content = compact
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _brandPanel(context, compact),
              const SizedBox(height: 20),
              _card(context),
            ],
          )
        : Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(flex: 6, child: _brandPanel(context, compact)),
              const SizedBox(width: 28),
              Expanded(flex: 4, child: _card(context)),
            ],
          );

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1120),
              child: content,
            ),
          ),
        ),
      ),
    );
  }

  Widget _brandPanel(BuildContext context, bool compact) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.inventory_2_outlined,
          size: 52,
          color: Color(0xff1d4ed8),
        ),
        const SizedBox(height: 18),
        Text(
          AppConfig.appName,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          'Asset inventory operations',
          style: compact
              ? Theme.of(context).textTheme.displaySmall
              : Theme.of(context).textTheme.displayLarge,
        ),
        const SizedBox(height: 14),
        Text(
          'Track assets, room inventory, RFID lookup, location coverage, JWT sessions, 2FA, logout, realtime updates, and Android app updates from one mobile console.',
          style: Theme.of(
            context,
          ).textTheme.bodyLarge?.copyWith(color: Colors.black54, height: 1.55),
        ),
        const SizedBox(height: 18),
        const Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            CapabilityChip(icon: Icons.key_outlined, label: 'JWT'),
            CapabilityChip(icon: Icons.security_outlined, label: '2FA'),
            CapabilityChip(icon: Icons.sync_outlined, label: 'Realtime'),
            CapabilityChip(icon: Icons.sensors_outlined, label: 'RFID'),
          ],
        ),
      ],
    );
  }

  Widget _card(BuildContext context) {
    final isCodeStep = _pendingUsername != null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: isCodeStep ? _codeForm(context) : _loginForm(context),
        ),
      ),
    );
  }

  Widget _loginForm(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        key: const ValueKey('login-form'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Secure entry', style: Theme.of(context).textTheme.labelLarge),
          Text('Sign in', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 18),
          TextFormField(
            controller: _username,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            decoration: const InputDecoration(
              labelText: 'Username',
              prefixIcon: Icon(Icons.person_outline),
            ),
            validator: (value) => value == null || value.trim().isEmpty
                ? 'Username is required.'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(
              labelText: 'Password',
              prefixIcon: Icon(Icons.lock_outline),
            ),
            validator: (value) =>
                value == null || value.isEmpty ? 'Password is required.' : null,
            onFieldSubmitted: (_) => _continueToCode(),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _loading ? null : _continueToCode,
            icon: _loading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.arrow_forward),
            label: const Text('Continue'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!),
          ],
        ],
      ),
    );
  }

  Widget _codeForm(BuildContext context) {
    return Column(
      key: const ValueKey('code-form'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Second factor', style: Theme.of(context).textTheme.labelLarge),
        Text(
          'Verify device',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 12),
        const Text(
          'Use the authenticator app already configured for this account.',
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _code,
          keyboardType: TextInputType.number,
          maxLength: 6,
          autofillHints: const [AutofillHints.oneTimeCode],
          decoration: const InputDecoration(
            labelText: '6-digit code',
            counterText: '',
            prefixIcon: Icon(Icons.pin_outlined),
          ),
          onSubmitted: (_) => _verifyDevice(),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _loading ? null : _verifyDevice,
          icon: _loading
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.verified_user_outlined),
          label: const Text('Verify and open app'),
        ),
        TextButton(
          onPressed: _loading
              ? null
              : () => setState(() {
                  _pendingUsername = null;
                  _message = null;
                  _code.clear();
                }),
          child: const Text('Back to login'),
        ),
        if (_message != null) Text(_message!),
      ],
    );
  }
}
