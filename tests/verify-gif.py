"""Independent saved-file validation: python verify-gif.py <test-output-directory>."""
import hashlib
import argparse
import json
from pathlib import Path

from PIL import Image

reports = []
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output_directory', type=Path)
args = parser.parse_args()
for file in sorted(args.output_directory.glob('*.gif')):
    with Image.open(file) as gif:
        assert gif.format == 'GIF'
        assert gif.info.get('loop') == 0
        duration = 0
        hashes = set()
        alpha_values = set()
        for index in range(gif.n_frames):
            gif.seek(index)
            frame = gif.convert('RGBA')
            duration += gif.info['duration']
            hashes.add(hashlib.sha256(frame.tobytes()).hexdigest())
            alpha_values.update(frame.getchannel('A').tobytes())
        transparent = file.name.endswith('-transparent.gif')
        assert alpha_values == ({0, 255} if transparent else {255}), alpha_values
        assert duration == 5000
        assert gif.n_frames == (75 if transparent else 50)
        assert len(hashes) > 1
        reports.append(dict(file=file.name, size=gif.size, frames=gif.n_frames,
                            duration_ms=duration, distinct_frames=len(hashes),
                            alpha=sorted(alpha_values), bytes=file.stat().st_size))
assert len(reports) == 3
print(json.dumps(reports, ensure_ascii=False, indent=2))
