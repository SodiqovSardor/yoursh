import sys, os, pty, fcntl, termios, struct, json, threading
from websocket import create_connection

# usage: python3 agent.py <session> <wss-url> [tmux-session]
if len(sys.argv) < 3:
    print('usage: python3 agent.py <session> <wss-url> [tmux-session]')
    sys.exit(1)

session = sys.argv[1]
base = sys.argv[2].rstrip('/')
tmux = sys.argv[3] if len(sys.argv) > 3 else 'yoursh'

ws = create_connection(base + '/agent?session=' + session)

pid, fd = pty.fork()
if pid == 0:
    os.execvp('tmux', ['tmux', 'new', '-A', '-s', tmux])
    os._exit(1)

def set_winsize(rows, cols):
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
    except OSError:
        pass

def net_to_pty():
    while True:
        data = ws.recv()
        if isinstance(data, str):
            try:
                m = json.loads(data)
                if m.get('type') == 'resize':
                    set_winsize(int(m['rows']), int(m['cols']))
                continue
            except (ValueError, KeyError):
                data = data.encode()
        if isinstance(data, str):
            data = data.encode()
        try:
            os.write(fd, data)
        except OSError:
            break

threading.Thread(target=net_to_pty, daemon=True).start()

try:
    while True:
        data = os.read(fd, 65536)
        if not data:
            break
        ws.send(data)
except OSError:
    pass
finally:
    try:
        ws.close()
    except Exception:
        pass
