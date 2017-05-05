[![Discord Server](https://discordapp.com/api/guilds/310097366759768065/embed.png)](https://discord.gg/tZWqhWd)

# Discord-GitLab Webhook Bot
A Discord bot for using webhooks with GitLab (and extendable for other custom webhooks not yet built into Discord).

## Installation
1. Clone this repo
2. Install [NodeJS](https://nodejs.org/en/download/)
3. Navigate to the cloned repo
4. Initialize the NodeJS app with npm install
5. All of the dependencies listed in **package.json** should automatically be installed to **node_modules/**
6. Update pm2

### Command Line Summary
```
# make a parent directory for containing the repo, if desired
mkdir my_bots
# navigate to your desired directory
cd my_bots
# either clone via HTTPS
git clone https://github.com/Warped2713/Discord-GitLab-Webhook.git
# ... or clone via SSH
git clone git@github.com:Warped2713/Discord-GitLab-Webhook.git
# navigate to the cloned repo
cd discord-gitlab-webhook
# install the app via NodeJS, using package.json
npm install
# update pm2
pm2 update
```

### Dependencies
The **package.json** file includes the following dependencies:
* [discordJS](https://github.com/hydrabolt/discord.js/) for integrating with Discord
    * [erlpack](https://github.com/hammerandchisel/erlpack) for much faster websockets
* [pm2](http://pm2.keymetrics.io/docs/usage/quick-start/#cheat-sheet) for monitoring and maintaining uptime


## Configuration
1. Create your Discord Bot at https://discordapp.com/developers/applications/me (keep this tab open so you can easily access Client ID and Client Secret)
2. Make your Discord app a Bot User by clicking the "Create Bot User" button in your app page settings.
2. Calculated the desired permissions for your bot at https://discordapi.com/permissions.html (or use the default 536964096)
3. Authorize your Discord Bot for your server using `https://discordapp.com/oauth2/authorize?client_id={YOUR_CLIENT_ID}&scope=bot&permissions={YOUR_CALCULATED_PERMISSIONS}` NOTE: if you get "Unexpected Error" then you probably forgot to turn your Discord App into a Bot User in Step 2.
4. In your local bot repo, rename the dev/require/config-dummy.json to dev/require/config.json
2. Fill in the data as follows:
```json
{
  
  "bot": {
    "name": "GitLab Webhook Bot",
    "id": "THE 'Client ID' CREATED AT https://discordapp.com/developers/applications/me",
    "token": "THE 'Client Secret' CREATED AT https://discordapp.com/developers/applications/me"
  },
  
  "guild": {
    "id": "RIGHT-CLICK YOUR SERVER/GUILD NAME IN DISCORD AND SELECT 'Copy ID' THEN PASTE HERE"
  },
  
  "webhook": {
    "id": "{ID} FROM https://discordapp.com/api/webhooks/{ID}/{TOKEN} WHICH IS GENEREATED WHEN YOU CREATE A WEBHOOK IN DISCORD",
    "token": "{TOKEN} FROM https://discordapp.com/api/webhooks/{ID}/{TOKEN} (USE THIS FOR GITLAB'S SECRET TOKEN BOX)",
    "source": "YOUR GITLAB REPO",
    "server": {
      "address": "localhost",
      "port": "8000"
    }
  }

}

```