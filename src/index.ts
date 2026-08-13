import {Client, ClientResponseError, ok, simpleFetchHandler} from '@atcute/client';
import {isActorIdentifier} from '@atcute/lexicons/syntax';
import dotenv from 'dotenv';

// load .env file
dotenv.config({quiet: true});

// main entry point for the bot
async function main() {

    // create a simple client without authentication
    const client = new Client({
        handler: simpleFetchHandler({service: 'https://public.api.bsky.app'}),
    });

    try {
        // read and validate the bot handle
        const botHandle = process.env.BOT_HANDLE!;
        if (!isActorIdentifier(botHandle)) {
            console.error(`${botHandle} is not a valid ActorIdentifier`);
            return;
        }

        // try to get our own profile
        const profile = await ok(client.get('app.bsky.actor.getProfile', {
            params: {actor: botHandle},
        }));

        // try to get the actor name from the profile
        const actorName = profile?.displayName ?? profile?.handle ?? profile?.did ?? botHandle;

        console.log(`Successfully retrieved profile data for "${actorName}"`);

    } catch (error) {
        if (error instanceof ClientResponseError) {
            console.error(`${error.status} ${error.error} ${error.description}`);
        }
    }
}

main().catch((err) => {
    console.error('Unhandled error', err);
})