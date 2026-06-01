import 'package:flutter/material.dart';

class CustomEmojiFeedback extends StatefulWidget {
  final ValueChanged<String> onChanged;
  const CustomEmojiFeedback({super.key, required this.onChanged});

  @override
  State<CustomEmojiFeedback> createState() => _CustomEmojiFeedbackState();
}

class _CustomEmojiFeedbackState extends State<CustomEmojiFeedback> {
  int? selected;

  final List<Map<String, dynamic>> emojis = const [
    {'id': 1, 'emoji': '😞'},
    {'id': 3, 'emoji': '😐'},
    {'id': 5, 'emoji': '😁'},
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: emojis.map((e) {
        final isSelected = e['id'] == selected;

        return GestureDetector(
          onTap: () {
            setState(() => selected = e['id'] as int);
            widget.onChanged(e['emoji'] as String);
          },
          child: AnimatedScale(
            scale: isSelected ? 1.2 : 1.0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                e['emoji'] as String,
                style: const TextStyle(fontSize: 60),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
