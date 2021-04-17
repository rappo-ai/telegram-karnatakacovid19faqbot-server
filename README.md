# Rappo / Telegram NLP Bot Server

This repository contains the codebase for Telegram NLP bot server.

## Steps to Build & Run the app

1.  ### Environment Variables
    You will first need to set some environment variables. Create a copy of *.env.server.template* without the *template* extension. Contact the Github code owner for credentials before proceeding.

2.  ### Build & Run
    #### Development build
    ```bash
    npm i
    npm run start
    ```
    This will start the development server on localhost:3000.

    #### Production build
    ```bash
    npm i
    npm run start:production
    ```
    This will start the production server on localhost:3000.
    
    You can change the port by setting the PORT env variable.

## License

Please read [LICENSE](LICENSE.md) for the terms and conditions of using, modifying or distributing this source code.
