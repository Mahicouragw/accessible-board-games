import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Accessible Board Games — 19 TalkBack-friendly games wrapped for Android.
/// Loads the live web app, so new games, sounds and music arrive instantly.
const String kAppUrl = 'https://accessible-board-games.vercel.app';
const Color kBg = Color(0xFF0E1512);

void main() => runApp(const BoardGamesApp());

class BoardGamesApp extends StatelessWidget {
  const BoardGamesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Accessible Board Games',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF00C853),
        scaffoldBackgroundColor: kBg,
      ),
      home: const HubScreen(),
    );
  }
}

class HubScreen extends StatefulWidget {
  const HubScreen({super.key});

  @override
  State<HubScreen> createState() => _HubScreenState();
}

class _HubScreenState extends State<HubScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kBg)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() {
            _loading = true;
            _error = null;
          }),
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (WebResourceError e) {
            if (e.isForMainFrame ?? false) {
              setState(() {
                _loading = false;
                _error = 'Could not load the games (error ${e.errorCode}).\n'
                    'Check your internet connection and tap Retry.';
              });
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(kAppUrl));
  }

  void _reload() {
    setState(() {
      _error = null;
      _loading = true;
    });
    _controller.reload();
  }

  Future<void> _goBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (!didPop) _goBack();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Accessible Board Games 🎲'),
          actions: [
            IconButton(
              tooltip: 'Reload games',
              icon: const Icon(Icons.refresh),
              onPressed: _reload,
            ),
          ],
        ),
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_loading)
                const Align(
                  alignment: Alignment.topCenter,
                  child: LinearProgressIndicator(minHeight: 4),
                ),
              if (_error != null)
                Positioned.fill(
                  child: ColoredBox(
                    color: kBg,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.wifi_off, size: 48),
                            const SizedBox(height: 12),
                            Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(height: 1.5),
                            ),
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: _reload,
                              icon: const Icon(Icons.refresh),
                              label: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
