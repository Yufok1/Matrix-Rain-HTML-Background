#!/usr/bin/env python3
"""
🌀 Ollama Matrix Rain - HTTP Proxy + WebSocket Bridge
Proxies HTTP requests to Ollama API and broadcasts responses to matrix rain via WebSocket
"""

import asyncio
import json
import websockets
import aiohttp
from aiohttp import web

# Configuration
WS_HOST = 'localhost'
WS_PORT = 8080
HTTP_HOST = 'localhost'
HTTP_PORT = 11434  # Proxy listens here (default Ollama port)
OLLAMA_URL = 'http://localhost:11435'  # Real Ollama running here

# Connected WebSocket clients
ws_clients = set()

# ============================================
# WebSocket Server (for browser matrix rain)
# ============================================

async def ws_handler(websocket):
    """Handle WebSocket connections from browsers"""
    ws_clients.add(websocket)
    client_id = id(websocket)
    print(f"🌀 WebSocket client connected: {client_id} (Total: {len(ws_clients)})")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                print(f"📨 WebSocket received: {data.get('type', 'unknown')}")

                # Handle test messages from test interface
                if data.get('type') in ['expression', 'test']:
                    await broadcast_to_websockets(data)

            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
            except Exception as e:
                print(f"❌ Error processing WebSocket message: {e}")

    except websockets.exceptions.ConnectionClosed:
        print(f"🔌 WebSocket client disconnected: {client_id}")
    finally:
        ws_clients.discard(websocket)
        print(f"📊 Total WebSocket clients: {len(ws_clients)}")


async def broadcast_to_websockets(message):
    """Broadcast message to all connected WebSocket clients"""
    if not ws_clients:
        return

    message_str = json.dumps(message)
    disconnected = set()

    for client in ws_clients:
        try:
            await client.send(message_str)
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(client)

    for client in disconnected:
        ws_clients.discard(client)


async def start_websocket_server():
    """Start WebSocket server"""
    print(f"🌀 Starting WebSocket server on ws://{WS_HOST}:{WS_PORT}")
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()


# ============================================
# HTTP Proxy Server (for native Ollama app)
# ============================================

def filter_headers(headers, skip_headers=None):
    """Filter headers to forward, removing problematic ones"""
    if skip_headers is None:
        skip_headers = {'Host', 'Connection', 'Keep-Alive', 'Proxy-Connection',
                       'Proxy-Authenticate', 'Proxy-Authorization', 'TE', 'Trailers',
                       'Transfer-Encoding', 'Upgrade'}

    filtered = {}
    for key, value in headers.items():
        if key not in skip_headers:
            filtered[key] = value
    return filtered


async def proxy_handler(request):
    """Proxy all HTTP requests to real Ollama and broadcast responses"""
    path = request.path
    method = request.method

    print(f"🔄 Proxying {method} {path}")

    # Read request body
    body = await request.read()

    # Forward to real Ollama
    url = f"{OLLAMA_URL}{path}"

    # Filter headers for forwarding
    forward_headers = filter_headers(request.headers)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(
                method=method,
                url=url,
                data=body,
                headers=forward_headers,
                allow_redirects=False
            ) as ollama_resp:

                # Check if this is a streaming response
                is_streaming = 'text/event-stream' in ollama_resp.headers.get('Content-Type', '') or \
                              path in ['/api/chat', '/api/generate']

                if is_streaming and method == 'POST':
                    # Stream response and broadcast chunks
                    return await handle_streaming_response(request, ollama_resp, body)
                else:
                    # Non-streaming response - just proxy it
                    response_body = await ollama_resp.read()

                    # Filter response headers
                    response_headers = filter_headers(ollama_resp.headers)

                    return web.Response(
                        body=response_body,
                        status=ollama_resp.status,
                        headers=response_headers
                    )

    except aiohttp.ClientConnectorError as e:
        print(f"❌ Cannot connect to Ollama at {OLLAMA_URL}: {e}")
        return web.json_response(
            {'error': f'Cannot connect to Ollama at {OLLAMA_URL}'},
            status=503
        )
    except Exception as e:
        print(f"❌ Proxy error: {e}")
        return web.json_response({'error': str(e)}, status=500)


async def handle_streaming_response(request, ollama_resp, request_body):
    """Handle streaming Ollama responses - forward to client AND broadcast to WebSocket"""

    # Filter response headers
    response_headers = filter_headers(ollama_resp.headers)

    response = web.StreamResponse(
        status=ollama_resp.status,
        headers=response_headers
    )
    await response.prepare(request)

    # Parse request to get context (for urgency detection)
    try:
        req_data = json.loads(request_body) if request_body else {}
        user_message = ''
        if 'messages' in req_data and len(req_data['messages']) > 0:
            user_message = req_data['messages'][-1].get('content', '')
    except:
        user_message = ''

    # Detect urgency from user message
    urgency = detect_urgency(user_message)

    # Send user message to browser for background rain
    if user_message:
        await broadcast_to_websockets({
            'type': 'user_message',
            'text': user_message
        })
        print(f"📤 Sent user message to matrix rain: {user_message[:50]}...")

    full_response = ""

    # Stream chunks
    async for chunk in ollama_resp.content.iter_any():
        # Forward to native app
        await response.write(chunk)

        # Try to parse and broadcast to WebSocket clients
        try:
            # Chunks are newline-delimited JSON
            for line in chunk.decode('utf-8').strip().split('\n'):
                if line:
                    data = json.loads(line)

                    # Extract content
                    content = ''
                    if 'message' in data and 'content' in data['message']:
                        content = data['message']['content']
                    elif 'response' in data:
                        content = data['response']

                    if content:
                        full_response += content

                        # Broadcast to matrix rain
                        await broadcast_to_websockets({
                            'type': 'expression',
                            'text': content,
                            'urgency': urgency,
                            'duration': 3000,
                            'streaming': True
                        })
        except:
            # Not JSON or parsing failed - skip
            pass

    await response.write_eof()

    if full_response:
        print(f"✅ Streamed {len(full_response)} chars to native app and WebSocket clients")

    return response


def detect_urgency(message):
    """Detect urgency level from message content"""
    message_lower = message.lower()

    # Urgent indicators
    if any(word in message_lower for word in ['urgent', 'emergency', 'critical', 'important', 'warning', 'error']):
        return 8

    # High priority
    if any(word in message_lower for word in ['please', 'help', 'need', 'asap', '!!']):
        return 6

    # Questions
    if '?' in message:
        return 5

    # Default
    return 3


async def start_http_server():
    """Start HTTP proxy server"""
    app = web.Application(client_max_size=100*1024*1024)  # 100MB max
    app.router.add_route('*', '/{path:.*}', proxy_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HTTP_HOST, HTTP_PORT)
    await site.start()

    print(f"🔄 HTTP Proxy server started on http://{HTTP_HOST}:{HTTP_PORT}")
    print(f"   Forwarding to: {OLLAMA_URL}")


# ============================================
# Main
# ============================================

async def main():
    """Start both WebSocket and HTTP servers"""
    print("=" * 60)
    print("🌀 Ollama Matrix Rain - HTTP Proxy + WebSocket Bridge")
    print("=" * 60)
    print(f"🔄 HTTP Proxy: http://{HTTP_HOST}:{HTTP_PORT} → {OLLAMA_URL}")
    print(f"🌀 WebSocket: ws://{WS_HOST}:{WS_PORT}")
    print("=" * 60)
    print("✅ Servers starting...")
    print()

    # Start both servers concurrently
    await asyncio.gather(
        start_http_server(),
        start_websocket_server()
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n🛑 Servers stopped by user")
