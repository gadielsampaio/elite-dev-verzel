import { createHmac } from 'node:crypto';
import { jwtOptions } from '../auth/jwt.config.js';

export function bidderAlias(lotId: string, bidderId: string) {
  return `bidder_${createHmac('sha256', jwtOptions().secret)
    .update(JSON.stringify(['auction-bid-alias-v1', lotId, bidderId]))
    .digest('hex')
    .slice(0, 32)}`;
}
