import { test } from 'node:test';
import { ClientResponseError } from '@atcute/client';
import { delay } from './delay.ts';
import { NotificationService } from './notification-service.ts';

test('NotificationService test', async () => {
  const notifService = new NotificationService({
    pollInterval: 500,
    handler: {
      handle(pathname: string, init: RequestInit): Promise<Response> {
        console.debug(`Request for ${pathname} with init`, init);
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new ClientResponseError({
                status: 500,
                data: {
                  error: 'Internal Server Error',
                  message: 'Not Implemented',
                },
              }),
            );
          }, 333);
        });
      },
    },
  });
  notifService.start();
  await delay(2000);
  await notifService.stop();
});
