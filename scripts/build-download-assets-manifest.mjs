import fs from 'node:fs/promises';
import path from 'node:path';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function statIfExists(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const inputDir = path.resolve(String(args.inputDir || args.input || '.'));
  const version = String(args.version || '').trim();
  const outputPath = path.resolve(String(args.output || 'logs/download-assets-manifest.json'));

  const manifest = [];
  for (const letter of LETTERS) {
    const fileName = `${letter.toUpperCase()}.pdf`;
    const fullPath = path.join(inputDir, fileName);
    const stats = await statIfExists(fullPath);

    manifest.push({
      assetKey: `pdf-${letter}`,
      letter,
      title: fileName,
      version,
      size: stats ? stats.size : 0,
      fileType: 'pdf',
      fileId: '',
      status: stats ? 'active' : 'draft',
    });
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${manifest.length} asset records to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exitCode = 1;
});
