import 'dart:async';

import 'package:flutter/material.dart';

import '../models/bike_models.dart';
import '../services/native_bridge.dart';
import '../utils/formatters.dart';
import 'common_widgets.dart';

class RentFormResult {
  const RentFormResult({
    required this.rentedAt,
    required this.repair,
    this.soldierId,
    this.helmetId,
    this.longTerm = false,
  });

  final DateTime rentedAt;
  final bool repair;
  final String? soldierId;
  final String? helmetId;
  final bool longTerm;
}

class RentDialog extends StatefulWidget {
  const RentDialog({
    required this.bike,
    required this.soldiers,
    required this.helmets,
    this.soldierUpdates,
    this.helmetUpdates,
    this.soldierByNfc,
    this.soldierById,
    this.canSubmit = true,
    this.canSubmitUpdates,
    super.key,
  });

  final BicycleAsset bike;
  final List<Soldier> soldiers;
  final List<HelmetAsset> helmets;
  final Stream<List<Soldier>>? soldierUpdates;
  final Stream<List<HelmetAsset>>? helmetUpdates;
  final Future<Soldier?> Function(String nfcCode)? soldierByNfc;
  final Future<Soldier?> Function(String soldierId)? soldierById;
  final bool canSubmit;
  final Stream<bool>? canSubmitUpdates;

  @override
  State<RentDialog> createState() => _RentDialogState();
}

class _RentDialogState extends State<RentDialog> {
  final _form = GlobalKey<FormState>();
  String? _soldierId;
  String? _helmetId;
  Soldier? _scannedSoldier;
  StreamSubscription<String>? _nfcSubscription;
  StreamSubscription<List<Soldier>>? _soldierUpdatesSubscription;
  StreamSubscription<List<HelmetAsset>>? _helmetUpdatesSubscription;
  StreamSubscription<bool>? _canSubmitSubscription;
  bool _acceptingNfcScans = true;
  late bool _canSubmit;
  late List<Soldier> _soldiers;
  late List<HelmetAsset> _helmets;
  String _scanMessage = '';
  bool _repair = false;
  bool _longTerm = false;
  DateTime _rentedAt = DateTime.now();
  int _soldierLookupGeneration = 0;

  @override
  void initState() {
    super.initState();
    _canSubmit = widget.canSubmit;
    _soldiers = widget.soldiers;
    _helmets = widget.helmets;
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
  void didUpdateWidget(covariant RentDialog oldWidget) {
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final formEnabled = _canSubmit;
    return AlertDialog(
      title: Text('Rent ${widget.bike.name}'),
      content: SingleChildScrollView(
        child: Form(
          key: _form,
          child: SizedBox(
            width: 460,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SwitchListTile(
                  value: _repair,
                  onChanged: formEnabled
                      ? (value) => setState(() {
                          _repair = value;
                          if (_repair) {
                            _soldierId = null;
                            _helmetId = null;
                            _scanMessage = '';
                          }
                        })
                      : null,
                  title: const Text('Send to repair'),
                ),
                SearchSelectionField<Soldier>(
                  labelText: 'Soldier',
                  leadingIcon: Icons.badge_outlined,
                  enabled: formEnabled && !_repair,
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
                  validator: _repair ? null : requiredField,
                ),
                const SizedBox(height: 12),
                SearchSelectionField<_HelmetChoice>(
                  labelText: 'Helmet',
                  leadingIcon: Icons.sports_motorsports,
                  enabled: formEnabled && !_repair,
                  options: _helmetChoices,
                  optionsStream: widget.helmetUpdates?.map(
                    (helmets) => _helmetChoicesFrom(
                      helmets.where((helmet) => helmet.isAvailable).toList(),
                    ),
                  ),
                  selectedValue: _selectedHelmetChoice,
                  itemLabel: (choice) => choice.label,
                  itemSubtitle: (choice) => choice.subtitle,
                  onChanged: (choice) => setState(() => _helmetId = choice.id),
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
                SwitchListTile(
                  value: _longTerm,
                  onChanged: !formEnabled || _repair
                      ? null
                      : (value) => setState(() => _longTerm = value),
                  title: const Text('Long-term assignment'),
                ),
                if (_scanMessage.isNotEmpty)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _scanMessage,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
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
                  final valid = _form.currentState?.validate() ?? false;
                  if (!valid) {
                    return;
                  }
                  _stopNfcScans();
                  Navigator.pop(
                    context,
                    RentFormResult(
                      rentedAt: _rentedAt,
                      repair: _repair,
                      soldierId: _repair ? null : _soldierId,
                      helmetId: _repair || _helmetId == '' ? null : _helmetId,
                      longTerm: !_repair && _longTerm,
                    ),
                  );
                }
              : null,
          child: Text(_repair ? 'Mark repair' : 'Rent'),
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
      ...helmets.map(
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
    final availableHelmets = helmets
        .where((helmet) => helmet.isAvailable)
        .toList();
    final selectedId = _helmetId;
    setState(() {
      _helmets = availableHelmets;
      if (selectedId != null &&
          selectedId.isNotEmpty &&
          !_helmets.any((helmet) => helmet.id == selectedId)) {
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

  Future<void> _handleNfcScan(String nfcCode) async {
    if (!mounted || !_acceptingNfcScans || _repair) return;
    if (!_canSubmit) return;
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

    setState(() => _scanMessage = 'No soldier or available helmet found.');
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

class ReturnDialog extends StatefulWidget {
  const ReturnDialog({
    required this.bike,
    this.bikeUpdates,
    this.canReturn = true,
    this.canReturnUpdates,
    super.key,
  });

  final BicycleAsset bike;
  final Stream<List<BicycleAsset>>? bikeUpdates;
  final bool canReturn;
  final Stream<bool>? canReturnUpdates;

  @override
  State<ReturnDialog> createState() => _ReturnDialogState();
}

class _ReturnDialogState extends State<ReturnDialog> {
  DateTime _returnedAt = DateTime.now();
  late BicycleAsset _bike = widget.bike;
  StreamSubscription<List<BicycleAsset>>? _bikeUpdatesSubscription;
  StreamSubscription<bool>? _canReturnSubscription;
  late bool _canReturnPermission;

  @override
  void initState() {
    super.initState();
    _canReturnPermission = widget.canReturn;
    _bikeUpdatesSubscription = widget.bikeUpdates?.listen(_applyBikeUpdates);
    _bindCanReturnUpdates();
  }

  @override
  void didUpdateWidget(covariant ReturnDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.canReturn != oldWidget.canReturn) {
      _canReturnPermission = widget.canReturn;
    }
    if (!identical(widget.canReturnUpdates, oldWidget.canReturnUpdates)) {
      unawaited(_canReturnSubscription?.cancel());
      _bindCanReturnUpdates();
    }
  }

  @override
  void dispose() {
    unawaited(_bikeUpdatesSubscription?.cancel());
    unawaited(_canReturnSubscription?.cancel());
    super.dispose();
  }

  void _bindCanReturnUpdates() {
    _canReturnSubscription = widget.canReturnUpdates?.listen((canReturn) {
      if (mounted) setState(() => _canReturnPermission = canReturn);
    });
  }

  void _applyBikeUpdates(List<BicycleAsset> bikes) {
    if (!mounted) return;
    BicycleAsset? nextBike;
    for (final bike in bikes) {
      if (bike.id == _bike.id) {
        nextBike = bike;
        break;
      }
    }
    final updatedBike = nextBike;
    if (updatedBike == null || !_canReturn(updatedBike)) {
      Navigator.pop(context);
      return;
    }
    setState(() => _bike = updatedBike);
  }

  bool _canReturn(BicycleAsset bike) {
    return switch (bike.status.trim().toLowerCase()) {
      'rented' || 'long_term' || 'late' || 'repair' => true,
      _ => false,
    };
  }

  @override
  Widget build(BuildContext context) {
    final formEnabled = _canReturnPermission;
    return AlertDialog(
      title: const Text('Return bike'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_bike.name, style: Theme.of(context).textTheme.titleMedium),
            Text('Soldier: ${_bike.assignedSoldier ?? '-'}'),
            Text('Helmet: ${_bike.helmetCode ?? '-'}'),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event_available_outlined),
              title: Text(formatDateTime(_returnedAt)),
              subtitle: const Text('Return date'),
              trailing: const Icon(Icons.edit_calendar_outlined),
              enabled: formEnabled,
              onTap: formEnabled ? _pickDateTime : null,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canReturnPermission
              ? () => Navigator.pop(context, _returnedAt)
              : null,
          child: const Text('Return'),
        ),
      ],
    );
  }

  Future<void> _pickDateTime() async {
    if (!_canReturnPermission) return;
    final date = await showDatePicker(
      context: context,
      initialDate: _returnedAt,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_returnedAt),
    );
    if (time == null) return;
    setState(
      () => _returnedAt = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }
}
