"""
mDNS Service: Broadcasts 'cinema.local' on the local network using Avahi and Zeroconf.
Allows LAN devices (mobile, TV, tablets, PCs) to access CineTrack at http://cinema.local:8088
"""
import socket
import logging
import threading
import subprocess
import shutil
from typing import Optional

logger = logging.getLogger(__name__)

_zeroconf = None
_service_info = None
_avahi_proc: Optional[subprocess.Popen] = None
_lock = threading.Lock()


def get_lan_ip() -> str:
    """Detect machine's primary local IP."""
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


def start_mdns(port: int = 8088, hostname: str = "cinema.local"):
    """Register and advertise cinema.local on local network via Avahi and mDNS."""
    global _zeroconf, _service_info, _avahi_proc

    with _lock:
        if _zeroconf is not None or _avahi_proc is not None:
            return  # Already running

        ip = get_lan_ip()
        clean_hostname = hostname.rstrip('.')

        # 1. Try publishing A record via avahi-publish if available on Linux
        if shutil.which("avahi-publish"):
            try:
                _avahi_proc = subprocess.Popen(
                    ["avahi-publish", "-a", "-R", clean_hostname, ip],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                logger.info("Avahi A-record registered for %s -> %s", clean_hostname, ip)
            except Exception as e:
                logger.warning("Could not start avahi-publish: %s", e)
                _avahi_proc = None

        # 2. Register HTTP service and server info via Zeroconf
        try:
            from zeroconf import Zeroconf, ServiceInfo

            server_name = f"{clean_hostname}."
            desc = {
                "name": "CineTrack",
                "version": "4.0",
                "path": "/",
            }

            _service_info = ServiceInfo(
                type_="_http._tcp.local.",
                name=f"CineTrack Media Center._http._tcp.local.",
                addresses=[socket.inet_aton(ip)],
                port=port,
                properties=desc,
                server=server_name,
            )

            _zeroconf = Zeroconf()
            _zeroconf.register_service(_service_info)
            logger.info("mDNS broadcast active: http://%s:%s (%s)", hostname, port, ip)
        except Exception as e:
            logger.warning("Failed to start Zeroconf mDNS broadcast for %s: %s", hostname, e)


def stop_mdns():
    """Unregister mDNS service cleanly on shutdown."""
    global _zeroconf, _service_info, _avahi_proc

    with _lock:
        if _avahi_proc:
            try:
                _avahi_proc.terminate()
                _avahi_proc.wait(timeout=2)
            except Exception as e:
                logger.warning("Error stopping avahi-publish: %s", e)
            finally:
                _avahi_proc = None

        if _zeroconf and _service_info:
            try:
                _zeroconf.unregister_service(_service_info)
                _zeroconf.close()
                logger.info("mDNS broadcast stopped cleanly.")
            except Exception as e:
                logger.warning("Error stopping Zeroconf: %s", e)
            finally:
                _zeroconf = None
                _service_info = None
