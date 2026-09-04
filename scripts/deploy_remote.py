#!/usr/bin/env python3
"""One-shot deploy helper — reads VPS credentials from zammunda.txt, not stored in repo."""
import io
import os
import re
import secrets
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
CREDS = Path.home() / "Documents" / "zammunda.txt"
REMOTE_DIR = "/opt/nzeru-za-alimi"
SERVICE = "nzeru-za-alimi"

SKIP_DIRS = {
    ".git",
    "node_modules",
    "android/.gradle",
    "android/app/build",
    "android/build",
    "android/captures",
    ".cursor",
    "scripts",
}
SKIP_SUFFIXES = {".db", ".db-wal", ".db-shm", ".apk", ".aab"}


def parse_creds():
    text = CREDS.read_text(encoding="utf-8")
    return {
        "host": re.search(r"Ip Address:\s*(\S+)", text, re.I).group(1),
        "user": re.search(r"username:\s*(\S+)", text, re.I).group(1),
        "password": re.search(r"Password:\s*(\S+)", text, re.I).group(1),
    }


def should_skip(rel: str) -> bool:
    parts = rel.replace("\\", "/").split("/")
    for skip in SKIP_DIRS:
        if rel.startswith(skip) or skip in parts:
            return True
    return any(rel.endswith(suf) for suf in SKIP_SUFFIXES)


def build_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            rel = path.relative_to(ROOT).as_posix()
            if rel == "scripts/deploy_remote.py":
                continue
            if should_skip(rel):
                continue
            if path.is_dir():
                continue
            tar.add(path, arcname=rel)
    return buf.getvalue()


def safe_print(text: str) -> None:
    sys.stdout.buffer.write(text.encode("utf-8", errors="replace") + b"\n")


def run(client, cmd, check=True):
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        safe_print(text)
    if check and code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out + err


def main():
    creds = parse_creds()
    print(f"Connecting to {creds['host']}…")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        creds["host"],
        username=creds["user"],
        password=creds["password"],
        timeout=60,
        banner_timeout=60,
        auth_timeout=60,
    )

    run(client, "uname -a", check=False)
    run(client, "node -v 2>/dev/null || echo NO_NODE", check=False)

    _, stdout, _ = client.exec_command("command -v node >/dev/null 2>&1; echo $?")
    has_node = stdout.read().decode().strip() == "0"
    if not has_node:
        run(
            client,
            "export DEBIAN_FRONTEND=noninteractive && "
            "curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && "
            "apt-get install -y nodejs",
        )
    run(client, "node -v && npm -v")

    print("Uploading project tarball…")
    payload = build_tarball()
    sftp = client.open_sftp()
    sftp.putfo(io.BytesIO(payload), "/tmp/nzeru-deploy.tgz")
    sftp.close()
    print(f"Uploaded {len(payload) / 1024 / 1024:.1f} MB")

    jwt = secrets.token_hex(32)
    env_body = (
        f"PORT=4000\n"
        f"JWT_SECRET={jwt}\n"
        f"DATABASE_PATH=./data/dzalasmart.db\n"
    )

    run(client, f"mkdir -p {REMOTE_DIR}/server/data")
    run(client, f"rm -rf {REMOTE_DIR}/*")
    run(client, f"tar -xzf /tmp/nzeru-deploy.tgz -C {REMOTE_DIR}")
    run(client, f"rm -f /tmp/nzeru-deploy.tgz")

    sftp = client.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/server/.env", "w") as fh:
        fh.write(env_body)
    sftp.close()

    run(client, f"cd {REMOTE_DIR} && npm install")

    unit = f"""[Unit]
Description=Nzeru za Alimi API
After=network.target

[Service]
Type=simple
WorkingDirectory={REMOTE_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    sftp = client.open_sftp()
    with sftp.file(f"/etc/systemd/system/{SERVICE}.service", "w") as fh:
        fh.write(unit)
    sftp.close()

    run(client, "systemctl daemon-reload")
    run(client, f"systemctl enable {SERVICE}")
    run(client, f"systemctl restart {SERVICE}")
    time.sleep(3)
    run(client, f"systemctl is-active {SERVICE}")
    run(client, "curl -s http://127.0.0.1:4000/health || true", check=False)

    run(
        client,
        "if command -v ufw >/dev/null 2>&1; then ufw allow 4000/tcp || true; fi",
        check=False,
    )

    health = run(client, "curl -s http://127.0.0.1:4000/health", check=False)
    print("\nDeploy complete.")
    print(f"Farmer app:  http://{creds['host']}:4000/")
    print(f"Staff desk:  http://{creds['host']}:4000/staff")
    print(f"Health:      http://{creds['host']}:4000/health")
    if "nzeru-za-alimi" in health or "Nzeru" in health:
        print("Health check OK.")
    client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Deploy failed: {exc}", file=sys.stderr)
        sys.exit(1)
