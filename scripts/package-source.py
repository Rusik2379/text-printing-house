"""Create a portable source package; optionally include a prebuilt Docker image."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
parser.add_argument("--image", type=Path)
args = parser.parse_args()
output = args.output.resolve()
if output.is_relative_to(root):
    raise SystemExit("Place the delivery archive outside the source directory.")
output.parent.mkdir(parents=True, exist_ok=True)
skip = {".git", ".work", ".build", "node_modules", "preview", "__pycache__", ".text-admin", "orders", "local-data", "data", "backups"}
private = {"credentials.json", "tariffs.json", "orders-config.json", "site-settings.json", "access.txt", "deploy-connection.json"}
names = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root).decode("utf-8").split("\0")
files = []
for name in sorted(set(names)):
    if not name:
        continue
    p = PurePosixPath(name)
    if set(p.parts) & skip or p.name in private:
        continue
    if p.name.startswith(".env") and name != "deploy/.env.example":
        continue
    if name == 'infrastructure/indexnow/config/key.txt' or p.suffix in {'.zip', '.log', '.bak', '.tmp'}:
        continue
    if (root / name).is_file():
        files.append(name)
revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
manifest = {"project": "ТЕКСТ", "createdAtUtc": datetime.now(timezone.utc).isoformat(), "commit": revision, "sourceFiles": len(files), "runtime": "Node.js 24", "imagePlatform": "linux/amd64", "imageTag": "tekst-site-app:latest", "privateDataIncluded": False}
if args.image:
    image = args.image.resolve()
    manifest["imageSha256"] = hashlib.sha256(image.read_bytes()).hexdigest()
with ZipFile(output, "x", ZIP_DEFLATED, compresslevel=6) as archive:
    for name in files:
        archive.write(root / name, name)
    if args.image:
        archive.write(image, "tekst-site-image.tar.gz", compress_type=0)
    archive.writestr("RELEASE.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"file": str(output), "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), **manifest}, ensure_ascii=False))
