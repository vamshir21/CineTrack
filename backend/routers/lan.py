"""
LAN Network Discovery Router: Detects host local IP and generates connection info.
"""
import socket
import logging
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lan", tags=["lan"])


def get_local_ip() -> str:
    """Detect machine's primary LAN IP (e.g. 192.168.1.x or 10.x.x.x)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = "127.0.0.1"
    finally:
        s.close()
    return ip


@router.get("/info")
def get_lan_info(request: Request):
    """Return local IP, port, and quick connect URL."""
    lan_ip = get_local_ip()
    port = request.url.port or 8088
    lan_url = f"http://{lan_ip}:{port}"
    mdns_url = f"http://cinema.local:{port}"
    hostname = socket.gethostname()

    return {
        "lan_ip": lan_ip,
        "port": port,
        "lan_url": lan_url,
        "mdns_url": mdns_url,
        "hostname": hostname,
    }
