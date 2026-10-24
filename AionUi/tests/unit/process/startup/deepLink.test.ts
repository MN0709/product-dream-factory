import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/common', () => ({
  ipcBridge: { deepLink: { received: { emit: vi.fn() } } },
}));

import { parseDeepLinkUrl, PROTOCOL_SCHEME } from '@/process/utils/deepLink';

describe('independent product deep links', () => {
  it('accepts provider links registered by this app', () => {
    expect(parseDeepLinkUrl('product-dream-factory://add-provider?base_url=https%3A%2F%2Fexample.com')).toEqual({
      action: 'add-provider',
      params: { base_url: 'https://example.com' },
    });
  });

  it('keeps the encoded provider import format', () => {
    const data = Buffer.from(JSON.stringify({ base_url: 'https://example.com', api_key: 'test-only' })).toString(
      'base64'
    );
    expect(parseDeepLinkUrl(`product-dream-factory://provider/add?v=1&data=${encodeURIComponent(data)}`)).toEqual({
      action: 'provider/add',
      params: { v: '1', base_url: 'https://example.com', api_key: 'test-only' },
    });
  });

  it.each(['aionui://add-provider', 'https://example.com', 'not a URL'])(
    'rejects foreign or invalid link %s',
    (url) => {
      expect(parseDeepLinkUrl(url)).toBeNull();
    }
  );

  it('registers the same protocol in the packaged application', () => {
    const config = readFileSync(resolve(__dirname, '../../../../packages/desktop/electron-builder.yml'), 'utf8');
    expect(config).toContain(`      - ${PROTOCOL_SCHEME}`);
    expect(config).not.toContain('      - aionui\n');
  });
});
