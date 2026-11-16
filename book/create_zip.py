import zipfile
import os

zip_name = "Computer_for_Ministry_CPTIs.zip"

files_to_pack = [
    ("index.html", "index.html"),
    ("materials.html", "materials.html"),
]

assets_dir = "assets"
for root, dirs, files in os.walk(assets_dir):
    for f in files:
        full_path = os.path.join(root, f)
        # exclude json if we only need js, but let's check: json is only 1MB so packing it or not is fine.
        rel_path = os.path.relpath(full_path, ".")
        files_to_pack.append((full_path, rel_path))

with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zf:
    for full_path, arc_name in files_to_pack:
        zf.write(full_path, arc_name)

size_mb = os.path.getsize(zip_name) / (1024 * 1024)
print(f"Created {zip_name} successfully! Size: {size_mb:.2f} MB")
