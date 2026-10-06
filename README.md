# Socket Visualizer

An interactive educational web app for understanding how sockets work in practice. The project walks through TCP, UDP, `epoll`, and WebSocket behavior with animated system-call steps, packet flow, kernel state, and code explanations.

## What this project shows

- TCP and UDP socket lifecycles
- Packet flow between client and server
- Kernel buffers, queues, and socket state transitions
- `epoll` readiness monitoring for many sockets
- WebSocket upgrade and message-layer behavior
- A guided playground for manually stepping through socket interactions

## Features

- Visual explanations for each network protocol
- Step-by-step state timeline with keyboard controls
- Side-by-side client/server machine panels
- Kernel and syscall debugger views
- Animated network lane showing packet movement
- Responsive layout for desktop exploration

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Lucide icons

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```

3. Open the local address shown in the terminal, typically:
   ```bash
   http://localhost:5173
   ```

## Available scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Project structure

```text
src/
  components/      # UI panels, walkthrough sections, protocol views
  data/            # protocol steps, code examples, kernel notes
  hooks/           # interaction and playback logic
  types/           # TypeScript interfaces for socket and protocol data
  utils/           # kernel/source helpers and code generation utilities
App.tsx            # Root app entry
index.css          # Global styling and Tailwind base styles
```

## Learning flow

Use the segmented topic selector to switch between:

- TCP
- UDP
- epoll
- WebSocket
- Play zone

The app is designed to help explain the relationship between:

- application code
- system calls
- kernel state
- socket buffers
- packet-level behavior

## Notes

This project is built as a visual teaching tool rather than a production networking backend, so the emphasis is on clarity and step-by-step understanding over deployment readiness.

