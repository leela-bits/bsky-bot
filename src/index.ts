import { Client, ClientResponseError, ok } from '@atcute/client';
import { PasswordSession } from '@atcute/password-session';
import dotenv from 'dotenv';

// check to see if anyone mentioned us
async function checkMentions(session: PasswordSession) {
    if (!session.session.active) {
        return;
    }

    // create a client with the authenticated session
    const client = new Client({
        handler: session,
    });

    try {
        // get a list of all mention notifications
        const { notifications } = await ok(
            client.get('app.bsky.notification.listNotifications', {
                params: {
                    reasons: ['mention'],
                    limit: 100,
                },
            }),
        );

        // process each mention that hasn't been read yet
        for (const notif of notifications) {
            if (notif.reason !== 'mention' || notif.isRead) {
                continue;
            }

            // yay! Someone mentioned us!
            console.log(`@${notif.author.handle} mentioned us at ${notif.indexedAt}`);
        }
    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error(`${error.status} ${error.error} ${error.description}`);
        }
    }
}

// main entry point for the bot
async function main() {
    // get the bot credentials from the environment variables
    const service = process.env.BOT_PDS!;
    const identifier = process.env.BOT_HANDLE!;
    const password = process.env.BOT_PASSWORD!;

    // authenticate using the credentials
    await using session = await PasswordSession.login({
        service,
        identifier,
        password,
    });

    // check to see if anyone has mentioned us
    await checkMentions(session);
}

// load .env file
dotenv.config({ quiet: true });

// run the bot
main().catch((err) => {
    console.error('Unhandled error', err);
});
