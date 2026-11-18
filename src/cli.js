import { setup } from './setup.js';
import { printDoctor } from './doctor.js';
import { startService, stopService, serviceStatus } from './service.js';
import { applyAdapterPatches } from './patch.js';
import { DEFAULT_PORT, loadState } from './config.js';

function usage() {
  console.log(`claude-gpt/codex-bridge

Usage:
  codex-bridge setup [--api-key KEY] [--port 3080] [--yes]
  codex-bridge start|stop|status|doctor|patch
  codex-bridge help

One-liner:
  export OPENAI_API_KEY='sk-...'
  curl -fsSL https://raw.githubusercontent.com/jhihhe/codex-bridge/main/install.sh | bash
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--api-key') args.apiKey = argv[++i];
    else if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--proxy-token') args.proxyToken = argv[++i];
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else args._.push(a);
  }
  return args;
}

export async function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || 'help';
  const port = args.port || loadState()?.port || DEFAULT_PORT;

  switch (cmd) {
    case 'setup':
      await setup(args);
      break;
    case 'start':
      await startService({ port });
      break;
    case 'stop':
      await stopService({ port });
      break;
    case 'status':
      await serviceStatus({ port });
      break;
    case 'doctor':
      await printDoctor();
      break;
    case 'patch': {
      const result = applyAdapterPatches();
      for (const r of result.results) console.log(`- ${r.label}: ${r.status}`);
      console.log('✔ Patches applied');
      break;
    }
    case 'help':
    case '--help':
    case '-h':
      usage();
      break;
    default:
      usage();
      throw new Error(`Unknown command: ${cmd}`);
  }
}
