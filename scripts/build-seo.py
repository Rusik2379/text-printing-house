"""Apply the imported SEO without rebuilding the design or the content."""
import argparse
import json
from pathlib import Path
from site_seo import apply_site_seo

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--mode', choices=['preview', 'production'])
args = parser.parse_args()
if args.mode:
    config = Path(__file__).resolve().parents[1] / 'seo-config.json'
    config.write_text(json.dumps({'mode': args.mode}, indent=2) + '\n', encoding='utf-8')
pages, sitemap = apply_site_seo(args.mode)
print(f'Applied SEO to {pages} pages; production sitemap contains {sitemap} URLs.')
