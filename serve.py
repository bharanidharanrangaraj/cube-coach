"""Serve Cube Coach to your phone.

Phones only allow the camera on secure (https) pages, so this serves the app over
HTTPS with a certificate made on this computer, plus plain http on localhost for
testing in a desktop browser.

    python serve.py                 phone: https://<this-pc>:8444   this PC: http://localhost:8001
    python serve.py --port 9443     use another HTTPS port
    python serve.py --local-only    only this computer: http://localhost:8001
"""
import argparse
import http.server
import shutil
import socket
import ssl
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CERT_DIR = ROOT / ".cert"
CERT, KEY, IPS = CERT_DIR / "cert.pem", CERT_DIR / "key.pem", CERT_DIR / "ips.txt"


def lan_ips():
    ips = set()
    try:  # route lookup only; a UDP "connect" sends nothing
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith(("127.", "169.254.")))


def find_openssl():
    found = shutil.which("openssl")
    if found:
        return found
    for p in (r"C:\Program Files\Git\usr\bin\openssl.exe", r"C:\Program Files\Git\mingw64\bin\openssl.exe",
              r"C:\Program Files\Git\ucrt64\bin\openssl.exe"):
        if Path(p).exists():
            return p
    return None


def ensure_cert(ips):
    want = ",".join(ips)
    if CERT.exists() and KEY.exists() and IPS.exists() and IPS.read_text().strip() == want:
        return
    openssl = find_openssl()
    if not openssl:
        sys.exit("OpenSSL not found. Install Git for Windows (it includes OpenSSL) and run this again.")
    CERT_DIR.mkdir(exist_ok=True)
    san = ",".join(["DNS:localhost", "IP:127.0.0.1"] + [f"IP:{ip}" for ip in ips])
    subprocess.run([openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "825",
                    "-keyout", str(KEY), "-out", str(CERT), "-subj", "/CN=Cube Coach (this computer)",
                    "-addext", f"subjectAltName={san}"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    IPS.write_text(want)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        "": "application/octet-stream", ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
        ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".md": "text/plain; charset=utf-8", ".py": "text/plain; charset=utf-8",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        # Never serve hidden files (the certificate's private key lives in .cert/).
        if any(part.startswith(".") for part in self.path.split("?")[0].split("/") if part):
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # the phone always gets the latest code
        super().end_headers()

    timeout = 30  # drop idle connections so they don't hold a thread forever

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            sys.stderr.write(f"  {self.address_string()} {fmt % args}\n")


class PhoneServer(http.server.ThreadingHTTPServer):
    """HTTPS on one port. The TLS handshake runs in each connection's own thread (a stalled
    connection can't freeze the server), and a browser that came in with plain http:// is
    redirected to https:// instead of getting a broken page."""

    def __init__(self, addr, handler, ctx):
        super().__init__(addr, handler)
        self.ctx = ctx

    def finish_request(self, request, client_address):
        try:
            request.settimeout(15)
            first = request.recv(1, socket.MSG_PEEK)
        except OSError:
            return
        if not first:
            return
        if first != b"\x16":  # not a TLS handshake: plain http
            self.redirect_to_https(request, client_address)
            return
        try:
            tls = self.ctx.wrap_socket(request, server_side=True)
        except (ssl.SSLError, OSError):
            return  # browser gave up on the certificate, or the connection dropped
        try:
            self.RequestHandlerClass(tls, client_address, self)
        finally:
            try:
                tls.close()
            except OSError:
                pass

    def redirect_to_https(self, request, client_address):
        data = b""
        try:
            while b"\r\n\r\n" not in data and len(data) < 8192:
                chunk = request.recv(1024)
                if not chunk:
                    break
                data += chunk
        except OSError:
            return
        lines = data.decode("latin-1").split("\r\n")
        parts = lines[0].split(" ")
        path = parts[1] if len(parts) > 1 and parts[1].startswith("/") else "/"
        host = next((l.split(":", 1)[1].strip() for l in lines[1:] if l.lower().startswith("host:")), "")
        if not host:
            host = f"{request.getsockname()[0]}:{self.server_address[1]}"
        body = f"Use https://{host}{path}\n".encode()
        try:
            request.sendall(
                f"HTTP/1.1 301 Moved Permanently\r\nLocation: https://{host}{path}\r\n"
                f"Content-Type: text/plain\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n".encode() + body)
        except OSError:
            pass
        sys.stderr.write(f"  {client_address[0]} opened http:// - sent it to https://{host}{path}\n")

    def handle_error(self, request, client_address):
        pass  # dropped/odd connections are normal with phones; don't print tracebacks


def is_vpn(ip):
    a, b = (int(x) for x in ip.split(".")[:2])
    return a == 100 and 64 <= b <= 127  # 100.64.0.0/10: Tailscale and other VPNs


def main():
    ap = argparse.ArgumentParser(description="Serve Cube Coach over HTTPS for your phone.")
    ap.add_argument("--port", type=int, default=8444, help="HTTPS port for the phone (default 8444)")
    ap.add_argument("--local-port", type=int, default=8001, help="plain http port on localhost (default 8001)")
    ap.add_argument("--local-only", action="store_true", help="only serve http://localhost (no phone access)")
    args = ap.parse_args()

    if args.local_only:
        local = http.server.ThreadingHTTPServer(("127.0.0.1", args.local_port), Handler)
        print(f"\nCube Coach (this computer only): http://localhost:{args.local_port}\n")
        try:
            local.serve_forever()
        except KeyboardInterrupt:
            print("Stopped.")
        return

    ips = lan_ips()
    ensure_cert(ips)

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)
    httpd = PhoneServer(("0.0.0.0", args.port), Handler, ctx)

    local = http.server.ThreadingHTTPServer(("127.0.0.1", args.local_port), Handler)
    threading.Thread(target=local.serve_forever, daemon=True).start()

    wifi = [ip for ip in ips if not is_vpn(ip)]
    vpn = [ip for ip in ips if is_vpn(ip)]
    print("\nCube Coach is running.\n")
    if wifi:
        print("  On your phone (same Wi-Fi), type this exactly, including https://")
        for ip in wifi:
            print(f"      https://{ip}:{args.port}")
    else:
        print("  No Wi-Fi address found. Connect this computer to Wi-Fi to use it from a phone.")
    for ip in vpn:
        print(f"\n  VPN address (only if your phone is on the same VPN, e.g. Tailscale): https://{ip}:{args.port}")
    print("\n  The phone will warn that the connection isn't private. That's expected: the")
    print("  certificate was made on this computer. Chrome: Advanced > Proceed.")
    print("  Safari: Show Details > visit this website.\n")
    print(f"  On this computer: http://localhost:{args.local_port}\n")
    print("  Phone can't connect? Allow Python through Windows Firewall for Private networks,")
    print("  and check both devices are on the same Wi-Fi. Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()
