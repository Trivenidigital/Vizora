import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  organizationId: string;
  role: string;
  type?: string; // 'user' or 'device'
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private databaseService: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    // For device JWTs, skip user validation
    if (payload.type === 'device') {
      return {
        id: payload.sub,
        deviceId: payload.sub,
        organizationId: payload.organizationId,
        type: 'device',
      };
    }

    // Validate user exists and is active
    const user = await this.databaseService.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      organization: user.organization,
    };
  }
}
