import {
  AppBskyFeedDefs,
  AppBskyFeedGetPostThread,
  AppBskyFeedPost,
  AppBskyNotificationUpdateSeen,
} from '@atcute/bluesky';
import {
  Client,
  ClientResponseError,
  ClientValidationError,
  type FetchHandler,
  type FetchHandlerObject,
  ok,
} from '@atcute/client';

import { is } from '@atcute/lexicons';

import { delay } from './delay.ts';

// log error information to the console
function logError(err: unknown) {
  if (err instanceof ClientValidationError) {
    console.error(`client validation error: ${err.message}`);
  } else if (err instanceof ClientResponseError) {
    console.error(`client response error: ${err.status} ${err.error} ${err.description}`);
  } else {
    console.error('unexpected error: ', err);
  }
}
export type NotificationServiceOptions = {
  handler: FetchHandler | FetchHandlerObject;
  pollInterval?: number | null;
};

export class NotificationService {
  #stopSource: AbortController | null = null;
  #stopped = Promise.resolve();
  readonly pollMs: number;
  readonly #handler: FetchHandler | FetchHandlerObject;

  constructor(options: NotificationServiceOptions) {
    this.#handler = options.handler;
    this.pollMs = options.pollInterval ?? 10 * 1000;
  }

  start(): void {
    console.log('NotificationService starting');
    this.#stopSource = new AbortController();
    const stopSignal = this.#stopSource.signal;
    let stopped: () => void;
    this.#stopped = new Promise<void>((resolve) => {
      stopped = resolve;
    });
    process.nextTick(() => this.#run(stopSignal, stopped));
  }

  async stop() {
    console.log('NotificationService stopping');
    const stopSource = this.#stopSource;
    this.#stopSource = null;
    stopSource?.abort();
    await this.#stopped;
  }

  async #run(stopSignal: AbortSignal, stopped: () => void) {
    console.log('NotificationService checking for notifications');

    try {
      const client = new Client({
        handler: this.#handler,
      });

      let next: string | undefined;

      do {
        try {
          // get a list of all mention notifications
          console.log('getting list of all mention notifications');
          const { cursor, notifications } = await ok(
            client.get('app.bsky.notification.listNotifications', {
              params: {
                reasons: ['mention'],
                limit: 20,
                cursor: next,
              },
              signal: stopSignal,
            }),
          );

          next = cursor;

          console.log(
            `${notifications.length} notification${notifications.length !== 1 ? 's' : ''} retrieved`,
          );

          // process each mention that hasn't been read yet
          for (const notif of notifications) {
            if (notif.reason !== 'mention') {
              continue;
            }

            // if the notification has been read then we are done reading
            if (notif.isRead) {
              console.log('all notifications have been read');
              next = '';
              break;
            }
            try {
              // get the post thread that we were mentioned in
              console.log('getting thread that we were mentioned in');
              const { thread } = await ok(
                client.call(AppBskyFeedGetPostThread, {
                  params: { uri: notif.uri },
                  signal: stopSignal,
                }),
              );

              // if this is a valid post (i.e. not blocked or missing)
              if (
                is(AppBskyFeedDefs.threadViewPostSchema, thread) &&
                is(AppBskyFeedPost.mainSchema, thread.post.record)
              ) {
                const mentionText = thread.post.record.text;
                const createdAt = thread.post.record.createdAt;

                console.log(
                  `@${notif.author.handle} mentioned us at ${createdAt} in a post with the text "${mentionText}"`,
                );

                try {
                  // update the notifications seen time
                  const seenAt = new Date(createdAt);
                  seenAt.setTime(seenAt.getTime() + 1);
                  console.log(`updating notifications seen time to ${seenAt.toISOString()}`);
                  await ok(
                    client.call(AppBskyNotificationUpdateSeen, {
                      input: {
                        seenAt: seenAt.toISOString(),
                      },
                      signal: stopSignal,
                    }),
                  );
                } catch (err) {
                  logError(err);
                }
              }
            } catch (err) {
              logError(err);
            }
          }
        } catch (err) {
          logError(err);
        }
      } while (next && next !== '');

      delay(this.pollMs, stopSignal)
        .then(() => {
          process.nextTick(() => this.#run(stopSignal, stopped));
        })
        .catch(() => {
          console.log('NotificationService stopped');
          this.#stopSource = null;
          stopped();
        });
    } catch (err) {
      logError(err);
    }
  }
}
