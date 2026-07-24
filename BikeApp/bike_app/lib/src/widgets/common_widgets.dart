import 'dart:async';

import 'package:flutter/material.dart';

import '../models/bike_models.dart';
import '../utils/formatters.dart';

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

class MetricCard extends StatelessWidget {
  const MetricCard({required this.label, required this.value, super.key});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 152,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: Theme.of(context).textTheme.labelMedium),
              Text('$value', style: Theme.of(context).textTheme.headlineMedium),
            ],
          ),
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color = switch (normalized) {
      'available' => Colors.green,
      'rented' || 'long_term' => Colors.blue,
      'repair' || 'late' => Colors.orange,
      _ => Colors.grey,
    };
    return Chip(
      label: Text(statusLabel(status)),
      backgroundColor: color.withValues(alpha: 0.12),
      side: BorderSide(color: color.withValues(alpha: 0.2)),
      labelStyle: TextStyle(color: color.shade800, fontWeight: FontWeight.w700),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.black54),
        ),
      ),
    );
  }
}

class HeaderBar extends StatelessWidget {
  const HeaderBar({
    required this.camps,
    required this.selectedCampId,
    required this.summary,
    required this.onCampChanged,
    super.key,
  });

  final List<Camp> camps;
  final String selectedCampId;
  final InventorySummary summary;
  final ValueChanged<String> onCampChanged;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 900;
        Camp? selectedCamp;
        for (final camp in camps) {
          if (camp.id == selectedCampId && camp.canAccess) {
            selectedCamp = camp;
            break;
          }
        }
        final campPicker = SearchSelectionField<Camp>(
          labelText: 'Camp',
          leadingIcon: Icons.location_city_outlined,
          options: camps,
          selectedValue: selectedCamp,
          itemLabel: (camp) => camp.name,
          itemSubtitle: (camp) => camp.id,
          itemEnabled: (camp) => camp.canAccess,
          onChanged: (camp) => onCampChanged(camp.id),
        );
        final metrics = SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children:
                [
                      MetricCard(label: 'Available', value: summary.available),
                      MetricCard(label: 'Rented', value: summary.rented),
                      MetricCard(label: 'Repair', value: summary.repair),
                      MetricCard(label: 'Late', value: summary.late),
                      MetricCard(label: 'Long term', value: summary.longTerm),
                    ]
                    .map(
                      (child) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: child,
                      ),
                    )
                    .toList(),
          ),
        );

        return Padding(
          padding: const EdgeInsets.all(12),
          child: isWide
              ? Row(
                  children: [
                    SizedBox(width: 360, child: campPicker),
                    const SizedBox(width: 12),
                    Expanded(child: metrics),
                  ],
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [campPicker, const SizedBox(height: 12), metrics],
                ),
        );
      },
    );
  }
}

class SummaryBoard extends StatelessWidget {
  const SummaryBoard({required this.summary, super.key});

  final InventorySummary summary;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children:
              [
                    MetricCard(label: 'Available', value: summary.available),
                    MetricCard(label: 'Rented', value: summary.rented),
                    MetricCard(label: 'Repair', value: summary.repair),
                    MetricCard(label: 'Late', value: summary.late),
                    MetricCard(label: 'Long term', value: summary.longTerm),
                  ]
                  .map(
                    (child) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: child,
                    ),
                  )
                  .toList(),
        ),
      ),
    );
  }
}

class SearchSelectionField<T> extends StatelessWidget {
  const SearchSelectionField({
    required this.labelText,
    required this.options,
    required this.selectedValue,
    required this.itemLabel,
    required this.onChanged,
    this.optionsStream,
    this.itemSubtitle,
    this.itemEnabled,
    this.leadingIcon = Icons.search,
    this.enabled = true,
    this.emptyMessage = 'No matches found.',
    this.validator,
    super.key,
  });

  final String labelText;
  final List<T> options;
  final Stream<List<T>>? optionsStream;
  final T? selectedValue;
  final String Function(T item) itemLabel;
  final String? Function(T item)? itemSubtitle;
  final bool Function(T item)? itemEnabled;
  final ValueChanged<T> onChanged;
  final IconData leadingIcon;
  final bool enabled;
  final String emptyMessage;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    final selectedText = selectedValue == null
        ? ''
        : itemLabel(selectedValue as T);
    return TextFormField(
      key: ValueKey('$labelText|$selectedText|$enabled|${validator != null}'),
      readOnly: true,
      enabled: enabled,
      initialValue: selectedText,
      decoration: InputDecoration(
        labelText: labelText,
        prefixIcon: Icon(leadingIcon),
        suffixIcon: const Icon(Icons.search),
      ),
      validator: validator,
      onTap: enabled ? () => _openPicker(context) : null,
    );
  }

  Future<void> _openPicker(BuildContext context) async {
    final selected = await showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _SearchSelectionSheet<T>(
        title: labelText,
        options: options,
        selectedValue: selectedValue,
        itemLabel: itemLabel,
        itemSubtitle: itemSubtitle,
        itemEnabled: itemEnabled,
        optionsStream: optionsStream,
        emptyMessage: emptyMessage,
      ),
    );
    if (selected != null) onChanged(selected);
  }
}

class _SearchSelectionSheet<T> extends StatefulWidget {
  const _SearchSelectionSheet({
    required this.title,
    required this.options,
    required this.selectedValue,
    required this.itemLabel,
    required this.itemSubtitle,
    required this.itemEnabled,
    required this.optionsStream,
    required this.emptyMessage,
  });

  final String title;
  final List<T> options;
  final T? selectedValue;
  final String Function(T item) itemLabel;
  final String? Function(T item)? itemSubtitle;
  final bool Function(T item)? itemEnabled;
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
                        final enabled = widget.itemEnabled?.call(item) ?? true;
                        final subtitle = widget.itemSubtitle?.call(item);
                        return ListTile(
                          enabled: enabled,
                          leading: selected ? const Icon(Icons.check) : null,
                          title: Text(widget.itemLabel(item)),
                          subtitle: subtitle == null || subtitle.isEmpty
                              ? null
                              : Text(subtitle),
                          onTap: enabled
                              ? () => Navigator.pop(context, item)
                              : null,
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

class ListSurface extends StatefulWidget {
  const ListSurface({
    required this.title,
    required this.subtitle,
    required this.child,
    this.topContent,
    this.searchLabel,
    this.search = '',
    this.onSearch,
    this.actionLabel,
    this.onAction,
    this.showHeader = true,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? topContent;
  final String? searchLabel;
  final String search;
  final ValueChanged<String>? onSearch;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool showHeader;

  @override
  State<ListSurface> createState() => _ListSurfaceState();
}

class _ListSurfaceState extends State<ListSurface> {
  late final TextEditingController _searchController = TextEditingController(
    text: widget.search,
  );
  Timer? _searchDebounce;

  @override
  void didUpdateWidget(covariant ListSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.search != _searchController.text) {
      _searchController.text = widget.search;
      _searchController.selection = TextSelection.collapsed(
        offset: _searchController.text.length,
      );
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _scheduleSearch(String value) {
    if (widget.onSearch == null) return;
    _searchDebounce?.cancel();
    _searchDebounce = Timer(
      const Duration(milliseconds: 450),
      () => widget.onSearch!(value),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.topContent != null) ...[
              widget.topContent!,
              const SizedBox(height: 12),
            ],
            if (widget.showHeader || widget.actionLabel != null)
              Wrap(
                spacing: 12,
                runSpacing: 12,
                crossAxisAlignment: WrapCrossAlignment.center,
                alignment: WrapAlignment.spaceBetween,
                children: [
                  if (widget.showHeader)
                    SizedBox(
                      width: 520,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            widget.title,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          Text(
                            widget.subtitle,
                            style: const TextStyle(color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                  if (widget.actionLabel != null)
                    FilledButton.icon(
                      onPressed: widget.onAction,
                      icon: const Icon(Icons.add),
                      label: Text(widget.actionLabel!),
                    ),
                ],
              ),
            if (widget.searchLabel != null) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  labelText: widget.searchLabel,
                  prefixIcon: const Icon(Icons.search),
                ),
                onChanged: _scheduleSearch,
                onSubmitted: widget.onSearch,
              ),
            ],
            const SizedBox(height: 12),
            widget.child,
          ],
        ),
      ),
    );
  }
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String message, {
  String Function()? titleBuilder,
  String Function()? messageBuilder,
  bool canConfirm = true,
  Stream<bool>? canConfirmUpdates,
  Stream<Object?>? contentUpdates,
}) async {
  return await showDialog<bool>(
        context: context,
        builder: (context) => _ConfirmDialog(
          title: title,
          message: message,
          titleBuilder: titleBuilder,
          messageBuilder: messageBuilder,
          canConfirm: canConfirm,
          canConfirmUpdates: canConfirmUpdates,
          contentUpdates: contentUpdates,
        ),
      ) ??
      false;
}

class _ConfirmDialog extends StatefulWidget {
  const _ConfirmDialog({
    required this.title,
    required this.message,
    this.titleBuilder,
    this.messageBuilder,
    required this.canConfirm,
    this.canConfirmUpdates,
    this.contentUpdates,
  });

  final String title;
  final String message;
  final String Function()? titleBuilder;
  final String Function()? messageBuilder;
  final bool canConfirm;
  final Stream<bool>? canConfirmUpdates;
  final Stream<Object?>? contentUpdates;

  @override
  State<_ConfirmDialog> createState() => _ConfirmDialogState();
}

class _ConfirmDialogState extends State<_ConfirmDialog> {
  late bool _canConfirm = widget.canConfirm;
  late String _title = _resolveTitle();
  late String _message = _resolveMessage();
  StreamSubscription<bool>? _canConfirmSubscription;
  StreamSubscription<Object?>? _contentSubscription;

  @override
  void initState() {
    super.initState();
    _bindUpdates();
    _bindContentUpdates();
  }

  @override
  void didUpdateWidget(covariant _ConfirmDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.canConfirm != oldWidget.canConfirm) {
      _canConfirm = widget.canConfirm;
    }
    if (!identical(widget.canConfirmUpdates, oldWidget.canConfirmUpdates)) {
      unawaited(_canConfirmSubscription?.cancel());
      _bindUpdates();
    }
    if (!identical(widget.contentUpdates, oldWidget.contentUpdates) ||
        widget.title != oldWidget.title ||
        widget.message != oldWidget.message ||
        !identical(widget.titleBuilder, oldWidget.titleBuilder) ||
        !identical(widget.messageBuilder, oldWidget.messageBuilder)) {
      unawaited(_contentSubscription?.cancel());
      _refreshContent();
      _bindContentUpdates();
    }
  }

  @override
  void dispose() {
    unawaited(_canConfirmSubscription?.cancel());
    unawaited(_contentSubscription?.cancel());
    super.dispose();
  }

  void _bindUpdates() {
    _canConfirmSubscription = widget.canConfirmUpdates?.listen((canConfirm) {
      if (mounted) setState(() => _canConfirm = canConfirm);
    });
  }

  void _bindContentUpdates() {
    _contentSubscription = widget.contentUpdates?.listen((_) {
      if (mounted) setState(_refreshContent);
    });
  }

  String _resolveTitle() => widget.titleBuilder?.call() ?? widget.title;

  String _resolveMessage() => widget.messageBuilder?.call() ?? widget.message;

  void _refreshContent() {
    _title = _resolveTitle();
    _message = _resolveMessage();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_title),
      content: Text(_message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canConfirm ? () => Navigator.pop(context, true) : null,
          child: const Text('Confirm'),
        ),
      ],
    );
  }
}
