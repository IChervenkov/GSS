class AuthTokens {
  const AuthTokens({this.accessToken = '', this.refreshToken = ''});

  final String accessToken;
  final String refreshToken;

  bool get hasBoth => accessToken.isNotEmpty && refreshToken.isNotEmpty;
}
