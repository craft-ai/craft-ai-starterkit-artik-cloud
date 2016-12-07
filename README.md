# Sources for the **craft ai / ARTIK Cloud** webinar #

Integration of [**craft ai**](http://craft.ai) in [**ARTIK Cloud**](https://my.artik.cloud/).
Application written in Node.js using [**craft ai** official js client](https://www.npmjs.com/package/craft-ai).
This demo makes use of a [Philips Hue color lamp with its control bridge](http://www2.meethue.com/en-us/productdetail/philips-hue-white-and-color-ambiance-starter-kit-a19-gen-2) and a [Netatmo Welcome camera](https://www.netatmo.com/product/security/welcome).

## Setup ##

### ARTIK Cloud Developers ###
- From the [applications](https://developer.artik.cloud/dashboard/applications) page, add a new application
- set the `Authorization methods` to "Client credentials, auth code" (default value)
- set the `Auth redirect URL` to "http://localhost:4200/auth/callback" and save
- add "read" `Device permissions` to the following device types:
- Netatmo Welcome
- Philips Hue Color Light
- add "read" and "write" `Device permissions` to the "craft room manager" device type

### My ARTIK Cloud ###
- From the [devices](https://my.artik.cloud/devices) page, add a new `Philips Hue` device
- Authorize the use of your Philips Hue device by ARTIK Cloud
- This will automatically create new devices associated to your Philips Hue bulbs
- Add a new `Netatmo Welcome` device and authorize it
- Add a new `craft room manager` device, and generate a token for this device

### Node js application ###
- Download or clone the [sources from GitHub](https://github.com/craft-ai/webinar),
- Install [Node.js](https://nodejs.org/en/download/) on your computer,
- Install dependencies by running `npm install` in a terminal from the directory where the sources are.
- in this directory, create a `.env` file setting the following variables:
    - `CRAFT_TOKEN` allows you to [authenticate your calls to the **craft ai** API](https://beta.craft.ai/doc#header-authentication),
    - `CRAFT_OWNER` defines the **owner** of the craft ai agent that will be created  
    - `ARTIK_USER` is the ARTIK Cloud user id
    - `ARTIK_CLIENT_ID` is the ARTIK Cloud client id of the application
    - `ARTIK_CLIENT_SECRET` is the ARTIK Cloud client secret of the application
    - `HUE_LIGHT_ID` refers to the ARTIK Cloud device id of the Philips Hue bulb to use
    - `ARTIK_CRAFT_ID` refers to the ARTIK Cloud device id of the 'craft room manager' device
    - `ARTIK_CRAFT_TOKEN` refers to the ARTIK Cloud device token of the 'craft room manager' device

## Usage ##

### Run ###

```console
> npm run start
```
> allow requested permissions in browser when

### Play ###

## Help ##

- [craft ai documentation](https://beta.craft.ai/doc)
- [Slack support channel](https://craft-ai-community.slack.com/)
- [Mail at support@craft.ai]('mailto:support@craft.ai')
