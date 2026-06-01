import 'package:dio/dio.dart';
import 'package:internet_connection_checker/internet_connection_checker.dart';
import 'package:fitness_app/interseptor.dart';

class ApiService {
  static final Dio dio = Dio();
  static final InternetConnectionChecker connectionChecker =
      InternetConnectionChecker.createInstance();
  static late JwtInterceptor interceptor;

  static void init() {
    interceptor = JwtInterceptor(dio);
    if (!dio.interceptors.any((i) => i is JwtInterceptor)) {
      dio.interceptors.add(interceptor);
    }
  }

  static Future<bool> hasInternet() async =>
      await connectionChecker.hasConnection;
}
