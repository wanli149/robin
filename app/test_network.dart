import 'dart:io';
import 'package:dio/dio.dart';

void main() async {
  print('🔍 Testing network connections...');
  
  final dio = Dio();
  
  final urls = [
    'http://localhost:8787',
    'http://127.0.0.1:8787',
    'http://10.0.2.2:8787',
    'http://192.168.1.4:8787',
  ];
  
  for (final url in urls) {
    try {
      print('\n🌐 Testing: $url');
      final response = await dio.get(
        '$url/',
        options: Options(
          sendTimeout: const Duration(seconds: 3),
          receiveTimeout: const Duration(seconds: 3),
        ),
      );
      
      if (response.statusCode == 200) {
        print('✅ Success: ${response.data}');
      } else {
        print('❌ Failed: Status ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error: $e');
    }
  }
}