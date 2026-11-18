import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './paths.js';

const require = createRequire(import.meta.url);

/**
 * Locate an installed claude-adapter package root.
 */
export function resolveAdapterRoot() {
  try {
    const pkg = require.resolve('claude-adapter/package.json');
    return path.dirname(pkg);
  } catch {
    // fall through — global install
  }

  const candidates = [
    path.join(process.env.HOME || '', '.local', 'lib', 'node_modules', 'claude-adapter'),
    path.join('/usr/local/lib/node_modules/claude-adapter'),
    path.join('/opt/homebrew/lib/node_modules/claude-adapter'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'package.json'))) return c;
  }
  throw new Error('claude-adapter not found. Re-run setup after install.');
}

function replaceOnce(file, oldText, newText, label) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes(newText.trim().slice(0, 80))) {
    return { file, status: 'already-patched', label };
  }
  if (!src.includes(oldText)) {
    return { file, status: 'skip-missing-anchor', label };
  }
  fs.writeFileSync(file, src.replace(oldText, newText), 'utf8');
  return { file, status: 'patched', label };
}

function copyIfMissing(src, dest, label) {
  if (fs.existsSync(dest)) {
    return { file: dest, status: 'exists', label };
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return { file: dest, status: 'copied', label };
}

/**
 * Apply GPT-6.x compatibility patches to claude-adapter@2.2.x
 */
export function applyAdapterPatches(adapterRoot = resolveAdapterRoot()) {
  const results = [];
  const handlers = path.join(adapterRoot, 'dist/server/handlers.js');
  const index = path.join(adapterRoot, 'dist/server/index.js');
  const request = path.join(adapterRoot, 'dist/converters/request.js');
  const bridgeSrc = path.join(ROOT, 'patches/responsesBridge.js');
  const bridgeDest = path.join(adapterRoot, 'dist/converters/responsesBridge.js');

  results.push(copyIfMissing(bridgeSrc, bridgeDest, 'responsesBridge.js'));

  // Wire Responses API import into handlers if missing
  {
    let h = fs.readFileSync(handlers, 'utf8');
    if (!h.includes('responsesBridge')) {
      if (h.includes("require(\"./streaming\")") || h.includes("require('./streaming')")) {
        h = h.replace(
          /const streaming_1 = require\(["']\.\/streaming["']\);/,
          (m) => `${m}\nconst responsesBridge_1 = require("../converters/responsesBridge");`,
        );
      } else {
        h = `const responsesBridge_1 = require("../converters/responsesBridge");\n${h}`;
      }
      fs.writeFileSync(handlers, h, 'utf8');
      results.push({ file: handlers, status: 'patched', label: 'import responsesBridge' });
    } else {
      results.push({ file: handlers, status: 'already-patched', label: 'import responsesBridge' });
    }
  }

  const oldResolve = `function resolveTargetModel(requested, config) {
    const m = String(requested || '');
    const upstream = [config.models?.opus, config.models?.sonnet, config.models?.haiku].filter(Boolean);
    if (upstream.includes(m)) return m;
    const lower = m.toLowerCase();
    if (/opus|fable/.test(lower)) return config.models?.opus || m;
    if (/haiku/.test(lower)) return config.models?.haiku || m;
    if (/sonnet|^claude-/.test(lower)) return config.models?.sonnet || m;
    return m;
}`;

  const newResolve = `function resolveTargetModel(requested, config) {
    const m = String(requested || '');
    const aliases = {
        'claude-opus-4-5': config.models?.opus,
        'claude-sonnet-4-5': config.models?.sonnet,
        'claude-haiku-4-5': config.models?.haiku,
        'claude-opus-5-5': config.models?.opus,
        'claude-sonnet-5-5': config.models?.sonnet,
        'claude-haiku-5-5': config.models?.haiku,
        'claude-opus-4-1': config.models?.opus61 || 'gpt-6.1-terra',
        'claude-sonnet-4-1': config.models?.sonnet61 || 'gpt-6.1-sol',
        'claude-haiku-4-1': config.models?.haiku61 || 'gpt-6.1-sol',
        'gpt-6.1-sol': 'gpt-6.1-sol',
        'gpt-6.1-terra': 'gpt-6.1-terra',
        'gpt-6.2-astra': 'gpt-6.2-astra',
        'gpt-6.2-sol': 'gpt-6.2-sol',
    };
    if (aliases[m]) return aliases[m];
    const upstream = [
        config.models?.opus, config.models?.sonnet, config.models?.haiku,
        config.models?.opus61, config.models?.sonnet61, config.models?.haiku61,
        'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6.2-astra', 'gpt-6.2-sol',
    ].filter(Boolean);
    if (upstream.includes(m)) return m;
    const lower = m.toLowerCase();
    if (/4-1|6\\.1/.test(lower)) {
        if (/opus|terra|fable/.test(lower)) return config.models?.opus61 || 'gpt-6.1-terra';
        if (/haiku/.test(lower)) return config.models?.haiku61 || 'gpt-6.1-sol';
        return config.models?.sonnet61 || 'gpt-6.1-sol';
    }
    if (/opus|fable/.test(lower)) return config.models?.opus || m;
    if (/haiku/.test(lower)) return config.models?.haiku || m;
    if (/sonnet|^claude-/.test(lower)) return config.models?.sonnet || m;
    return m;
}`;

  if (fs.existsSync(handlers)) {
    let h = fs.readFileSync(handlers, 'utf8');
    if (!h.includes('function resolveTargetModel')) {
      // inject before createMessagesHandler
      h = h.replace(
        'function createMessagesHandler',
        `${newResolve}\n\nfunction createMessagesHandler`,
      );
      fs.writeFileSync(handlers, h, 'utf8');
      results.push({ file: handlers, status: 'injected', label: 'resolveTargetModel' });
    } else if (h.includes('claude-opus-4-1')) {
      results.push({ file: handlers, status: 'already-patched', label: 'resolveTargetModel' });
    } else if (h.includes(oldResolve)) {
      results.push(replaceOnce(handlers, oldResolve, newResolve, 'resolveTargetModel'));
    } else {
      // Replace any existing resolveTargetModel function body heuristically
      h = h.replace(/function resolveTargetModel\([\s\S]*?\n\}/, newResolve);
      fs.writeFileSync(handlers, h, 'utf8');
      results.push({ file: handlers, status: 'replaced-heuristic', label: 'resolveTargetModel' });
    }

    // Use resolveTargetModel in messages handler if still reading anthropicRequest.model raw
    h = fs.readFileSync(handlers, 'utf8');
    if (h.includes('anthropicRequest.model') && !h.includes('resolveTargetModel(anthropicRequest.model')) {
      h = h.replace(
        /const targetModel = anthropicRequest\.model/,
        'const targetModel = resolveTargetModel(anthropicRequest.model, config)',
      );
      // also common pattern without const targetModel
      if (!h.includes('resolveTargetModel(anthropicRequest.model')) {
        h = h.replace(
          'convertRequestToOpenAI(anthropicRequest, config)',
          'convertRequestToOpenAI({ ...anthropicRequest, model: resolveTargetModel(anthropicRequest.model, config) }, config)',
        );
      }
      fs.writeFileSync(handlers, h, 'utf8');
      results.push({ file: handlers, status: 'patched', label: 'wire resolveTargetModel' });
    }
  }

  // Enrich /v1/models listing
  if (fs.existsSync(index)) {
    let ix = fs.readFileSync(index, 'utf8');
    if (ix.includes("app.get('/v1/models'") && !ix.includes('claude-opus-4-1')) {
      const routeBlock = `        const routes = [
            { id: 'claude-opus-4-5', display_name: 'GPT 6.2 Astra', upstream: config.models?.opus },
            { id: 'claude-sonnet-4-5', display_name: 'GPT 6.2 Sol', upstream: config.models?.sonnet },
            { id: 'claude-haiku-4-5', display_name: 'GPT 6.2 Sol Fast', upstream: config.models?.haiku },
            { id: 'claude-opus-4-1', display_name: 'GPT 6.1 Terra', upstream: config.models?.opus61 || 'gpt-6.1-terra' },
            { id: 'claude-sonnet-4-1', display_name: 'GPT 6.1 Sol', upstream: config.models?.sonnet61 || 'gpt-6.1-sol' },
            { id: 'claude-haiku-4-1', display_name: 'GPT 6.1 Sol Fast', upstream: config.models?.haiku61 || 'gpt-6.1-sol' },
            { id: 'claude-opus-5-5', display_name: 'GPT 6.2 Astra', upstream: config.models?.opus },
            { id: 'claude-sonnet-5-5', display_name: 'GPT 6.2 Sol', upstream: config.models?.sonnet },
            { id: 'claude-haiku-5-5', display_name: 'GPT 6.2 Sol Fast', upstream: config.models?.haiku },
        ].filter((r) => r.upstream);`;

      if (ix.includes('const routes = [')) {
        ix = ix.replace(/const routes = \[[\s\S]*?\]\.filter\(\(r\) => r\.upstream\);/, routeBlock);
      } else {
        // Insert a richer models handler before messages route if a simple one exists
        results.push({ file: index, status: 'manual-review', label: '/v1/models routes shape unexpected' });
      }
      fs.writeFileSync(index, ix, 'utf8');
      results.push({ file: index, status: 'patched', label: '/v1/models routes' });
    } else if (ix.includes('claude-opus-4-1')) {
      results.push({ file: index, status: 'already-patched', label: '/v1/models routes' });
    }
  }

  // max_completion_tokens for gpt-5+/gpt-6+
  if (fs.existsSync(request)) {
    let r = fs.readFileSync(request, 'utf8');
    if (!r.includes('needsMaxCompletionTokens') && !r.includes('max_completion_tokens')) {
      results.push({ file: request, status: 'skip', label: 'max_completion_tokens (adapter may already handle)' });
    } else if (r.includes('gpt-6') || r.includes('max_completion_tokens')) {
      results.push({ file: request, status: 'ok', label: 'max_completion_tokens' });
    }

    // Ensure gpt-6 uses max_completion_tokens
    if (r.includes('max_tokens = maxTokens') && !r.includes('needsMaxCompletionTokens')) {
      const needle = 'openaiRequest.max_tokens = maxTokens;';
      if (r.includes(needle)) {
        const replacement = `const needsMaxCompletionTokens = isAzureOpenAI || /^(gpt-5|gpt-6|o\\d)/i.test(String(targetModel || ''));
    if (needsMaxCompletionTokens || isAzureOpenAI) {
        openaiRequest.max_completion_tokens = maxTokens;
    } else {
        openaiRequest.max_tokens = maxTokens;
    }`;
        // Only replace non-azure branch carefully — if both branches exist, leave alone
        results.push({ file: request, status: 'detected', label: 'max_tokens branch present' });
      }
    }
  }

  return { adapterRoot, results };
}
