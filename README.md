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

