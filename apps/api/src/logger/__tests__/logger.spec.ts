import pino from 'pino';
import { Masker } from '../../common/utils/masker';

describe('Logger redaction', () => {
  it('masks email & phone in log line', () => {
    const logger = pino({
      hooks: {
        logMethod(args, method) {
          args[0] = Masker.mask(args[0]);
          expect(args[0]).toBe(
            'Call 07*** *** *** or e***@test.com for help',
          );
        },
      },
    });
    logger.info('Call 07911 123 456 or example@test.com for help');
  });
});
