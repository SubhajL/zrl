import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiKeyAuthGuard, JwtAuthGuard } from './auth.guards';
import { AuthService } from './auth.service';
import type {
  AuthForgotPasswordInput,
  AuthLoginInput,
  AuthMfaEnrollmentConfirmationInput,
  AuthMfaVerificationInput,
  AuthPrincipalRequest,
  AuthRefreshInput,
  AuthResetPasswordInput,
} from './auth.types';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  async login(@Body() body: AuthLoginInput) {
    return await this.authService.login(body);
  }

  @Post('auth/mfa/verify')
  async verifyMfa(@Body() body: AuthMfaVerificationInput) {
    return await this.authService.verifyMfa(body);
  }

  @Post('auth/mfa/enroll')
  @UseGuards(JwtAuthGuard)
  async startMfaEnrollment(@Req() request: AuthPrincipalRequest) {
    return await this.authService.startMfaEnrollment(request.user!.id);
  }

  @Post('users/me/mfa/enable')
  @UseGuards(JwtAuthGuard)
  async startMfaEnrollmentForCurrentUser(@Req() request: AuthPrincipalRequest) {
    return await this.authService.startMfaEnrollment(request.user!.id);
  }

  @Post('auth/mfa/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmMfaEnrollment(
    @Req() request: AuthPrincipalRequest,
    @Body() body: AuthMfaEnrollmentConfirmationInput,
  ) {
    return await this.authService.confirmMfaEnrollment(body, request.user!.id);
  }

  @Post('users/me/mfa/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmMfaEnrollmentForCurrentUser(
    @Req() request: AuthPrincipalRequest,
    @Body() body: AuthMfaEnrollmentConfirmationInput,
  ) {
    return await this.authService.confirmMfaEnrollment(body, request.user!.id);
  }

  @Post('auth/refresh')
  async refresh(@Body() body: AuthRefreshInput) {
    return await this.authService.refresh(body);
  }

  @Post('auth/forgot-password')
  async forgotPassword(@Body() body: AuthForgotPasswordInput) {
    return await this.authService.forgotPassword(body);
  }

  @Post('auth/reset-password')
  async resetPassword(@Body() body: AuthResetPasswordInput) {
    return await this.authService.resetPassword(body);
  }

  @Post('auth/logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() request: AuthPrincipalRequest) {
    return await this.authService.logout(request.user!.id);
  }

  @Post('auth/api-keys/validate')
  @UseGuards(ApiKeyAuthGuard)
  validateApiKey(@Req() request: AuthPrincipalRequest) {
    return {
      success: true,
      user: request.user,
    };
  }
}
