import 'dart:async';

import 'package:flutter/material.dart';

class CapabilityChip extends StatelessWidget {
  const CapabilityChip({required this.icon, required this.label, super.key});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      side: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
      backgroundColor: Colors.white,
    );
  }
}

class SummaryTile extends StatelessWidget {
  const SummaryTile({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.labelLarge?.copyWith(color: Colors.black54),
                  ),
                ),
                Icon(icon, color: effectiveColor, size: 20),
              ],
            ),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class ListSurface extends StatelessWidget {
  const ListSurface({
    required this.child,
    this.title = '',
    this.subtitle = '',
    this.actionLabel,
    this.onAction,
    this.searchLabel,
    this.search,
    this.onSearch,
    this.showHeader = true,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final String? actionLabel;
  final VoidCallback? onAction;
  final String? searchLabel;
  final String? search;
  final ValueChanged<String>? onSearch;
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showHeader) ...[
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 12,
                runSpacing: 10,
                children: [
                  SizedBox(
                    width: 520,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (title.isNotEmpty)
                          Text(
                            title,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        if (subtitle.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            subtitle,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: Colors.black54),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (actionLabel != null)
                    FilledButton.icon(
                      onPressed: onAction,
                      icon: const Icon(Icons.add_circle_outline),
                      label: Text(actionLabel!),
                    ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            if (searchLabel != null && onSearch != null) ...[
              TextField(
                controller: TextEditingController(text: search ?? '')
                  ..selection = TextSelection.collapsed(
                    offset: (search ?? '').length,
                  ),
                decoration: InputDecoration(
                  labelText: searchLabel,
                  prefixIcon: const Icon(Icons.search),
                ),
                onChanged: onSearch,
              ),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({required this.status, this.label, super.key});

  final String status;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'completed' => const Color(0xff15803d),
      'undiscovered' => const Color(0xff64748b),
      'written_off' => const Color(0xff991b1b),
      'Excellent' => const Color(0xff15803d),
      'Good' => const Color(0xff0f766e),
      'Fair' => const Color(0xffb45309),
      'Poor' => const Color(0xffc2410c),
      'Unacceptable' => const Color(0xff991b1b),
      _ => Theme.of(context).colorScheme.primary,
    };
    return Chip(
      visualDensity: VisualDensity.compact,
      label: Text(label ?? status),
      labelStyle: TextStyle(color: color, fontWeight: FontWeight.w700),
      backgroundColor: color.withValues(alpha: 0.10),
      side: BorderSide(color: color.withValues(alpha: 0.25)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.bodyLarge?.copyWith(color: Colors.black54),
        ),
      ),
    );
  }
}

class SearchSelectionField<T> extends StatefulWidget {
  const SearchSelectionField({
    required this.labelText,
    required this.leadingIcon,
    required this.options,
    required this.selectedValue,
    required this.itemLabel,
    required this.onChanged,
    this.itemSubtitle,
    this.optionsStream,
    this.emptyMessage = 'No results.',
    this.enabled = true,
    this.validator,
    super.key,
  });

  final String labelText;
  final IconData leadingIcon;
  final List<T> options;
  final Stream<List<T>>? optionsStream;
  final T? selectedValue;
  final String Function(T item) itemLabel;
  final String? Function(T item)? itemSubtitle;
  final FutureOr<void> Function(T item) onChanged;
  final String emptyMessage;
  final bool enabled;
  final String? Function(String? value)? validator;

  @override
  State<SearchSelectionField<T>> createState() =>
      _SearchSelectionFieldState<T>();
}

class _SearchSelectionFieldState<T> extends State<SearchSelectionField<T>> {
  late final TextEditingController _controller = TextEditingController(
    text: _selectedText,
  );

  String get _selectedText {
    final selected = widget.selectedValue;
    return selected == null ? '' : widget.itemLabel(selected);
  }

  @override
  void didUpdateWidget(covariant SearchSelectionField<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextText = _selectedText;
    if (_controller.text != nextText) {
      _controller.text = nextText;
      _controller.selection = TextSelection.collapsed(offset: nextText.length);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      readOnly: true,
      enabled: widget.enabled,
      controller: _controller,
      decoration: InputDecoration(
        labelText: widget.labelText,
        prefixIcon: Icon(widget.leadingIcon),
        suffixIcon: const Icon(Icons.search),
      ),
      onTap: widget.enabled ? () => _openPicker(context) : null,
      validator: widget.validator,
    );
  }

  Future<void> _openPicker(BuildContext context) async {
    final selected = await showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _SearchSelectionSheet<T>(
        title: widget.labelText,
        options: widget.options,
        selectedValue: widget.selectedValue,
        itemLabel: widget.itemLabel,
        itemSubtitle: widget.itemSubtitle,
        optionsStream: widget.optionsStream,
        emptyMessage: widget.emptyMessage,
      ),
    );
    if (selected != null) await widget.onChanged(selected);
  }
}

class _SearchSelectionSheet<T> extends StatefulWidget {
  const _SearchSelectionSheet({
    required this.title,
    required this.options,
    required this.selectedValue,
    required this.itemLabel,
    required this.itemSubtitle,
    required this.optionsStream,
    required this.emptyMessage,
  });

  final String title;
  final List<T> options;
  final T? selectedValue;
  final String Function(T item) itemLabel;
  final String? Function(T item)? itemSubtitle;
  final Stream<List<T>>? optionsStream;
  final String emptyMessage;

  @override
  State<_SearchSelectionSheet<T>> createState() =>
      _SearchSelectionSheetState<T>();
}

class _SearchSelectionSheetState<T> extends State<_SearchSelectionSheet<T>> {
  final _controller = TextEditingController();
  StreamSubscription<List<T>>? _optionsSubscription;
  late List<T> _options = widget.options;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _optionsSubscription = widget.optionsStream?.listen((options) {
      if (mounted) setState(() => _options = options);
    });
  }

  @override
  void didUpdateWidget(covariant _SearchSelectionSheet<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(widget.options, oldWidget.options)) {
      _options = widget.options;
    }
    if (!identical(widget.optionsStream, oldWidget.optionsStream)) {
      unawaited(_optionsSubscription?.cancel());
      _optionsSubscription = widget.optionsStream?.listen((options) {
        if (mounted) setState(() => _options = options);
      });
    }
  }

  @override
  void dispose() {
    unawaited(_optionsSubscription?.cancel());
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final matches = query.isEmpty
        ? _options
        : _options.where((item) {
            final subtitle = widget.itemSubtitle?.call(item) ?? '';
            return '${widget.itemLabel(item)} $subtitle'.toLowerCase().contains(
              query,
            );
          }).toList();
    final sheetHeight = MediaQuery.sizeOf(context).height * 0.78;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: sheetHeight,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: TextField(
                controller: _controller,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Search',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            Expanded(
              child: matches.isEmpty
                  ? EmptyState(message: widget.emptyMessage)
                  : ListView.separated(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      itemCount: matches.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final item = matches[index];
                        final selected =
                            identical(item, widget.selectedValue) ||
                            item == widget.selectedValue;
                        final subtitle = widget.itemSubtitle?.call(item);
                        return ListTile(
                          leading: selected ? const Icon(Icons.check) : null,
                          title: Text(widget.itemLabel(item)),
                          subtitle: subtitle == null || subtitle.isEmpty
                              ? null
                              : Text(subtitle),
                          onTap: () => Navigator.pop(context, item),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
