import 'dart:async';

import 'package:flutter/material.dart';

import '../models/bike_models.dart';
import '../services/native_bridge.dart';
import '../utils/formatters.dart';
import 'common_widgets.dart';

class AssetFormResult {
  const AssetFormResult({
    required this.name,
    required this.nfcCode,
    this.status,
    this.soldierId,
    this.helmetId,
    this.rentedAt,
  });

  final String name;
  final String nfcCode;
  final String? status;
  final String? soldierId;
  final String? helmetId;
  final DateTime? rentedAt;
}

class AssetDialog extends StatefulWidget {
  const AssetDialog({
    required this.title,
    required this.label,
    this.initialName,
    this.initialNfcCode,
    this.assignmentEditable = false,
    this.initialStatus,
    this.initialSoldierId,
    this.initialHelmetId,
    this.initialRentedAt,
    this.soldiers = const [],
    this.helmets = const [],
    this.soldierUpdates,
    this.helmetUpdates,
    this.soldierByNfc,
    this.soldierById,
    this.canSubmit = true,
    this.canSubmitUpdates,
    super.key,
  });

  final String title;
  final String label;
  final String? initialName;
  final String? initialNfcCode;
  final bool assignmentEditable;
  final String? initialStatus;
  final String? initialSoldierId;
  final String? initialHelmetId;
  final DateTime? initialRentedAt;
  final List<Soldier> soldiers;
  final List<HelmetAsset> helmets;
  final Stream<List<Soldier>>? soldierUpdates;
  final Stream<List<HelmetAsset>>? helmetUpdates;
  final Future<Soldier?> Function(String nfcCode)? soldierByNfc;
  final Future<Soldier?> Function(String soldierId)? soldierById;
  final bool canSubmit;
  final Stream<bool>? canSubmitUpdates;

  @override
  State<AssetDialog> createState() => _AssetDialogState();
}

class _AssetDialogState extends State<AssetDialog> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.initialName);
  late final _nfc = TextEditingController(text: widget.initialNfcCode);
  StreamSubscription<String>? _nfcSubscription;
  StreamSubscription<List<Soldier>>? _soldierUpdatesSubscription;
  StreamSubscription<List<HelmetAsset>>? _helmetUpdatesSubscription;
  StreamSubscription<bool>? _canSubmitSubscription;
  bool _acceptingNfcScans = true;
  late bool _canSubmit;
  late String _status;
  String? _soldierId;
  String? _helmetId;
  Soldier? _scannedSoldier;
  late List<Soldier> _soldiers;
  late List<HelmetAsset> _helmets;
  String _scanMessage = '';
  late DateTime _rentedAt;
  int _soldierLookupGeneration = 0;

  @override
  void initState() {
    super.initState();
    _canSubmit = widget.canSubmit;
    _status = _initialEditableStatus;
    _soldierId = widget.initialSoldierId;
    _helmetId = widget.initialHelmetId;
    _soldiers = widget.soldiers;
    _helmets = widget.helmets;
    _rentedAt = widget.initialRentedAt ?? DateTime.now();
    _soldierUpdatesSubscription = widget.soldierUpdates?.listen((soldiers) {
      if (!mounted) return;
      _applySoldierUpdates(soldiers);
    });
    _helmetUpdatesSubscription = widget.helmetUpdates?.listen((helmets) {
      if (!mounted) return;
      _applyHelmetUpdates(helmets);
    });
    _bindCanSubmitUpdates();
    _nfcSubscription = NativeBridge.nfcScans.listen(
      (nfcCode) => unawaited(_handleNfcScan(nfcCode)),
      onError: (_) {},
    );
  }

  @override
  void didUpdateWidget(covariant AssetDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.canSubmit != oldWidget.canSubmit) {
      _canSubmit = widget.canSubmit;
    }
    if (!identical(widget.canSubmitUpdates, oldWidget.canSubmitUpdates)) {
      unawaited(_canSubmitSubscription?.cancel());
      _bindCanSubmitUpdates();
    }
  }

  @override
  void dispose() {
    _stopNfcScans();
    unawaited(_soldierUpdatesSubscription?.cancel());
    unawaited(_helmetUpdatesSubscription?.cancel());
    unawaited(_canSubmitSubscription?.cancel());
    _name.dispose();
    _nfc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final formEnabled = _canSubmit;
    return AlertDialog(
      title: Text(widget.title),
      content: SingleChildScrollView(
        child: Form(
          key: _form,
          child: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _name,
                  enabled: formEnabled,
                  decoration: InputDecoration(labelText: widget.label),
                  validator: requiredField,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _nfc,
                  enabled: formEnabled,
                  decoration: const InputDecoration(labelText: 'NFC code'),
                  validator: requiredField,
                ),
                if (widget.assignmentEditable) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _status,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'rented', child: Text('Rented')),
                      DropdownMenuItem(value: 'repair', child: Text('Repair')),
                      DropdownMenuItem(
                        value: 'long_term',
                        child: Text('Long term'),
                      ),
                    ],
                    onChanged: formEnabled
                        ? (value) {
                      if (value == null) return;
                      setState(() {
                        _status = value;
                        if (_status == 'repair') {
                          _soldierId = null;
                          _helmetId = null;
                        }
                      });
                    }
                        : null,
                  ),
                  const SizedBox(height: 12),
                  SearchSelectionField<Soldier>(
                    labelText: 'Soldier',
                    leadingIcon: Icons.badge_outlined,
                    enabled: formEnabled && _status != 'repair',
                    options: _soldierChoices,
                    optionsStream: widget.soldierUpdates?.map(
                      _soldierChoicesFrom,
                    ),
                    selectedValue: _selectedSoldier,
                    itemLabel: (soldier) => soldier.name,
                    itemSubtitle: (soldier) => soldier.country ?? '',
                    onChanged: (soldier) =>
                        setState(() => _soldierId = soldier.id),
                    emptyMessage: 'No soldiers found.',
                  ),
                  const SizedBox(height: 12),
                  SearchSelectionField<_HelmetChoice>(
                    labelText: 'Helmet',
                    leadingIcon: Icons.sports_motorsports,
                    enabled: formEnabled && _status != 'repair',
                    options: _helmetChoices,
                    optionsStream: widget.helmetUpdates?.map(
                      _helmetChoicesFrom,
                    ),
                    selectedValue: _selectedHelmetChoice,
                    itemLabel: (choice) => choice.label,
                    itemSubtitle: (choice) => choice.subtitle,
                    onChanged: (choice) =>
                        setState(() => _helmetId = choice.id),
                    emptyMessage: 'No helmets found.',
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_outlined),
                    title: Text(formatDateTime(_rentedAt)),
                    subtitle: const Text('Rental date'),
                    trailing: const Icon(Icons.edit_calendar_outlined),
                    enabled: formEnabled,
                    onTap: formEnabled ? _pickDateTime : null,
                  ),
                  if (_scanMessage.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _scanMessage,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            _stopNfcScans();
            Navigator.pop(context);
          },
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canSubmit
              ? () {
                  if (!_form.currentState!.validate()) return;
                  if (widget.assignmentEditable &&
                      _status != 'repair' &&
                      (_soldierId == null || _soldierId!.isEmpty)) {
                    return;
                  }
                  _stopNfcScans();
                  Navigator.pop(
                    context,
                    AssetFormResult(
                      name: _name.text.trim(),
                      nfcCode: _nfc.text.trim(),
                      status: widget.assignmentEditable ? _status : null,
                      soldierId: widget.assignmentEditable
                          ? (_status != 'repair' ? _soldierId : '')
                          : null,
                      helmetId: widget.assignmentEditable
                          ? (_status != 'repair' ? (_helmetId ?? '') : '')
                          : null,
                      rentedAt: widget.assignmentEditable ? _rentedAt : null,
                    ),
                  );
                }
              : null,
          child: const Text('Save'),
        ),
      ],
    );
  }

  void _bindCanSubmitUpdates() {
    _canSubmitSubscription = widget.canSubmitUpdates?.listen((canSubmit) {
      if (mounted) setState(() => _canSubmit = canSubmit);
    });
  }

  void _stopNfcScans() {
    _acceptingNfcScans = false;
    unawaited(_nfcSubscription?.cancel());
    _nfcSubscription = null;
  }

  String get _initialEditableStatus {
    final status = (widget.initialStatus ?? '').toLowerCase();
    if (status == 'repair' || status == 'long_term') return status;
    return 'rented';
  }

  Soldier? get _selectedSoldier {
    for (final soldier in _soldierChoices) {
      if (soldier.id == _soldierId) return soldier;
    }
    return null;
  }

  List<Soldier> get _soldierChoices {
    return _soldierChoicesFrom(_soldiers);
  }

  List<Soldier> _soldierChoicesFrom(List<Soldier> soldiers) {
    if (_scannedSoldier == null ||
        soldiers.any((soldier) => soldier.id == _scannedSoldier!.id)) {
      return soldiers;
    }
    return [_scannedSoldier!, ...soldiers];
  }

  List<_HelmetChoice> get _helmetChoices => _helmetChoicesFrom(_helmets);

  List<_HelmetChoice> _helmetChoicesFrom(List<HelmetAsset> helmets) {
    return [
      const _HelmetChoice(id: '', label: 'No helmet'),
      ...helmets
          .where(
            (helmet) =>
                helmet.isAvailable ||
                helmet.id == (widget.initialHelmetId ?? ''),
          )
          .map(
            (helmet) => _HelmetChoice(
              id: helmet.id,
              label: helmet.code,
              subtitle: helmet.nfcCode,
            ),
          ),
    ];
  }

  _HelmetChoice? get _selectedHelmetChoice {
    for (final choice in _helmetChoices) {
      if (choice.id == (_helmetId ?? '')) return choice;
    }
    return _helmetChoices.first;
  }

  void _applySoldierUpdates(List<Soldier> soldiers) {
    final selectedId = _soldierId;
    final selectedSoldier = _soldierById(_soldierChoices, selectedId);
    final updatedScannedSoldier = _soldierById(soldiers, _scannedSoldier?.id);
    setState(() {
      _soldiers = soldiers;
      if (updatedScannedSoldier != null) {
        _scannedSoldier = updatedScannedSoldier;
      } else if (selectedSoldier != null &&
          selectedId != null &&
          selectedId.isNotEmpty &&
          _soldierById(soldiers, selectedId) == null) {
        _scannedSoldier = selectedSoldier;
      } else if (_scannedSoldier?.id != selectedId) {
        _scannedSoldier = null;
      }
    });
    if (selectedId == null ||
        selectedId.isEmpty ||
        _soldierById(soldiers, selectedId) != null) {
      return;
    }
    unawaited(_refreshSelectedSoldier(selectedId));
  }

  void _applyHelmetUpdates(List<HelmetAsset> helmets) {
    final selectedId = _helmetId;
    setState(() {
      _helmets = helmets;
      if (selectedId != null &&
          selectedId.isNotEmpty &&
          !_canKeepSelectedHelmet(helmets, selectedId)) {
        _helmetId = null;
      }
    });
  }

  Future<void> _refreshSelectedSoldier(String soldierId) async {
    final lookup = widget.soldierById;
    final generation = ++_soldierLookupGeneration;
    Soldier? soldier;
    if (lookup != null) {
      try {
        soldier = await lookup(soldierId);
      } catch (_) {
        soldier = null;
      }
    }
    if (!mounted ||
        generation != _soldierLookupGeneration ||
        _soldierId != soldierId) {
      return;
    }
    setState(() {
      if (soldier == null) {
        _soldierId = null;
        if (_scannedSoldier?.id == soldierId) _scannedSoldier = null;
        return;
      }
      _scannedSoldier = soldier;
    });
  }

  Soldier? _soldierById(List<Soldier> soldiers, String? soldierId) {
    if (soldierId == null || soldierId.isEmpty) return null;
    for (final soldier in soldiers) {
      if (soldier.id == soldierId) return soldier;
    }
    return null;
  }

  bool _canKeepSelectedHelmet(List<HelmetAsset> helmets, String helmetId) {
    for (final helmet in helmets) {
      if (helmet.id == helmetId) {
        return helmet.isAvailable ||
            helmet.id == (widget.initialHelmetId ?? '');
      }
    }
    return false;
  }

  Future<void> _handleNfcScan(String nfcCode) async {
    if (!mounted || !_acceptingNfcScans) return;
    if (!_canSubmit) return;
    if (!widget.assignmentEditable || _status == 'repair') {
      setState(() => _nfc.text = nfcCode);
      return;
    }

    final helmet = _helmetByNfc(nfcCode);
    if (helmet != null) {
      setState(() {
        _helmetId = helmet.id;
        _scanMessage = 'Helmet ${helmet.code} selected.';
      });
      return;
    }

    Soldier? soldier;
    try {
      soldier = await widget.soldierByNfc?.call(nfcCode);
    } catch (_) {
      soldier = null;
    }
    if (!mounted || !_acceptingNfcScans) return;
    if (soldier != null) {
      final matchedSoldier = soldier;
      setState(() {
        _scannedSoldier = matchedSoldier;
        _soldierId = matchedSoldier.id;
        _scanMessage = 'Soldier ${matchedSoldier.name} selected.';
      });
      return;
    }

    setState(() {
      _nfc.text = nfcCode;
      _scanMessage = 'No soldier or available helmet found. NFC code updated.';
    });
  }

  HelmetAsset? _helmetByNfc(String nfcCode) {
    final normalized = nfcCode.trim().toLowerCase();
    for (final helmet in _helmets) {
      if (helmet.nfcCode.trim().toLowerCase() == normalized) return helmet;
    }
    return null;
  }

  Future<void> _pickDateTime() async {
    if (!_canSubmit) return;
    final date = await showDatePicker(
      context: context,
      initialDate: _rentedAt,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_rentedAt),
    );
    if (time == null) return;
    setState(
      () => _rentedAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }
}

class _HelmetChoice {
  const _HelmetChoice({required this.id, required this.label, this.subtitle});

  final String id;
  final String label;
  final String? subtitle;
}
