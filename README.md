# Experiment in exposing Bing Chat API

This is a simple experiment that exposes an API for chat prompts. It uses the Playwright library to drive a locally running Microsoft Edge on the Bing AI Chat site, input the provided chat prompt, and respond with the AI-generated response.

## Prerequisites

- Node.js (v16+)
- Microsoft Edge browser installed (script defaults to Beta channel)

## To start

1. Clone the repo:

```
git clone https://github.com/u10e/experiment-expose-bing-chat-api.git
cd experiment-expose-bing-chat-api
```

2. Install deps:

```
npm install
```

3. Configure your environment variables:
   - either setting them in your system or directly in `index.ts` (see file for options)
   - defaults left in the code are for MSEdge Beta on MacOS

## Build

Run the following command to build the project:

```
npm run build
```

This will run the TypeScript compiler to generate a `dist` folder containing the compiled JavaScript files.

## Usage

1. Start the API server:

```
node dist/index.js
```

2. When the browser opens, make sure you're logged in etc.

3. Send a POST request to `http://localhost:<DRIVER_PORT>/chat` with the following JSON payload:

```
{
"prompt": "Your chat prompt here"
}
```

e.g. using curl

```
curl -X POST -H "Content-Type: application/json" -d '{"prompt": "How do boomerangs work?"}' http://127.0.0.1:3000/chat
```

4. The server will respond with the AI-generated response from the Bing AI Chat site. The response is a string of the innerHTML of the chat response, which means it contains HTML elements and not just plaintext.

## Disclaimer

The code is obviously not intended for production use. It serves as a simple experiment for tinkering purposes only.

You should assume that the DOM elements on the Bing Chat website have already changed, and will probably need updating in the code. Don't expect the code to work straight out of the box.

The code is not maintained.
