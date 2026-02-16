const fs = require('fs');
const path = require('path');

const FILES_TO_COPY = [
  { source: 'src/proto/mumble.js', target: 'dist/proto/mumble.js' },
  { source: 'src/proto/mumbleudp.js', target: 'dist/proto/mumbleudp.js' },
];

function patchPackage(packageRoot) {
  if (!fs.existsSync(packageRoot)) return false;

  let copied = 0;
  for (const file of FILES_TO_COPY) {
    const sourcePath = path.join(packageRoot, file.source);
    const targetPath = path.join(packageRoot, file.target);
    if (!fs.existsSync(sourcePath)) continue;

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    copied += 1;
  }

  if (copied > 0) {
    console.log(`[postinstall] patched mumble-node (${copied} files) at ${packageRoot}`);
    return true;
  }
  return false;
}

function getCandidateRoots() {
  const roots = [
    path.resolve(process.cwd(), 'node_modules/mumble-node'),
    path.resolve(__dirname, '../node_modules/mumble-node'),
    path.resolve(__dirname, '../../node_modules/mumble-node'),
  ];
  return Array.from(new Set(roots));
}

let patched = false;
for (const candidate of getCandidateRoots()) {
  patched = patchPackage(candidate) || patched;
}

if (!patched) {
  console.log('[postinstall] mumble-node patch skipped (package not found or no source proto files)');
}
